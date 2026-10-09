import { and, eq, sql as raw } from 'drizzle-orm';
import {
  asCapabilityStatus,
  decideSettlement,
  transferIdempotencyKey,
  type SettlementDecision,
} from '@studdy/domain/payments';
import { createDatabaseClient } from '../client';
import {
  auditEvents,
  connectedAccounts,
  payments,
  statusTransitions,
  tutorTransfers,
} from '../schema/index';

/**
 * SETTLEMENT — paying a tutor their share.
 *
 * THE LEDGER STILL DOES NOT KNOW STRIPE. This file decides and records; the
 * provider call is the web layer's job, exactly as for payments and refunds.
 *
 * THE OBLIGATION ALREADY EXISTS. The fulfilment transaction wrote a `pending`
 * `tutor_transfers` row the moment the booking was confirmed, with its own
 * idempotency key, so settlement is not "create a payment" but "send what was
 * already recorded as owed". There is nothing to invent here, and nothing to
 * recompute: the amount is the entitlement the payment snapshotted.
 *
 * ELIGIBILITY IS ONE PURE RULE, `decideSettlement`, applied to facts read here.
 * The operator's report and the run that moves money both read these candidates
 * and apply the same rule, so they cannot disagree about what is owed.
 */

/** One obligation, with the rule's verdict on it. Ids and money; no people. */
export interface SettlementCandidate {
  readonly transferId: string;
  readonly idempotencyKey: string;
  readonly amountMinor: bigint;
  readonly currencyCode: string;
  readonly paymentId: string;
  readonly paymentReference: string;
  /** The tutor's `TUT-` reference: a support handle, not a name. */
  readonly tutorReference: string;
  /** Where the money goes. From Studdy's own row, never from a caller. */
  readonly providerAccountId: string;
  readonly providerChargeId: string | null;
  readonly lessonEndsAt: Date | null;
  readonly decision: SettlementDecision;
}

/**
 * The pending obligations and the facts the rule needs, in one query.
 *
 * `transferId` narrows it to a single obligation, which is how the run RE-CHECKS
 * an item immediately before sending it: a refund flagged, a booking cancelled
 * or a tutor restricted between the report and the send is seen, not assumed
 * away.
 *
 * Times and money are read as TEXT and parsed here. The lesson end is returned
 * as epoch milliseconds, so there is no timestamp string for the driver or the
 * runtime to interpret differently.
 */
async function loadCandidates(input: {
  readonly now: Date;
  readonly transferId: string | null;
  readonly limit: number;
}): Promise<SettlementCandidate[]> {
  const { sql: client, db } = createDatabaseClient();
  try {
    const rows = (await db.execute(raw`
      select t.id as transfer_id, t.idempotency_key, t.amount_minor::text as amount_minor,
             t.currency_code, t.status_code as transfer_status,
             p.id as payment_id, p.reference as payment_reference,
             p.status_code as payment_status, p.provider_charge_id,
             (p.refund_required_at is not null) as refund_required,
             exists (
               select 1 from payments.refunds r
               where r.payment_id = p.id and r.status_code in ('requested', 'pending', 'succeeded')
             ) as has_live_refund,
             tp.reference as tutor_reference,
             ca.provider_account_id, (ca.archived_at is not null) as account_archived,
             ca.transfers_capability_code, ca.payouts_capability_code,
             b.status_code as booking_status,
             (extract(epoch from b.scheduled_end_at) * 1000)::bigint::text as lesson_ends_ms
      from payments.tutor_transfers t
      join payments.payments p on p.id = t.payment_id
      join tutors.tutor_profiles tp on tp.id = t.tutor_profile_id
      join payments.connected_accounts ca on ca.id = t.connected_account_id
      left join bookings.bookings b on b.payment_id = p.id
      where t.status_code = 'pending'
        and (${input.transferId}::uuid is null or t.id = ${input.transferId}::uuid)
      order by t.created_at asc, t.id asc
      limit ${input.limit}`)) as unknown as Record<string, unknown>[];

    return rows.map((row) => {
      const lessonEndsAt =
        row['lesson_ends_ms'] === null ? null : new Date(Number(row['lesson_ends_ms'] as string));
      // An account that has been replaced is not somewhere to send money.
      const archived = row['account_archived'] === true;
      return {
        transferId: row['transfer_id'] as string,
        idempotencyKey: row['idempotency_key'] as string,
        amountMinor: BigInt(row['amount_minor'] as string),
        currencyCode: row['currency_code'] as string,
        paymentId: row['payment_id'] as string,
        paymentReference: row['payment_reference'] as string,
        tutorReference: row['tutor_reference'] as string,
        providerAccountId: row['provider_account_id'] as string,
        providerChargeId: (row['provider_charge_id'] as string | null) ?? null,
        lessonEndsAt,
        decision: decideSettlement({
          transferStatus: row['transfer_status'] as string,
          paymentStatus: row['payment_status'] as string,
          refundRequired: row['refund_required'] === true,
          hasLiveRefund: row['has_live_refund'] === true,
          providerChargeId: (row['provider_charge_id'] as string | null) ?? null,
          bookingStatus: (row['booking_status'] as string | null) ?? null,
          lessonEndsAt,
          transfersCapability: archived
            ? 'unsupported'
            : asCapabilityStatus(row['transfers_capability_code'] as string),
          payoutsCapability: archived
            ? 'unsupported'
            : asCapabilityStatus(row['payouts_capability_code'] as string),
          now: input.now,
        }),
      };
    });
  } finally {
    await client.end();
  }
}

