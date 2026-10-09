import { and, asc, eq, lt, or, sql as raw } from 'drizzle-orm';
import {
  canTransitionRefund,
  decideRefund,
  isTerminalRefundStatus,
  providerAcceptedRefund,
  refundIdempotencyKey,
  studdyRefundStatusFor,
  UNSETTLED_REFUND_STATUSES,
  type RefundReason,
  type RefundRefusal,
  type RefundStatus,
} from '@studdy/domain/payments';
import { createDatabaseClient } from '../client';
import { auditEvents, outboxEntries, payments, refunds, statusTransitions } from '../schema/index';

/**
 * REFUNDS — giving a parent's money back, recorded before it is attempted.
 *
 * THE LEDGER STILL DOES NOT KNOW STRIPE. This file owns every decision and every
 * write; the provider call is the web layer's job, exactly as for payment
 * creation and fulfilment. What crosses the boundary is an id, an amount and a
 * key going out, and a provider refund id and status coming back.
 *
 * THE SHAPE OF ONE REFUND, in three transactions with the provider call BETWEEN
 * them and never inside one:
 *
 *   1. `beginRefund`        — lock the payment, decide, write a `requested` row.
 *   2. (the web layer)      — call the provider with the row's idempotency key.
 *   3. `recordRefundOutcome`— lock the refund, move it, tell the family.
 *
 * A network call is never made while a database lock is held, and the intent is
 * committed BEFORE any money moves. A crash anywhere leaves a row that the
 * reconcile pass can resolve, and the idempotency key means resolving it can
 * never refund twice.
 */

/** What the web layer needs to call the provider. Nothing a browser could supply. */
export interface RefundToExecute {
  readonly refundId: string;
  readonly reference: string;
  readonly paymentId: string;
  readonly paymentReference: string;
  readonly providerPaymentIntentId: string;
  readonly amountMinor: bigint;
  readonly currencyCode: string;
  readonly idempotencyKey: string;
  readonly attempt: number;
}

export type BeginRefundResult =
  | { readonly status: 'started'; readonly refund: RefundToExecute }
  | {
      readonly status: 'refused';
      readonly refusal: RefundRefusal;
      readonly paymentReference: string | null;
    };

export interface BeginRefundInput {
  /** A `PAY-` reference, which is what an operator has in front of them. */
  readonly paymentReference: string;
  readonly reasonCode: RefundReason;
  readonly requestedByUserId?: string | null;
  readonly correlationId: string;
  readonly now?: Date;
}

/**
 * Decide, and if allowed, write the intent. IDEMPOTENT BY REFUSAL: a second call
 * while a refund is in flight or done is `refused`, never a second row — the
 * decision reads the live refunds under the payment's own row lock, so two
 * operators clicking at once serialise rather than both succeeding.
 */
