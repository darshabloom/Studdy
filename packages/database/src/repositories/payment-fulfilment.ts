import { and, eq, inArray, isNull, sql as raw } from 'drizzle-orm';
import { createDatabaseClient } from '../client';
import {
  auditEvents,
  connectedAccounts,
  domainEvents,
  intendedLessonRequests,
  outboxEntries,
  paymentEvents,
  payments,
  statusTransitions,
  tutorTimeReservations,
  tutorTransfers,
} from '../schema/index';

/**
 * FULFILMENT — where a provider's "the money arrived" becomes Studdy's "this
 * lesson is booked".
 *
 * THE LEDGER STILL DOES NOT KNOW STRIPE. `@studdy/database` does not depend on
 * `@studdy/integrations`, exactly as slice 5 established. What crosses this
 * boundary is a provider-neutral `AuthoritativeIntent` — an id, a status, minor
 * units, an upper-case currency, a couple of provider references — and every
 * decision made from it is made here, against Studdy's own snapshot.
 *
 * FOUR RECORDS MOVE, OR NONE DO. A confirmed booking is the ILR at `fulfilled`,
 * the reservation at `booking_confirmed`, the payment at `succeeded` and a
 * transfer obligation to the tutor. Those are one fact wearing four hats, so
 * they are written in ONE transaction. A partial fulfilment is the failure this
 * file exists to make unrepresentable: a paid parent with a released slot, or a
 * confirmed booking with nothing owed to the tutor, are both worse than an
 * error.
 *
 * IDEMPOTENCY IS FIVE LAYERS DEEP, AND FOUR OF THEM ARE THE DATABASE:
 *
 *   1. `payment_events.provider_event_id` is UNIQUE — a redelivered event
 *      collides on insert and never reaches the transaction at all;
 *   2. the payment row is taken `FOR UPDATE`, so two workers racing the same
 *      success serialise rather than interleave;
 *   3. every write is `WHERE status_code = <expected>` — zero rows means
 *      somebody already did it, which is SUCCESS and not an error;
 *   4. `tutor_transfer_live_per_payment_unique_idx` and the unique
 *      `idempotency_key` make a second obligation for one payment
 *      unrepresentable even to a hand-run INSERT;
 *   5. `succeeded` is terminal in the payment transition map, and every other
 *      handler excludes it from its guard — so a stale `failed`, `processing`
 *      or `canceled` arriving late cannot regress a paid booking.
 *
 * NOTHING HERE TRUSTS AN EVENT PAYLOAD. The caller has already re-read the
 * PaymentIntent from the provider; this file then re-reads Studdy's own
 * immutable snapshot and refuses unless the two agree on amount and currency.
 */

/** What the provider authoritatively says, in Studdy's own units. */
export interface AuthoritativeIntent {
  readonly providerPaymentIntentId: string;
  readonly status: string;
  readonly livemode: boolean;
  readonly amountReceivedMinor: bigint;
  readonly currencyCode: string;
  readonly chargeId: string | null;
  readonly balanceTransactionId: string | null;
  /** Null unless the provider supplied a real figure. NEVER estimated. */
  readonly providerCostMinor: bigint | null;
  readonly lastFailureCode: string | null;
  /** The Studdy payment id the provider was told to carry. Correlation only. */
  readonly studdyPaymentId: string | null;
}

/**
 * What happened, in terms an operator can act on.
 *
 * `duplicate`, `already_fulfilled` and `ignored` are all ORDINARY. Retries and
 * out-of-order delivery are how webhooks normally behave, and a vocabulary that
 * called them failures would bury the two outcomes that genuinely need a human.
 */
export type FulfilmentOutcome =
  /** The booking was confirmed by this delivery. */
  | 'fulfilled'
  /** This exact provider event was already recorded. Nothing was re-read. */
  | 'duplicate'
  /** Already succeeded — a retry, or the loser of a race. Correct, not an error. */
  | 'already_fulfilled'
  /** A non-success event that changed a status. */
  | 'applied'
  /** A non-success event that matched no row to change. Normal. */
  | 'ignored'
  /** No Studdy payment holds this PaymentIntent. Recorded, never guessed at. */
  | 'unknown_payment'
  /** OPS: the provider and the snapshot disagree on money. Nothing fulfilled. */
  | 'amount_mismatch'
  | 'currency_mismatch'
  /** OPS: real money, and a booking that can no longer be confirmed. */
  | 'fulfilment_blocked';

