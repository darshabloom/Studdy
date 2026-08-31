/**
 * The payment's own state machine — provider-neutral, and minimal.
 *
 * NAMED FOR WHAT STUDDY NEEDS, not for what Stripe emits. Stripe has a dozen
 * PaymentIntent statuses; only the distinctions Studdy acts on live here, and a
 * webhook slice maps into these rather than mirroring them. A status added
 * because a provider has one with a similar name is a status nothing drives,
 * and it will be read as meaningful by the next person.
 *
 * The path a successful booking takes:
 *
 *     requires_payment → processing → succeeded
 *
 * `processing` earns its place twice over: it is the honest state for an
 * asynchronous confirmation in flight, and it is what stops the expiry sweep
 * releasing a hold out from under a webhook that is about to succeed.
 */

export const PAYMENT_STATUSES = [
  /** Created and waiting for the parent. A recoverable decline stays here. */
  'requires_payment',
  /** Confirmation in flight. Protected from the expiry sweep. */
  'processing',
  /** Terminal, and the only status that means a booking is confirmed. */
  'succeeded',
  /** Terminal: an attempt failed in a way retrying the same attempt cannot fix. */
  'failed',
  /** Terminal: deliberately abandoned, by the family or by an operator. */
  'cancelled',
  /** Terminal: the payment window closed before anybody paid. */
  'expired',
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/**
 * Statuses that occupy the ILR — the set the database's partial unique index
 * uses to allow exactly one live payment per request.
 *
 * `succeeded` is in the set on purpose: once a lesson is paid for, a second
 * payment for the same request must be unrepresentable, not merely unlikely.
 * The three terminal failures are outside it, so a family whose payment truly
 * failed can start a fresh attempt while their window is still open.
 */
export const LIVE_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'requires_payment',
  'processing',
  'succeeded',
];

/**
 * A RECOVERABLE DECLINE DOES NOT MOVE THE STATUS.
 *
 * A card declined for insufficient funds leaves the payment `requires_payment`
 * with `failed_attempt_count` incremented, so the family retries the same
 * payment — and, later, the same PaymentIntent — rather than accumulating a row
 * per attempt. `failed` is for the unrecoverable case, where a new attempt
 * needs a new record.
 *
 * This is why `requires_payment → requires_payment` is not a transition: it is
 * not a transition at all, just a counter moving.
 */
const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  requires_payment: ['processing', 'succeeded', 'failed', 'cancelled', 'expired'],
  /*
   * No `expired` from `processing`: the sweep must not close a payment whose
   * confirmation is in flight, and the webhook that resolves it will move it to
   * `succeeded` or `failed`. A payment stuck here is a reconciliation problem,
   * not an expiry one.
   */
  processing: ['succeeded', 'failed', 'cancelled'],
  succeeded: [],
  failed: [],
  cancelled: [],
  expired: [],
};

export function isPaymentStatus(value: string): value is PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(value);
}

/** Whether a payment in `from` may move to `to`. */
export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

/** Terminal statuses accept no further transition. */
export function isTerminalPaymentStatus(status: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[status].length === 0;
}

/**
 * The settlement obligation to the tutor.
 *
 * Written when a payment succeeds and settled later — manually for private
 * alpha. `reversed` exists because money that has been sent can come back;
 * everything else here is the ordinary path.
 */
export const TUTOR_TRANSFER_STATUSES = ['pending', 'sent', 'failed', 'reversed'] as const;

export type TutorTransferStatus = (typeof TUTOR_TRANSFER_STATUSES)[number];

/**
 * The provider-event ledger's own status.
 *
 * `ignored` is not a failure: an event that arrives after the state it
 * describes has already been reached is the normal outcome of retries and
 * out-of-order delivery, and recording it as ignored is how that stays visible
 * without looking like an error.
 */
export const PAYMENT_EVENT_STATUSES = ['received', 'applied', 'ignored', 'failed'] as const;

export type PaymentEventStatus = (typeof PAYMENT_EVENT_STATUSES)[number];