export async function beginRefund(input: BeginRefundInput): Promise<BeginRefundResult> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx): Promise<BeginRefundResult> => {
      const [payment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.reference, input.paymentReference))
        .limit(1)
        .for('update');
      if (payment === undefined) {
        return { status: 'refused', refusal: 'payment_not_found', paymentReference: null };
      }

      const [booking] = await tx.execute(raw`
        select 1 as present from bookings.bookings where payment_id = ${payment.id}::uuid limit 1`);
      const existing = await tx
        .select({
          statusCode: refunds.statusCode,
          amountMinor: refunds.amountMinor,
          attempt: refunds.attempt,
        })
        .from(refunds)
        .where(eq(refunds.paymentId, payment.id));

      let succeededRefundMinor = 0n;
      let unsettledRefundMinor = 0n;
      let lastAttempt = 0;
      for (const row of existing) {
        lastAttempt = Math.max(lastAttempt, row.attempt);
        if (row.statusCode === 'succeeded') succeededRefundMinor += row.amountMinor;
        if ((UNSETTLED_REFUND_STATUSES as readonly string[]).includes(row.statusCode)) {
          unsettledRefundMinor += row.amountMinor;
        }
      }

      const decision = decideRefund({
        paymentStatus: payment.statusCode,
        hasProviderPayment: payment.providerPaymentIntentId !== null,
        totalChargedMinor: payment.totalChargedMinor,
        refundRequired: payment.refundRequiredAt !== null,
        hasBooking: booking !== undefined,
        succeededRefundMinor,
        unsettledRefundMinor,
      });
      if (!decision.allowed) {
        return {
          status: 'refused',
          refusal: decision.refusal,
          paymentReference: payment.reference,
        };
      }

      const attempt = lastAttempt + 1;
      const idempotencyKey = refundIdempotencyKey(payment.id, attempt);
      const [row] = await tx
        .insert(refunds)
        .values({
          paymentId: payment.id,
          attempt,
          reasonCode: input.reasonCode,
          amountMinor: decision.amountMinor,
          currencyCode: payment.currencyCode,
          statusCode: 'requested',
          provider: payment.provider,
          idempotencyKey,
          requestedByUserId: input.requestedByUserId ?? null,
          requestedAt: now,
        })
        .returning({ id: refunds.id, reference: refunds.reference });
      if (row === undefined) throw new Error('refund insert returned no row');

      await tx.insert(statusTransitions).values({
        entityType: 'refund',
        entityId: row.id,
        fromStatusCode: null,
        toStatusCode: 'requested',
        actorUserId: input.requestedByUserId ?? null,
        reasonCode: input.reasonCode,
        correlationId: input.correlationId,
        occurredAt: now,
      });
      await tx.insert(auditEvents).values({
        category: 'financial',
        action: 'payment.refund_requested',
        entityType: 'payment',
        entityId: payment.id,
        actorUserId: input.requestedByUserId ?? null,
        correlationId: input.correlationId,
        occurredAt: now,
        // Ids and amounts. No people: this row is read by finance, not support.
        newValue: {
          refundId: row.id,
          reasonCode: input.reasonCode,
          amountMinor: decision.amountMinor.toString(),
          currencyCode: payment.currencyCode,
          attempt,
        },
        riskLevel: 'high',
      });

      return {
        status: 'started',
        refund: {
          refundId: row.id,
          reference: row.reference,
          paymentId: payment.id,
          paymentReference: payment.reference,
          providerPaymentIntentId: payment.providerPaymentIntentId!,
          amountMinor: decision.amountMinor,
          currencyCode: payment.currencyCode,
          idempotencyKey,
          attempt,
        },
      };
    });
  } finally {
    await client.end();
  }
}

export interface RecordRefundOutcomeInput {
  readonly refundId: string;
  /** The provider's own status, untouched. Mapped to Studdy's here, failing safe. */
  readonly providerStatus: string;
  readonly providerRefundId: string | null;
  readonly failureCode: string | null;
  readonly correlationId: string;
  readonly now?: Date;
}

/**
 * What recording an answer did. `unchanged` is ORDINARY: a pending refund asked
 * about again and still pending, or an answer that arrives after a terminal one.
 */
export type RefundOutcome = 'succeeded' | 'pending' | 'failed' | 'unchanged' | 'refund_not_found';

/**
 * Record what the provider said about a refund.
 *
 * GUARDED ON THE STATE IT EXPECTS, like every other write in the money path: the
 * row is locked, a terminal refund is never moved again, and a move the state
 * machine forbids is `unchanged` rather than an error. So a redelivered answer,
 * a reconcile pass racing the original caller, and an out-of-order read are all
 * harmless by construction.
 *
 * THE FAMILY IS TOLD, ONCE. The first time a refund reaches `pending` or
 * `succeeded` — the provider has accepted it — a `payment.refunded` outbox entry
 * is written in the same transaction, keyed by the refund id so a re-run cannot
 * write a second. A failure raises a high-risk audit row and an ops alert
 * instead, and tells the family nothing, because nothing has happened to their
 * money yet.
 */