export interface ApplyPaymentEventInput {
  readonly provider: string;
  readonly providerEventId: string;
  readonly eventType: string;
  /*
   * THERE IS NO EVENT TIMESTAMP HERE, and its absence is the design.
   *
   * The Connect handler needs one because it guards on ordering. This one does
   * not: every write is guarded on the STATE it expects to find, so a stale
   * delivery matches zero rows whatever its timestamp says. Accepting a
   * timestamp and not reading it would be worse than not having one — the next
   * reader would assume it was doing something.
   */
  /** Already reduced by the caller. NEVER a raw provider payload. */
  readonly redactedPayload: unknown;
  readonly authoritative: AuthoritativeIntent;
  readonly correlationId: string;
  readonly now?: Date;
}

/** Statuses a payment may still move out of. `succeeded` is deliberately absent. */
const OPEN_PAYMENT_STATUSES = ['requires_payment', 'processing'] as const;

/**
 * Apply one verified provider payment event.
 *
 * THE EVENT LEDGER IS WRITTEN FIRST, and its unique constraint is the outermost
 * idempotency guarantee. A colliding insert means Stripe is retrying: say yes,
 * change nothing, and never re-run a fulfilment that already happened.
 */
export async function applyPaymentProviderEvent(
  input: ApplyPaymentEventInput,
): Promise<FulfilmentOutcome> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    const inserted = await db
      .insert(paymentEvents)
      .values({
        provider: input.provider,
        providerEventId: input.providerEventId,
        eventType: input.eventType,
        payload: input.redactedPayload as never,
        statusCode: 'received',
        receivedAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: paymentEvents.id });

    // Already seen. The provider is retrying; this is the normal case.
    if (inserted.length === 0) return 'duplicate';
    const eventRowId = inserted[0]!.id;

    const result = await db.transaction(
      async (
        tx,
      ): Promise<{ outcome: FulfilmentOutcome; paymentId: string | null; note: string | null }> => {
        /*
         * CORRELATION IS BY PROVIDER PAYMENT INTENT ID, and the metadata is
         * only ever a cross-check.
         *
         * `provider_payment_intent_id` is UNIQUE on `payments` and was written
         * by Studdy when it created the intent, so this lookup can match at
         * most one row and cannot be steered by anything in an event. The
         * metadata Studdy attached is compared afterwards; it is corroboration,
         * never the thing that chooses the row.
         *
         * `FOR UPDATE` is what makes two workers racing the same success
         * converge: the second blocks here and then finds the status already
         * moved, rather than reading a stale row and writing over the winner.
         */
        const [payment] = await tx
          .select()
          .from(payments)
          .where(eq(payments.providerPaymentIntentId, input.authoritative.providerPaymentIntentId))
          .limit(1)
          .for('update');

        if (payment === undefined) {
          return {
            outcome: 'unknown_payment',
            paymentId: null,
            note: 'No Studdy payment holds this provider payment intent.',
          };
        }

        /*
         * The metadata cross-check. A mismatch means the intent Studdy is
         * looking at is not the intent Studdy created for this row — a
         * misconfigured account, a copied id, or something worse. Refuse.
         */
        const claimed = input.authoritative.studdyPaymentId;
        if (claimed !== null && claimed !== payment.id) {
          return {
            outcome: 'unknown_payment',
            paymentId: payment.id,
            note: 'Provider metadata names a different Studdy payment.',
          };
        }

        switch (input.eventType) {
          case 'payment_intent.succeeded':
            return await applySucceeded(tx, payment, input, now);
          case 'payment_intent.processing':
            return await applyProcessing(tx, payment, input, now);
          case 'payment_intent.payment_failed':
            return await applyFailed(tx, payment, input, now);
          case 'payment_intent.canceled':
            return await applyCancelled(tx, payment, input, now);
          default:
            return { outcome: 'ignored', paymentId: payment.id, note: 'Event type not handled.' };
        }
      },
    );

    /*
     * The event's own disposition. `failed` is reserved for the outcomes that
     * need a human — a money mismatch, or a booking that could not be confirmed
     * for a payment that genuinely succeeded — so the retry drain and an
     * operator reading this table see the same two things.
     */
    const eventStatus = OPS_OUTCOMES.has(result.outcome)
      ? 'failed'
      : result.outcome === 'fulfilled' || result.outcome === 'applied'
        ? 'applied'
        : 'ignored';

    await db
      .update(paymentEvents)
      .set({
        statusCode: eventStatus,
        processedAt: now,
        paymentId: result.paymentId,
        errorNote: result.note,
        updatedAt: now,
      })
      .where(eq(paymentEvents.id, eventRowId));

    return result.outcome;
  } finally {
    await client.end();
  }
}

