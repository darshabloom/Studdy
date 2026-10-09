import { canTutorReceivePayments, type CapabilityStatus } from './connect-readiness';

/**
 * SETTLEMENT — when does Studdy pay a tutor?
 *
 * THE RULE IS THE APPROVED ALPHA RULE (`payments-and-first-paid-booking.md` §5),
 * and it is deliberately cautious. Studdy takes the parent's money into its own
 * balance (separate charges and transfers) and sends the tutor's share LATER, so
 * that a cancelled or disputed lesson never needs money clawed back out of a
 * connected account. Money is therefore sent only when:
 *
 *   - the payment SUCCEEDED, and there is a charge to send it from;
 *   - there is a BOOKING and it was not cancelled;
 *   - the lesson's scheduled END has passed — the tutor is paid for a lesson
 *     that was supposed to have happened, never in advance of it;
 *   - NOTHING is flagged for refund and no refund has been started or made;
 *   - the tutor is payable NOW, by Stripe's own account state, and not merely
 *     when the parent paid. A tutor restricted since is skipped, not sent to.
 *
 * Anything else is HELD, with the first reason that applies — the same order an
 * operator would ask the questions in. A held transfer is not a problem: it stays
 * `pending`, is reported, and is considered again on the next run.
 *
 * Pure: no clock, no database, no provider. The caller supplies `now`.
 */

export const SETTLEMENT_HOLD_REASONS = [
  'transfer_not_pending',
  'payment_not_succeeded',
  'flagged_for_refund',
  'refund_started',
  'no_charge',
  'no_booking',
  'booking_cancelled',
  'lesson_not_ended',
  'tutor_not_payable',
] as const;

export type SettlementHoldReason = (typeof SETTLEMENT_HOLD_REASONS)[number];

export interface SettlementFacts {
  /** The obligation's own status. Only `pending` can be sent. */
  readonly transferStatus: string;
  readonly paymentStatus: string;
  /** `refund_required_at` is set: money arrived and no booking was made. */
  readonly refundRequired: boolean;
  /** A refund exists in a live status (requested, pending or succeeded). */
  readonly hasLiveRefund: boolean;
  /** The charge a transfer is made against. Null if the payment has none. */
  readonly providerChargeId: string | null;
  /** Null when no booking exists for the payment. */
  readonly bookingStatus: string | null;
  readonly lessonEndsAt: Date | null;
  readonly transfersCapability: CapabilityStatus;
  readonly payoutsCapability: CapabilityStatus;
  readonly now: Date;
}

export type SettlementDecision =
  { readonly eligible: true } | { readonly eligible: false; readonly reason: SettlementHoldReason };

const held = (reason: SettlementHoldReason): SettlementDecision => ({ eligible: false, reason });

/**
 * May this obligation be sent now? ONE FUNCTION answers, so the operator's report
 * and the run that actually moves money cannot disagree about what is eligible.
 */
export function decideSettlement(facts: SettlementFacts): SettlementDecision {
  if (facts.transferStatus !== 'pending') return held('transfer_not_pending');
  if (facts.paymentStatus !== 'succeeded') return held('payment_not_succeeded');
  // A payment flagged for refund never has an obligation, but the check is made
  // anyway: this is the guard that stops money going out against a lesson Studdy
  // has already decided to give back.
  if (facts.refundRequired) return held('flagged_for_refund');
  if (facts.hasLiveRefund) return held('refund_started');
  if (facts.providerChargeId === null) return held('no_charge');
  if (facts.bookingStatus === null) return held('no_booking');
  if (facts.bookingStatus === 'cancelled') return held('booking_cancelled');
  if (facts.lessonEndsAt === null || facts.lessonEndsAt.getTime() > facts.now.getTime()) {
    return held('lesson_not_ended');
  }
  if (
    !canTutorReceivePayments({
      transfersCapability: facts.transfersCapability,
      payoutsCapability: facts.payoutsCapability,
      statusDetails: [],
    })
  ) {
    return held('tutor_not_payable');
  }
  return { eligible: true };
}

/** Stable per obligation, so a repeated run cannot pay twice. */
export function settlementTransferGroup(paymentId: string): string {
  return `payment:${paymentId}`;
}

/**
 * The key for a RE-QUEUED obligation: attempt 1 is the original, written by the
 * fulfilment transaction as `tutor-transfer:<paymentId>`. A retry after a
 * definitive failure needs a new key, because the provider may replay the cached
 * outcome of the old one.
 */
export function transferIdempotencyKey(paymentId: string, attempt: number): string {
  return attempt <= 1
    ? `tutor-transfer:${paymentId}`
    : `tutor-transfer:${paymentId}:attempt-${String(attempt)}`;
}

/** Sum of a list of amounts, for the "expected total" the operator confirms. */
export function sumMinor(amounts: readonly bigint[]): bigint {
  return amounts.reduce((total, amount) => total + amount, 0n);
}
