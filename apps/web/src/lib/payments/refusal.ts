import type { PaymentRefusalReason } from '@studdy/database';

/**
 * Why a payment could not be started, in words for a family.
 *
 * SEPARATE FROM THE SERVER ACTION on purpose. A `'use server'` file may export
 * async functions ONLY — a plain exported function typechecks perfectly and
 * then fails the production build, which is a trap this repository has already
 * been caught by once (handoff §7).
 */
export type PaymentRefusalCode = PaymentRefusalReason | 'provider_unavailable';

/**
 * Never names another family's data, never explains why a request could not be
 * found, and never mentions Stripe internals. "Not yours" and "does not exist"
 * deliberately read the same.
 */
export function refusalMessage(reason: PaymentRefusalCode): string {
  switch (reason) {
    case 'request_not_found':
      return 'We could not find that lesson request.';
    case 'not_awaiting_payment':
      return 'This request is not waiting for payment. It may already be booked, or it may have closed.';
    case 'payment_window_closed':
      return 'The time to pay for this lesson has passed, so the tutor’s slot has been released.';
    case 'tutor_not_payable':
      return 'This tutor cannot accept payments just now. Nothing has been charged — please try another tutor or contact Studdy.';
    default:
      return 'We could not start the payment. Nothing has been charged — please try again shortly.';
  }
}