/** Outcomes that mean somebody has to look. Everything else is routine. */
const OPS_OUTCOMES = new Set<FulfilmentOutcome>([
  'amount_mismatch',
  'currency_mismatch',
  'fulfilment_blocked',
]);

type Tx = Parameters<
  Parameters<ReturnType<typeof createDatabaseClient>['db']['transaction']>[0]
>[0];
type PaymentRow = typeof payments.$inferSelect;
type Applied = { outcome: FulfilmentOutcome; paymentId: string | null; note: string | null };

/**
 * THE AUTHORITATIVE TRANSITION. Four records, one transaction, or none.
 */
async function applySucceeded(
  tx: Tx,
  payment: PaymentRow,
  input: ApplyPaymentEventInput,
  now: Date,
): Promise<Applied> {
  /*
   * ALREADY DONE IS A SUCCESS. A redelivered event whose first delivery
   * fulfilled the booking must change nothing — and because the payment reached
   * `succeeded` inside the same transaction that wrote the other three records,
   * this branch is also proof that those three exist.
   */
  if (payment.statusCode === 'succeeded') {
    return { outcome: 'already_fulfilled', paymentId: payment.id, note: null };
  }

  /*
   * A TERMINAL NON-SUCCESS THAT NOW REPORTS SUCCESS IS AN OPS EVENT, never a
   * silent correction. `failed`, `cancelled` and `expired` are terminal, and
   * money arriving against one of them means Studdy holds a parent's payment
   * for a lesson its own ledger has already closed.
   */
  if (!(OPEN_PAYMENT_STATUSES as readonly string[]).includes(payment.statusCode)) {
    await flagForRefund(
      tx,
      payment,
      input,
      now,
      `Payment was ${payment.statusCode} when success arrived.`,
    );
    return {
      outcome: 'fulfilment_blocked',
      paymentId: payment.id,
      note: `Provider reported success against a ${payment.statusCode} payment.`,
    };
  }

  /*
   * THE MONEY MUST MATCH THE IMMUTABLE SNAPSHOT, checked before a single
   * fulfilment write.
   *
   * `total_charged_minor` is what Studdy priced server-side from the service
   * version and never accepted from anybody; `amount_received` is what the
   * provider says actually arrived. If those disagree, the safe act is to
   * confirm nothing — a booking fulfilled on the wrong amount is a wrong
   * booking, and a tutor entitlement computed from a snapshot the payment did
   * not honour would send real money against a figure nobody agreed.
   */
  if (input.authoritative.amountReceivedMinor !== payment.totalChargedMinor) {
    return {
      outcome: 'amount_mismatch',
      paymentId: payment.id,
      note: 'Provider amount does not match the Studdy payment snapshot.',
    };
  }
  if (input.authoritative.currencyCode !== payment.currencyCode) {
    return {
      outcome: 'currency_mismatch',
      paymentId: payment.id,
      note: 'Provider currency does not match the Studdy payment snapshot.',
    };
  }

  /*
   * CAN THIS STILL BECOME A BOOKING? Asked before anything moves, because the
   * answer decides between two very different transactions.
   *
   * The ILR must still be `awaiting_payment` and the reservation must still be
   * live. Both are locked, so the expiry sweep cannot change them underneath
   * this transaction.
   */
  const [ilr] = await tx
    .select({ id: intendedLessonRequests.id, statusCode: intendedLessonRequests.statusCode })
    .from(intendedLessonRequests)
    .where(eq(intendedLessonRequests.id, payment.intendedLessonRequestId))
    .limit(1)
    .for('update');

  const [reservation] = await tx
    .select({ id: tutorTimeReservations.id })
    .from(tutorTimeReservations)
    .where(
      and(
        eq(tutorTimeReservations.tutorRequestId, payment.tutorRequestId),
        eq(tutorTimeReservations.statusCode, 'active'),
      ),
    )
    .limit(1)
    .for('update');

  /*
   * THE TUTOR'S PAYOUT ACCOUNT, read from Studdy's own row and nowhere else.
   *
   * `tutor_transfers.connected_account_id` is NOT NULL by design: a transfer
   * with no destination is a meaningless record, not an incomplete one. If the
   * account has gone, the obligation cannot be written honestly, so the whole
   * fulfilment takes the ops path rather than confirming a booking nobody could
   * ever be paid for.
   */
  const [account] = await tx
    .select({ id: connectedAccounts.id })
    .from(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.tutorProfileId, payment.tutorProfileId),
        isNull(connectedAccounts.archivedAt),
      ),
    )
    .limit(1);

  if (
    ilr === undefined ||
    ilr.statusCode !== 'awaiting_payment' ||
    reservation === undefined ||
    account === undefined
  ) {
    /*
     * LATE SUCCESS, OR A BOOKING THAT CANNOT BE PUT BACK TOGETHER.
     *
     * The family paid and the slot is gone — swept, closed, or the tutor's
     * payout account withdrawn. Studdy does the only honest thing: it records
     * that the money genuinely arrived, flags the payment for refund, and
     * CONFIRMS NOTHING. No ILR moves, no reservation changes, and no transfer
     * obligation is created, because there is no booking to owe a tutor for.
     *
     * THE DESIGN'S "RE-TAKE THE RESERVATION" BRANCH IS DELIBERATELY NOT
     * IMPLEMENTED HERE, and this is the one place slice 6 departs from
     * `payments-and-first-paid-booking.md` §8. Re-taking a released hold is
     * only half the problem: by the time the sweep has released it, the same
     * sweep has also closed the ILR, and `closed` is TERMINAL in the approved
     * ILR state machine — `closed → fulfilled` is not a transition. Confirming
     * from here would mean either resurrecting a terminal state or inventing a
     * new one, and the owner has already rejected expanding these machines.
     * That is a product decision, not something to improvise inside a webhook.
     * Slice 5's in-flight guard makes the window vanishingly small; when it is
     * hit, an operator sees it rather than a family silently losing money.
     */
    await flagForRefund(
      tx,
      payment,
      input,
      now,
      ilr === undefined || ilr.statusCode !== 'awaiting_payment'
        ? 'The request was no longer awaiting payment.'
        : reservation === undefined
          ? 'The reservation was already released.'
          : 'The tutor has no live payout account.',
    );
    return {
      outcome: 'fulfilment_blocked',
      paymentId: payment.id,
      note: 'Payment succeeded but the booking could not be confirmed. Flagged for refund.',
    };
  }

  // --- from here, all four records move together ---------------------------

  /*
   * 1. The payment. Guarded on the OPEN statuses, so a concurrent worker that
   *    got here first matches zero rows and this one reports `already_fulfilled`
   *    rather than writing over the winner.
   */
  const [succeeded] = await tx
    .update(payments)
    .set({
      statusCode: 'succeeded',
      succeededAt: now,
      provider: input.provider,
      providerChargeId: input.authoritative.chargeId,
      providerBalanceTransactionId: input.authoritative.balanceTransactionId,
      /*
       * THE PROVIDER'S OWN NUMBER, OR NOTHING. Written only when the provider
       * supplied a figure on this read — never modelled, never defaulted to
       * zero. An absent cost is honest; a plausible wrong one is not.
       */
      providerCostMinor: input.authoritative.providerCostMinor,
      updatedAt: now,
    })
    .where(
      and(eq(payments.id, payment.id), inArray(payments.statusCode, [...OPEN_PAYMENT_STATUSES])),
    )
    .returning({ id: payments.id });

  if (succeeded === undefined) {
    return { outcome: 'already_fulfilled', paymentId: payment.id, note: null };
  }

  /*
   * 2. The ILR. `awaiting_payment → fulfilled` — the transition the state
   *    machine has declared since the selection slice and nothing has ever
   *    written. Guarded, so it can happen exactly once.
   */
  const [fulfilledIlr] = await tx
    .update(intendedLessonRequests)
    .set({ statusCode: 'fulfilled', updatedAt: now })
    .where(
      and(
        eq(intendedLessonRequests.id, payment.intendedLessonRequestId),
        eq(intendedLessonRequests.statusCode, 'awaiting_payment'),
      ),
    )
    .returning({ id: intendedLessonRequests.id });

  // Locked above, so unreachable in practice; a rollback rather than a
  // half-written booking if it ever is.
  if (fulfilledIlr === undefined) {
    throw new Error('The request stopped awaiting payment inside the fulfilment transaction.');
  }

  /*
   * 3. The reservation becomes the booking. THE SAME ROW CARRIED FORWARD, which
   *    is what the schema comment anticipated from the beginning: the hold and
   *    the booking are one continuous claim on the tutor's calendar, so the
   *    GiST exclusion constraint never sees a gap it could let another family
   *    through. `expires_at` goes null — a confirmed booking does not lapse.
   *
   *    THE TUTOR REQUEST IS NOT TOUCHED. It stays `selected` for the life of the
   *    booking, exactly as the approved seven-status machine requires.
   */
  await tx
    .update(tutorTimeReservations)
    .set({
      reservationTypeCode: 'booking_confirmed',
      expiresAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(tutorTimeReservations.id, reservation.id),
        eq(tutorTimeReservations.statusCode, 'active'),
      ),
    );

  /*
   * 4. What Studdy now owes the tutor. Written from the PAYMENT SNAPSHOT — the
   *    entitlement computed server-side at pricing time — and never from
   *    anything the provider or a browser said. $40 charged, $4 Studdy fee,
   *    $36 owed: the transfer amount is `tutor_entitlement_minor`, verbatim.
   *
   *    `ON CONFLICT DO NOTHING` against the unique `idempotency_key`, so even a
   *    caller that reached here twice writes one obligation. NOTHING IS SENT:
   *    no Stripe Transfer, no payout, no settlement. This records the debt.
   */
  await tx
    .insert(tutorTransfers)
    .values({
      paymentId: payment.id,
      tutorProfileId: payment.tutorProfileId,
      connectedAccountId: account.id,
      amountMinor: payment.tutorEntitlementMinor,
      currencyCode: payment.currencyCode,
      statusCode: 'pending',
      idempotencyKey: `tutor-transfer:${payment.id}`,
    })
    .onConflictDoNothing();

  // --- the record of what happened -----------------------------------------

  await tx.insert(statusTransitions).values({
    entityType: 'payment',
    entityId: payment.id,
    fromStatusCode: payment.statusCode,
    toStatusCode: 'succeeded',
    actorUserId: null,
    reasonCode: 'provider_payment_succeeded',
    correlationId: input.correlationId,
    occurredAt: now,
  });
  await tx.insert(statusTransitions).values({
    entityType: 'intended_lesson_request',
    entityId: payment.intendedLessonRequestId,
    fromStatusCode: 'awaiting_payment',
    toStatusCode: 'fulfilled',
    actorUserId: null,
    reasonCode: 'payment_succeeded',
    correlationId: input.correlationId,
    occurredAt: now,
  });
  await tx.insert(auditEvents).values({
    category: 'financial',
    action: 'payment.succeeded',
    entityType: 'payment',
    entityId: payment.id,
    actorUserId: null,
    correlationId: input.correlationId,
    occurredAt: now,
    // Amounts and ids, no people. This row is read by finance, not by support.
    newValue: {
      totalChargedMinor: payment.totalChargedMinor.toString(),
      platformFeeAmountMinor: payment.platformFeeAmountMinor.toString(),
      tutorEntitlementMinor: payment.tutorEntitlementMinor.toString(),
      currencyCode: payment.currencyCode,
    },
    riskLevel: 'medium',
  });
  await tx.insert(domainEvents).values({
    eventType: 'booking.confirmed',
    entityType: 'intended_lesson_request',
    entityId: payment.intendedLessonRequestId,
    payload: { paymentId: payment.id, tutorRequestId: payment.tutorRequestId },
    correlationId: input.correlationId,
    occurredAt: now,
  });
  /*
   * Written now, sent later. Nothing drains the outbox until the Resend slice;
   * the entry belongs to the transaction that created the obligation rather
   * than to whatever eventually sends the email.
   */
  await tx.insert(outboxEntries).values({
    eventType: 'booking.confirmed',
    payload: {
      intendedLessonRequestId: payment.intendedLessonRequestId,
      tutorRequestId: payment.tutorRequestId,
    },
    idempotencyKey: `booking.confirmed:${payment.intendedLessonRequestId}`,
    correlationId: input.correlationId,
  });

  return { outcome: 'fulfilled', paymentId: payment.id, note: null };
}