export async function recordRefundOutcome(input: RecordRefundOutcomeInput): Promise<RefundOutcome> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx): Promise<RefundOutcome> => {
      const [refund] = await tx
        .select()
        .from(refunds)
        .where(eq(refunds.id, input.refundId))
        .limit(1)
        .for('update');
      if (refund === undefined) return 'refund_not_found';

      const from = refund.statusCode as RefundStatus;
      if (isTerminalRefundStatus(from)) return 'unchanged';

      const to = studdyRefundStatusFor(input.providerStatus);

      /*
       * TELL THE FAMILY, AT MOST ONCE, AND ONLY ON A POSITIVE ACCEPTANCE.
       *
       * Keyed by the refund id with ON CONFLICT DO NOTHING, so however many
       * answers report acceptance — the original caller, the sweep, a retry —
       * exactly one email is ever written. Called only when the provider's own
       * status says accepted: an unrecognised status is recorded as pending so
       * the sweep keeps asking, but must not become a promise to a family.
       */
      const tellFamilyOnce = async (): Promise<void> => {
        if (!providerAcceptedRefund(input.providerStatus)) return;
        const [payment] = await tx
          .select({ id: payments.id, tutorRequestId: payments.tutorRequestId })
          .from(payments)
          .where(eq(payments.id, refund.paymentId))
          .limit(1);
        if (payment === undefined) return;
        await tx
          .insert(outboxEntries)
          .values({
            eventType: 'payment.refunded',
            payload: {
              tutorRequestId: payment.tutorRequestId,
              paymentId: payment.id,
              refundId: refund.id,
            },
            idempotencyKey: `payment.refunded:${refund.id}`,
            correlationId: input.correlationId,
          })
          .onConflictDoNothing();
      };

      // pending → pending is the reconcile pass asking again: record the provider
      // ids if they have just arrived, but it is not a transition.
      if (to === from) {
        if (
          to === 'pending' &&
          refund.providerRefundId === null &&
          input.providerRefundId !== null
        ) {
          await tx
            .update(refunds)
            .set({
              providerRefundId: input.providerRefundId,
              providerStatus: input.providerStatus,
              updatedAt: now,
            })
            .where(and(eq(refunds.id, refund.id), eq(refunds.statusCode, from)));
        }
        // An explicit acceptance after an earlier unrecognised answer is still
        // the first time the provider has actually said yes.
        if (to === 'pending' && (refund.providerRefundId ?? input.providerRefundId) !== null) {
          await tellFamilyOnce();
        }
        return 'unchanged';
      }
      if (!canTransitionRefund(from, to)) return 'unchanged';

      /*
       * A REFUND CANNOT BE ACCEPTED WITHOUT A PROVIDER REFUND ID. The database
       * refuses `pending` and `succeeded` without one (`refund_provider_answered_
       * check`), so an answer that carries none is left for the sweep to ask
       * about again rather than thrown at the constraint — which would roll back
       * the whole recording and lose the answer along with it.
       */
      const providerRefundId = input.providerRefundId ?? refund.providerRefundId;
      if (to !== 'failed' && providerRefundId === null) return 'unchanged';

      const terminal = to === 'succeeded' || to === 'failed';
      const [moved] = await tx
        .update(refunds)
        .set({
          statusCode: to,
          providerRefundId,
          providerStatus: input.providerStatus,
          failureCode: to === 'failed' ? input.failureCode : null,
          completedAt: terminal ? now : null,
          updatedAt: now,
        })
        .where(and(eq(refunds.id, refund.id), eq(refunds.statusCode, from)))
        .returning({ id: refunds.id });
      if (moved === undefined) return 'unchanged';

      await tx.insert(statusTransitions).values({
        entityType: 'refund',
        entityId: refund.id,
        fromStatusCode: from,
        toStatusCode: to,
        actorUserId: null,
        reasonCode: to === 'failed' ? 'provider_refund_failed' : 'provider_refund_accepted',
        correlationId: input.correlationId,
        occurredAt: now,
      });

      await tx.insert(auditEvents).values({
        category: 'financial',
        action: to === 'failed' ? 'payment.refund_failed' : `payment.refund_${to}`,
        entityType: 'payment',
        entityId: refund.paymentId,
        actorUserId: null,
        correlationId: input.correlationId,
        occurredAt: now,
        newValue: {
          refundId: refund.id,
          amountMinor: refund.amountMinor.toString(),
          currencyCode: refund.currencyCode,
          ...(to === 'failed' ? { failureCode: input.failureCode } : {}),
        },
        riskLevel: to === 'failed' ? 'high' : 'medium',
      });

      if (to === 'failed') {
        await tx.insert(outboxEntries).values({
          eventType: 'payment.refund_failed',
          payload: {
            paymentId: refund.paymentId,
            refundId: refund.id,
            reason: input.failureCode ?? 'The provider did not accept the refund.',
          },
          idempotencyKey: `payment.refund_failed:${refund.id}`,
          correlationId: input.correlationId,
        });
        return 'failed';
      }

      await tellFamilyOnce();
      return to === 'succeeded' ? 'succeeded' : 'pending';
    });
  } finally {
    await client.end();
  }
}