/** Every pending obligation, oldest first, each with the rule's verdict. */
export async function settlementCandidates(input: {
  readonly now?: Date;
  readonly limit?: number;
}): Promise<readonly SettlementCandidate[]> {
  return loadCandidates({
    now: input.now ?? new Date(),
    transferId: null,
    limit: input.limit ?? 500,
  });
}

/** One obligation, freshly read — the re-check made immediately before sending. */
export async function settlementCandidate(
  transferId: string,
  now: Date = new Date(),
): Promise<SettlementCandidate | null> {
  const [candidate] = await loadCandidates({ now, transferId, limit: 1 });
  return candidate ?? null;
}

export type TransferOutcome = 'sent' | 'failed' | 'unchanged' | 'not_found';

/**
 * Record that the provider accepted the transfer.
 *
 * GUARDED ON `pending`, like every write in the money path: two runs racing the
 * same obligation, or a run racing the recovery of an earlier one, produce one
 * transition and one `unchanged`. A `sent` transfer is never moved again.
 */
export async function recordTransferSent(input: {
  readonly transferId: string;
  readonly providerTransferId: string;
  readonly correlationId: string;
  readonly now?: Date;
}): Promise<TransferOutcome> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx): Promise<TransferOutcome> => {
      const [moved] = await tx
        .update(tutorTransfers)
        .set({
          statusCode: 'sent',
          providerTransferId: input.providerTransferId,
          sentAt: now,
          failureNote: null,
          updatedAt: now,
        })
        .where(
          and(eq(tutorTransfers.id, input.transferId), eq(tutorTransfers.statusCode, 'pending')),
        )
        .returning({
          id: tutorTransfers.id,
          paymentId: tutorTransfers.paymentId,
          amountMinor: tutorTransfers.amountMinor,
          currencyCode: tutorTransfers.currencyCode,
        });

      if (moved === undefined) {
        const [existing] = await tx
          .select({ id: tutorTransfers.id })
          .from(tutorTransfers)
          .where(eq(tutorTransfers.id, input.transferId))
          .limit(1);
        return existing === undefined ? 'not_found' : 'unchanged';
      }

      await tx.insert(statusTransitions).values({
        entityType: 'tutor_transfer',
        entityId: moved.id,
        fromStatusCode: 'pending',
        toStatusCode: 'sent',
        actorUserId: null,
        reasonCode: 'settlement_run',
        correlationId: input.correlationId,
        occurredAt: now,
      });
      await tx.insert(auditEvents).values({
        category: 'financial',
        action: 'tutor_transfer.sent',
        entityType: 'tutor_transfer',
        entityId: moved.id,
        actorUserId: null,
        correlationId: input.correlationId,
        occurredAt: now,
        // Ids and amounts. No people: this row is read by finance, not support.
        newValue: {
          paymentId: moved.paymentId,
          amountMinor: moved.amountMinor.toString(),
          currencyCode: moved.currencyCode,
        },
        riskLevel: 'medium',
      });
      return 'sent';
    });
  } finally {
    await client.end();
  }
}

/**
 * Record that the provider DEFINITIVELY refused the transfer.
 *
 * The family's money is unaffected — it is still in Studdy's balance — but the
 * tutor is owed it and has not been paid, so this raises a high-risk audit event
 * and takes the obligation out of the queue until a person decides what to do.
 * Only a definitive refusal reaches here; an unanswered request leaves the
 * obligation `pending`.
 */