/**
 * Money arrived, and the booking cannot be confirmed.
 *
 * The payment is still marked `succeeded`, because it DID succeed and a ledger
 * that says otherwise is a ledger that lies about real money. What makes it
 * visible is `refund_required_at` plus a high-risk audit row and an outbox
 * entry: a query answers "what are we holding that we should not be", and the
 * pending transfer is never created, so settlement cannot pay out against it.
 */
async function flagForRefund(
  tx: Tx,
  payment: PaymentRow,
  input: ApplyPaymentEventInput,
  now: Date,
  reason: string,
): Promise<void> {
  await tx
    .update(payments)
    .set({
      statusCode: 'succeeded',
      succeededAt: payment.succeededAt ?? now,
      provider: input.provider,
      providerChargeId: input.authoritative.chargeId,
      providerBalanceTransactionId: input.authoritative.balanceTransactionId,
      providerCostMinor: input.authoritative.providerCostMinor,
      refundRequiredAt: now,
      updatedAt: now,
    })
    .where(eq(payments.id, payment.id));

  await tx.insert(auditEvents).values({
    category: 'financial',
    action: 'payment.refund_required',
    entityType: 'payment',
    entityId: payment.id,
    actorUserId: null,
    correlationId: input.correlationId,
    occurredAt: now,
    newValue: { reason, totalChargedMinor: payment.totalChargedMinor.toString() },
    // The one thing in this slice that genuinely needs a person.
    riskLevel: 'high',
  });
  await tx.insert(outboxEntries).values({
    eventType: 'payment.refund_required',
    payload: { paymentId: payment.id, reason },
    idempotencyKey: `payment.refund_required:${payment.id}`,
    correlationId: input.correlationId,
  });
}