/** A refund the reconcile pass still has to resolve. */
export interface UnsettledRefund {
  readonly refundId: string;
  readonly statusCode: 'requested' | 'pending';
  readonly providerRefundId: string | null;
  readonly paymentId: string;
  readonly providerPaymentIntentId: string;
  readonly amountMinor: bigint;
  readonly idempotencyKey: string;
}

/**
 * Refunds whose answer Studdy has not recorded.
 *
 * A `requested` row is only returned once it is `graceSeconds` old: the original
 * caller is almost certainly still in the middle of its provider call, and a
 * reconcile pass that raced it would do correct but pointless work. `pending`
 * rows have no such wait — the provider already accepted them and is settling.
 *
 * Server-only, ids and money, no people.
 */
export async function unsettledRefunds(input: {
  readonly limit?: number;
  readonly graceSeconds?: number;
  readonly now?: Date;
}): Promise<readonly UnsettledRefund[]> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  const cutoff = new Date(now.getTime() - (input.graceSeconds ?? 120) * 1000);
  try {
    const rows = await db
      .select({
        refundId: refunds.id,
        statusCode: refunds.statusCode,
        providerRefundId: refunds.providerRefundId,
        paymentId: refunds.paymentId,
        providerPaymentIntentId: payments.providerPaymentIntentId,
        amountMinor: refunds.amountMinor,
        idempotencyKey: refunds.idempotencyKey,
      })
      .from(refunds)
      .innerJoin(payments, eq(payments.id, refunds.paymentId))
      .where(
        or(
          eq(refunds.statusCode, 'pending'),
          and(eq(refunds.statusCode, 'requested'), lt(refunds.requestedAt, cutoff)),
        ),
      )
      .orderBy(asc(refunds.requestedAt))
      .limit(input.limit ?? 50);

    return rows.flatMap((row) =>
      row.providerPaymentIntentId === null
        ? []
        : [
            {
              refundId: row.refundId,
              statusCode: row.statusCode as 'requested' | 'pending',
              providerRefundId: row.providerRefundId,
              paymentId: row.paymentId,
              providerPaymentIntentId: row.providerPaymentIntentId,
              amountMinor: row.amountMinor,
              idempotencyKey: row.idempotencyKey,
            },
          ],
    );
  } finally {
    await client.end();
  }
}

/** What an operator needs to see, and nothing else. */
export interface RefundReport {
  readonly awaitingRefund: readonly {
    readonly paymentReference: string;
    readonly amountMinor: bigint;
    readonly currencyCode: string;
    readonly flaggedAt: Date;
  }[];
  readonly byStatus: Readonly<Record<string, number>>;
}

/**
 * The refund picture: payments flagged for refund that nobody has started, and
 * how many refunds sit in each status. Read-only, and the same `decideRefund`
 * rule the executor applies — so the report cannot list a payment the executor
 * would refuse for a reason the report did not check.
 */
export async function refundReport(input: { readonly limit?: number } = {}): Promise<RefundReport> {
  const { sql: client, db } = createDatabaseClient();
  try {
    const awaiting = await db.execute(raw`
      select p.reference, p.total_charged_minor, p.currency_code, p.refund_required_at
      from payments.payments p
      where p.status_code = 'succeeded'
        and p.refund_required_at is not null
        and p.provider_payment_intent_id is not null
        and not exists (select 1 from bookings.bookings b where b.payment_id = p.id)
        and not exists (
          select 1 from payments.refunds r
          where r.payment_id = p.id and r.status_code in ('requested', 'pending', 'succeeded'))
      order by p.refund_required_at asc
      limit ${input.limit ?? 100}`);

    const counts = await db
      .select({ statusCode: refunds.statusCode, n: raw<number>`count(*)::int` })
      .from(refunds)
      .groupBy(refunds.statusCode);

    return {
      awaitingRefund: (awaiting as unknown as Record<string, unknown>[]).map((row) => ({
        paymentReference: row['reference'] as string,
        amountMinor: BigInt(row['total_charged_minor'] as string),
        currencyCode: row['currency_code'] as string,
        flaggedAt: new Date(row['refund_required_at'] as string),
      })),
      byStatus: Object.fromEntries(counts.map((row) => [row.statusCode, row.n])),
    };
  } finally {
    await client.end();
  }
}