export async function recordTransferFailed(input: {
  readonly transferId: string;
  readonly failureCode: string | null;
  readonly correlationId: string;
  readonly now?: Date;
}): Promise<TransferOutcome> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx): Promise<TransferOutcome> => {
      const [moved] = await tx
        .update(tutorTransfers)
        .set({
          statusCode: 'failed',
          failureNote: input.failureCode ?? 'The provider refused the transfer.',
          updatedAt: now,
        })
        .where(
          and(eq(tutorTransfers.id, input.transferId), eq(tutorTransfers.statusCode, 'pending')),
        )
        .returning({
          id: tutorTransfers.id,
          paymentId: tutorTransfers.paymentId,
          amountMinor: tutorTransfers.amountMinor,
          currencyCode: tutorTransfers.currencyCode,
        });

      if (moved === undefined) {
        const [existing] = await tx
          .select({ id: tutorTransfers.id })
          .from(tutorTransfers)
          .where(eq(tutorTransfers.id, input.transferId))
          .limit(1);
        return existing === undefined ? 'not_found' : 'unchanged';
      }

      await tx.insert(statusTransitions).values({
        entityType: 'tutor_transfer',
        entityId: moved.id,
        fromStatusCode: 'pending',
        toStatusCode: 'failed',
        actorUserId: null,
        reasonCode: 'provider_transfer_refused',
        correlationId: input.correlationId,
        occurredAt: now,
      });
      await tx.insert(auditEvents).values({
        category: 'financial',
        action: 'tutor_transfer.failed',
        entityType: 'tutor_transfer',
        entityId: moved.id,
        actorUserId: null,
        correlationId: input.correlationId,
        occurredAt: now,
        newValue: {
          paymentId: moved.paymentId,
          amountMinor: moved.amountMinor.toString(),
          currencyCode: moved.currencyCode,
          failureCode: input.failureCode,
        },
        riskLevel: 'high',
      });
      return 'failed';
    });
  } finally {
    await client.end();
  }
}

export type RequeueResult =
  | { readonly status: 'requeued'; readonly transferId: string; readonly idempotencyKey: string }
  | {
      readonly status: 'refused';
      readonly refusal: 'payment_not_found' | 'nothing_to_requeue' | 'no_payout_account';
    };

/**
 * Put a FAILED obligation back in the queue, as a new one.
 *
 * A failed transfer is terminal, so the retry is a NEW row with the next
 * idempotency key — the provider may replay the cached outcome of the old key,
 * and a new attempt must not be mistaken for the one that failed. The payment is
 * locked for the decision, so two operators requeuing at once produce one row,
 * and the live-obligation unique index is the backstop.
 *
 * Refused unless the latest obligation FAILED and nothing is pending or sent for
 * the payment. The destination is the failed row's account unless it has been
 * replaced, in which case it is the tutor's current one; with neither, refused.
 */
export async function requeueFailedTransfer(input: {
  readonly paymentReference: string;
  readonly correlationId: string;
  readonly now?: Date;
}): Promise<RequeueResult> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx): Promise<RequeueResult> => {
      const [payment] = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(eq(payments.reference, input.paymentReference))
        .limit(1)
        .for('update');
      if (payment === undefined) return { status: 'refused', refusal: 'payment_not_found' };

      const existing = await tx
        .select()
        .from(tutorTransfers)
        .where(eq(tutorTransfers.paymentId, payment.id))
        .orderBy(tutorTransfers.createdAt);
      const latest = existing[existing.length - 1];
      const live = existing.some(
        (row) => row.statusCode === 'pending' || row.statusCode === 'sent',
      );
      if (latest === undefined || latest.statusCode !== 'failed' || live) {
        return { status: 'refused', refusal: 'nothing_to_requeue' };
      }

      const [previous] = await tx
        .select({ id: connectedAccounts.id, archivedAt: connectedAccounts.archivedAt })
        .from(connectedAccounts)
        .where(eq(connectedAccounts.id, latest.connectedAccountId))
        .limit(1);
      let accountId = previous !== undefined && previous.archivedAt === null ? previous.id : null;
      if (accountId === null) {
        const [current] = await tx.execute(raw`
          select id from payments.connected_accounts
          where tutor_profile_id = ${latest.tutorProfileId}::uuid and archived_at is null
          limit 1`);
        accountId = current === undefined ? null : (current['id'] as string);
      }
      if (accountId === null) return { status: 'refused', refusal: 'no_payout_account' };

      const idempotencyKey = transferIdempotencyKey(payment.id, existing.length + 1);
      const [created] = await tx
        .insert(tutorTransfers)
        .values({
          paymentId: payment.id,
          tutorProfileId: latest.tutorProfileId,
          connectedAccountId: accountId,
          amountMinor: latest.amountMinor,
          currencyCode: latest.currencyCode,
          statusCode: 'pending',
          idempotencyKey,
        })
        .returning({ id: tutorTransfers.id });
      if (created === undefined) throw new Error('transfer insert returned no row');

      await tx.insert(statusTransitions).values({
        entityType: 'tutor_transfer',
        entityId: created.id,
        fromStatusCode: null,
        toStatusCode: 'pending',
        actorUserId: null,
        reasonCode: 'requeued_after_failure',
        correlationId: input.correlationId,
        occurredAt: now,
      });
      await tx.insert(auditEvents).values({
        category: 'financial',
        action: 'tutor_transfer.requeued',
        entityType: 'tutor_transfer',
        entityId: created.id,
        actorUserId: null,
        correlationId: input.correlationId,
        occurredAt: now,
        newValue: { paymentId: payment.id, replaces: latest.id },
        riskLevel: 'high',
      });
      return { status: 'requeued', transferId: created.id, idempotencyKey };
    });
  } finally {
    await client.end();
  }
}