/**
 * An asynchronous confirmation is in flight.
 *
 * THIS EXISTS FOR THE EXPIRY SWEEP. Slice 5's in-flight guard skips any selected
 * request holding a payment in `processing` or `succeeded`, and nothing else
 * ever writes `processing`. Without this handler the guard's first half is a
 * predicate no event can make true.
 *
 * Guarded on `requires_payment` alone: a payment that has already succeeded must
 * never be walked backwards by a delayed `processing` delivery.
 */
async function applyProcessing(
  tx: Tx,
  payment: PaymentRow,
  _input: ApplyPaymentEventInput,
  now: Date,
): Promise<Applied> {
  const moved = await tx
    .update(payments)
    .set({ statusCode: 'processing', updatedAt: now })
    .where(and(eq(payments.id, payment.id), eq(payments.statusCode, 'requires_payment')))
    .returning({ id: payments.id });
  return moved.length > 0
    ? { outcome: 'applied', paymentId: payment.id, note: null }
    : {
        outcome: 'ignored',
        paymentId: payment.id,
        note: `Payment was ${payment.statusCode}; a processing event cannot move it.`,
      };
}

/**
 * A declined attempt. AN ANNOTATION, NOT A TRANSITION.
 *
 * The payment stays `requires_payment` so the family retries on the SAME
 * PaymentIntent inside their own window — which is why `failed_attempt_count`
 * exists instead of a row per attempt, and why the live-payment index can stay
 * a single-row guarantee. Only the counter and the reason move.
 *
 * Guarded on `requires_payment`, so a `payment_failed` that arrives after a
 * success — the classic out-of-order delivery — matches zero rows and is
 * recorded as ignored.
 */
