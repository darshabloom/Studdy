'use server';

import { redirect } from 'next/navigation';
import {
  attachProviderPaymentIntent,
  createPaymentForRequest,
  PaymentRefusedError,
  type PaymentRefusalReason,
} from '@studdy/database';
import {
  createPlatformPaymentIntent,
  retrievePaymentIntent,
  STRIPE_PROVIDER,
  stripeClient,
} from '@studdy/integrations/payments/stripe';
import { createLogger } from '@studdy/observability';
import { resolveDiscoveryContext } from '../discovery/context';

/**
 * Preparing a parent's payment: ledger row first, PaymentIntent second.
 *
 * THE ORDER IS DELIBERATE. Studdy's own row is written before Stripe is called,
 * so the partial unique index has already decided who owns this request's live
 * payment before any money can be attached to it. Calling Stripe first would
 * mean a race could produce two PaymentIntents and only then discover that one
 * of them can never be recorded.
 *
 * NOTHING HERE ACCEPTS AN AMOUNT. Every figure comes back from the repository,
 * which computed it from the service version. The browser's only contribution is
 * the reference in the URL, and even that is checked against the session's own
 * students before anything happens.
 */

const logger = createLogger({ job: 'stripe-payment-intent' });

/** What the payment page needs. The client secret is the only sensitive value. */
export interface PaymentSession {
  readonly ok: true;
  readonly clientSecret: string;
  readonly paymentReference: string;
  readonly totalChargedMinor: string;
  readonly lessonAmountMinor: string;
  readonly currencyCode: string;
  readonly paymentDeadlineAt: string;
  readonly alreadySucceeded: boolean;
}

export interface PaymentRefusal {
  readonly ok: false;
  readonly reason: PaymentRefusalReason | 'provider_unavailable';
}

/**
 * Family-safe wording. Never names another family's data, never explains why a
 * request could not be found, and never mentions Stripe internals.
 */
export function refusalMessage(reason: PaymentRefusal['reason']): string {
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

/**
 * Create or resume the payment for a request, and return a client secret.
 *
 * IDEMPOTENT END TO END. The repository returns an existing live row rather than
 * inserting a second, and the Stripe call carries an idempotency key derived
 * from Studdy's own payment id — so a refresh, a double submit and a retried
 * request all converge on ONE PaymentIntent that the parent can pay once.
 */
export async function startPaymentForRequest(
  reference: string,
): Promise<PaymentSession | PaymentRefusal> {
  const context = await resolveDiscoveryContext();
  if (context === null)
    redirect(`/sign-in?next=${encodeURIComponent(`/requests/${reference}/pay`)}`);

  const studentProfileIds = context.students.map((student) => student.studentProfileId);

  let prepared;
  try {
    prepared = await createPaymentForRequest({
      reference,
      studentProfileIds,
      payerUserId: context.studdyUserId,
    });
  } catch (error) {
    if (error instanceof PaymentRefusedError) {
      // Counts and reasons only — never a reference, a tutor or an amount.
      logger.info('payment refused', { reason: error.reason });
      return { ok: false, reason: error.reason };
    }
    throw error;
  }

  /*
   * A SUCCEEDED PAYMENT IS NOT A BOOKING YET, and this page must not imply it
   * is. Fulfilment is webhook-authoritative and belongs to slice 6; here the
   * parent is simply told their payment arrived and confirmation is coming.
   */
  if (prepared.statusCode === 'succeeded') {
    return {
      ok: true,
      clientSecret: '',
      paymentReference: prepared.reference,
      totalChargedMinor: prepared.totalChargedMinor.toString(),
      lessonAmountMinor: prepared.lessonAmountMinor.toString(),
      currencyCode: prepared.currencyCode,
      paymentDeadlineAt: prepared.paymentDeadlineAt.toISOString(),
      alreadySucceeded: true,
    };
  }

  try {
    const stripe = stripeClient(process.env.STRIPE_SECRET_KEY);

    // Reuse the existing intent where there is one: a recoverable decline keeps
    // the same PaymentIntent, so the parent retries on it rather than on a new
    // charge.
    if (prepared.providerPaymentIntentId !== null) {
      const existing = await retrievePaymentIntent(stripe, prepared.providerPaymentIntentId);
      if (existing.clientSecret !== null) {
        return {
          ok: true,
          clientSecret: existing.clientSecret,
          paymentReference: prepared.reference,
          totalChargedMinor: prepared.totalChargedMinor.toString(),
          lessonAmountMinor: prepared.lessonAmountMinor.toString(),
          currencyCode: prepared.currencyCode,
          paymentDeadlineAt: prepared.paymentDeadlineAt.toISOString(),
          alreadySucceeded: existing.status === 'succeeded',
        };
      }
    }

    const intent = await createPlatformPaymentIntent(stripe, {
      // THE SERVER'S NUMBER. Never anything the browser sent.
      amountMinor: prepared.totalChargedMinor,
      currencyCode: prepared.currencyCode,
      paymentReference: prepared.reference,
      // Deterministic on Studdy's payment id, so a retry reaches the same intent.
      idempotencyKey: `payment-intent:${prepared.paymentId}`,
      /*
       * Correlation only. Studdy ids, which mean nothing outside Studdy — no
       * names, no emails, no student or family identifiers, and no amounts a
       * support agent could mistake for authoritative.
       */
      metadata: {
        studdy_payment_id: prepared.paymentId,
        studdy_payment_reference: prepared.reference,
        studdy_tutor_request_id: prepared.tutorRequestId,
      },
    });

    await attachProviderPaymentIntent({
      paymentId: prepared.paymentId,
      provider: STRIPE_PROVIDER,
      providerPaymentIntentId: intent.providerPaymentIntentId,
    });

    logger.info('payment intent ready', { reused: prepared.reused });

    return {
      ok: true,
      clientSecret: intent.clientSecret,
      paymentReference: prepared.reference,
      totalChargedMinor: prepared.totalChargedMinor.toString(),
      lessonAmountMinor: prepared.lessonAmountMinor.toString(),
      currencyCode: prepared.currencyCode,
      paymentDeadlineAt: prepared.paymentDeadlineAt.toISOString(),
      alreadySucceeded: false,
    };
  } catch {
    // The ledger row survives; the parent can try again while the window is
    // open. Never surface a provider message to a family.
    logger.error('could not create a payment intent');
    return { ok: false, reason: 'provider_unavailable' };
  }
}
