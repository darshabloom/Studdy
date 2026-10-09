/**
 * REFUNDS — the rules for giving a parent's money back, provider-neutral.
 *
 * WHAT THIS COVERS, AND WHAT IT DELIBERATELY DOES NOT. Studdy refunds a payment
 * when the money arrived and the lesson cannot exist: the "late success" the
 * design approved (`payments-and-first-paid-booking.md` §8). There is no booking
 * to cancel, no tutor obligation to reverse and nothing to apportion, so a full
 * refund is complete and safe on its own.
 *
 * REFUNDING A CONFIRMED BOOKING IS A DIFFERENT PROBLEM and is not allowed here.
 * It has to cancel the booking, withdraw the tutor's obligation (or claw back a
 * transfer already sent), apply a cancellation policy that may refund only part,
 * and tell two parties. That belongs to the cancellation slice, which will add
 * its own reasons to this vocabulary rather than loosening this rule.
 *
 * NEITHER SILENT NOR AUTOMATIC. The approved rule says neither silently
 * confirming nor silently refunding is acceptable. A refund is therefore
 * EXECUTED ON PURPOSE by an operator (or, later, the admin tooling), recorded
 * before it is attempted, and the family is told.
 */

export const REFUND_REASONS = [
  /** The payment succeeded and the booking could not be confirmed. */
  'booking_not_confirmed',
] as const;

export type RefundReason = (typeof REFUND_REASONS)[number];

export function isRefundReason(value: string): value is RefundReason {
  return (REFUND_REASONS as readonly string[]).includes(value);
}

/**
 * A refund's own lifecycle.
 *
 *     requested → pending → succeeded
 *         ↓          ↓
 *       failed     failed
 *     requested → succeeded | failed        (a provider that answers at once)
 *
 * `requested` is Studdy's INTENT, written and committed BEFORE the provider is
 * called. That ordering is the whole crash-safety story: if the process dies
 * between the provider accepting and Studdy recording the answer, the row is
 * still there, still `requested`, and the reconcile pass re-asks the provider
 * with the SAME idempotency key and gets the SAME refund back.
 */
export const REFUND_STATUSES = ['requested', 'pending', 'succeeded', 'failed'] as const;

export type RefundStatus = (typeof REFUND_STATUSES)[number];

/** Statuses that still stand between a payment and another refund attempt. */
export const LIVE_REFUND_STATUSES: readonly RefundStatus[] = ['requested', 'pending', 'succeeded'];

/** Statuses the reconcile pass still has to resolve. */
export const UNSETTLED_REFUND_STATUSES: readonly RefundStatus[] = ['requested', 'pending'];

const REFUND_TRANSITIONS: Readonly<Record<RefundStatus, readonly RefundStatus[]>> = {
  requested: ['pending', 'succeeded', 'failed'],
  pending: ['succeeded', 'failed'],
  succeeded: [],
  /** Terminal. A retry is a NEW row with its own attempt number and key. */
  failed: [],
};

export function canTransitionRefund(from: RefundStatus, to: RefundStatus): boolean {
  return REFUND_TRANSITIONS[from].includes(to);
}

export function isTerminalRefundStatus(status: RefundStatus): boolean {
  return REFUND_TRANSITIONS[status].length === 0;
}

/**
 * Map the provider's own refund status into Studdy's, FAILING SAFE.
 *
 * Providers type their statuses as open sets, so a value Studdy has never seen
 * is possible. An unrecognised status becomes `pending` — never `succeeded` —
 * so the reconcile pass keeps asking instead of Studdy telling a family their
 * money is back when it is not. (Stripe's `requires_action` and `pending` both
 * mean "not yet", and `canceled` and `failed` both mean it is not coming.)
 */
export function studdyRefundStatusFor(providerStatus: string | null | undefined): RefundStatus {
  switch (providerStatus) {
    case 'succeeded':
      return 'succeeded';
    case 'failed':
    case 'canceled':
    case 'cancelled':
      return 'failed';
    default:
      return 'pending';
  }
}

/**
 * Stable across retries of the SAME attempt, different across attempts.
 *
 * The provider honours this key for a day, so a crashed or repeated run reaches
 * the refund it already created. A genuinely new attempt after a failure takes
 * the next number and so cannot be mistaken for the one that failed.
 */
export function refundIdempotencyKey(paymentId: string, attempt: number): string {
  return `refund:${paymentId}:${String(attempt)}`;
}

/** Why a refund was not started. Operator-facing; never shown to a family. */
export type RefundRefusal =
  | 'payment_not_found'
  | 'payment_not_succeeded'
  | 'no_provider_payment'
  | 'booking_confirmed'
  | 'refund_not_required'
  | 'already_refunded'
  | 'refund_in_flight'
  | 'nothing_refundable';

export interface RefundableFacts {
  readonly paymentStatus: string;
  readonly hasProviderPayment: boolean;
  readonly totalChargedMinor: bigint;
  /** `refund_required_at` is set: money arrived and no booking was made. */
  readonly refundRequired: boolean;
  /** A booking row exists for this payment. */
  readonly hasBooking: boolean;
  /** Refunds currently in a live status, summed by status. */
  readonly succeededRefundMinor: bigint;
  readonly unsettledRefundMinor: bigint;
}

export type RefundDecision =
  | { readonly allowed: true; readonly amountMinor: bigint }
  | { readonly allowed: false; readonly refusal: RefundRefusal };

/**
 * May this payment be refunded, and for how much? ONE function answers, so the
 * operator report and the executor cannot disagree.
 *
 * Always the whole remaining amount: a partial refund needs a policy, and the
 * policy belongs to the cancellation slice. The order of the checks is the
 * order an operator would ask them in, and the first failure is the one named.
 */
export function decideRefund(facts: RefundableFacts): RefundDecision {
  if (facts.paymentStatus !== 'succeeded') {
    return { allowed: false, refusal: 'payment_not_succeeded' };
  }
  if (!facts.hasProviderPayment) return { allowed: false, refusal: 'no_provider_payment' };
  // A booked lesson is never refunded through this path; see the file comment.
  if (facts.hasBooking) return { allowed: false, refusal: 'booking_confirmed' };
  if (!facts.refundRequired) return { allowed: false, refusal: 'refund_not_required' };
  if (facts.succeededRefundMinor >= facts.totalChargedMinor) {
    return { allowed: false, refusal: 'already_refunded' };
  }
  if (facts.unsettledRefundMinor > 0n) return { allowed: false, refusal: 'refund_in_flight' };

  const remaining = facts.totalChargedMinor - facts.succeededRefundMinor;
  if (remaining <= 0n) return { allowed: false, refusal: 'nothing_refundable' };
  return { allowed: true, amountMinor: remaining };
}

/**
 * Has the provider POSITIVELY accepted this refund — the money is back, or on its
 * way?
 *
 * NARROWER THAN "pending". An unrecognised status is recorded as `pending` so the
 * reconcile pass keeps asking, but that is a statement about what Studdy does
 * not yet know. Telling a family their refund is on its way is a promise, and it
 * is made only on a status the provider actually uses to mean so. `requires_action`
 * is excluded too: it means the refund cannot proceed until somebody acts.
 */
export function providerAcceptedRefund(providerStatus: string | null | undefined): boolean {
  return providerStatus === 'succeeded' || providerStatus === 'pending';
}