async function applyFailed(
  tx: Tx,
  payment: PaymentRow,
  input: ApplyPaymentEventInput,
  now: Date,
): Promise<Applied> {
  const moved = await tx
    .update(payments)
    .set({
      failedAttemptCount: raw`${payments.failedAttemptCount} + 1`,
      lastFailureCode: input.authoritative.lastFailureCode,
      updatedAt: now,
    })
    .where(and(eq(payments.id, payment.id), eq(payments.statusCode, 'requires_payment')))
    .returning({ id: payments.id });
  return moved.length > 0
    ? { outcome: 'applied', paymentId: payment.id, note: null }
    : {
        outcome: 'ignored',
        paymentId: payment.id,
        note: `Payment was ${payment.statusCode}; a failure event cannot move it.`,
      };
}

/**
 * The intent was cancelled at the provider.
 *
 * NEEDED FOR THE LEDGER TO STAY TRUE, not for completeness. The partial unique
 * index counts `requires_payment` as live, so an intent cancelled at Stripe with
 * no matching Studdy status leaves a dead row occupying the one live-payment
 * slot for its request — and the family cannot begin a fresh attempt even with
 * their window still open. Moving it to `cancelled` releases that slot.
 *
 * The reservation and the ILR are untouched: a cancelled attempt is not a lapsed
 * window, and the sweep already owns what happens when the deadline passes.
 */
async function applyCancelled(
  tx: Tx,
  payment: PaymentRow,
  _input: ApplyPaymentEventInput,
  now: Date,
): Promise<Applied> {
  const moved = await tx
    .update(payments)
    .set({ statusCode: 'cancelled', cancelledAt: now, updatedAt: now })
    .where(
      and(eq(payments.id, payment.id), inArray(payments.statusCode, [...OPEN_PAYMENT_STATUSES])),
    )
    .returning({ id: payments.id });
  return moved.length > 0
    ? { outcome: 'applied', paymentId: payment.id, note: null }
    : {
        outcome: 'ignored',
        paymentId: payment.id,
        note: `Payment was ${payment.statusCode}; a cancellation cannot move it.`,
      };
}

/**
 * Payments whose confirmation is in flight, for the reconciliation safety net.
 *
 * WHY THIS QUERY EXISTS. `processing` is the one status the expiry sweep will
 * never release, which is correct while a webhook is on its way and a hole if
 * one never arrives: the tutor's calendar would stay blocked indefinitely on a
 * payment nobody is coming back for. Re-reading these from the provider closes
 * the hole that this slice's `processing` handler opens.
 *
 * Server-only, no ownership scope, and it returns ids rather than money — the
 * caller re-reads the authoritative amount from the provider anyway.
 */
export async function paymentsAwaitingReconciliation(input: {
  readonly limit?: number;
}): Promise<readonly { paymentId: string; providerPaymentIntentId: string }[]> {
  const { sql: client, db } = createDatabaseClient();
  try {
    const rows = await db
      .select({
        paymentId: payments.id,
        providerPaymentIntentId: payments.providerPaymentIntentId,
      })
      .from(payments)
      .where(and(eq(payments.statusCode, 'processing')))
      .limit(input.limit ?? 50);
    return rows.filter(
      (row): row is { paymentId: string; providerPaymentIntentId: string } =>
        row.providerPaymentIntentId !== null,
    );
  } finally {
    await client.end();
  }
}
