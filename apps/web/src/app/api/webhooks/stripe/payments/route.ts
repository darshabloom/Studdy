import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { applyPaymentProviderEvent } from '@studdy/database';
import {
  HANDLED_PAYMENT_EVENT_TYPES,
  retrieveAuthoritativePaymentIntent,
  STRIPE_PROVIDER,
  stripeClient,
  StripeConfigurationError,
  StripeSignatureError,
  verifyPaymentEvent,
} from '@studdy/integrations/payments/stripe';
import { createLogger } from '@studdy/observability';

/**
 * Stripe PaymentIntent webhooks — THE ONLY THING IN STUDDY THAT CAN CONFIRM A
 * BOOKING.
 *
 * THE ORDER OF OPERATIONS IS THE SECURITY MODEL, unchanged from the Connect
 * endpoint and strict for the same reason:
 *
 *   1. read the RAW body — never a parsed-and-restringified one, because the
 *      signature covers the exact bytes Stripe sent;
 *   2. verify the signature against the server-only secret;
 *   3. only then touch the database or call Stripe.
 *
 * There is no branch in which an unverified request reaches a write. A caller
 * who cannot produce a valid signature cannot move a single row, which is what
 * makes it safe for this route to be unauthenticated in the ordinary sense.
 *
 * WHY A SECOND ENDPOINT RATHER THAN A BRANCH IN THE CONNECT ONE. Stripe leaves
 * no choice: Connect account events are Accounts v2 THIN events verified with
 * `parseEventNotification`, PaymentIntent events are v1 SNAPSHOT events verified
 * with `constructEvent`, and Stripe issues a DIFFERENT SIGNING SECRET PER
 * ENDPOINT. One route would have to choose a secret and a parser before it had
 * verified anything — a decision made on unverified input, which is precisely
 * what step 2 exists to prevent. Everything else is shared: the same client, the
 * same error types, the same event ledger, the same idempotency spine.
 *
 * THE EVENT IS A NOTIFICATION; THE FETCH IS THE AUTHORITY. A snapshot event
 * embeds the PaymentIntent, and this route deliberately ignores that copy for
 * anything load-bearing. It re-reads the intent from Stripe and fulfils from
 * THAT, so a delayed, retried or reordered delivery describes a state Studdy
 * re-derives rather than a state it inherits.
 *
 * NO BROWSER PATH REACHES ANY OF THIS. The parent's success page reads the
 * payment row and says "confirming"; it has no write path at all, and reaching
 * a return URL fulfils exactly nothing.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const logger = createLogger({ job: 'stripe-payment-webhook' });

export async function POST(request: Request): Promise<NextResponse> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_PAYMENTS_WEBHOOK_SECRET;

  // THE RAW BODY, read before anything parses it.
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  let stripe;
  let event;
  try {
    stripe = stripeClient(secretKey);
    event = verifyPaymentEvent(stripe, rawBody, signature, webhookSecret);
  } catch (error) {
    if (error instanceof StripeSignatureError) {
      // 400 so Stripe stops retrying: a bad signature will never become good.
      // The log records that it happened, never the body or the header.
      logger.warn('stripe payment webhook signature rejected');
      return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
    }
    if (error instanceof StripeConfigurationError) {
      // 500 so Stripe DOES retry: this is Studdy's fault and is fixable, and
      // dropping the event would leave a paid parent unconfirmed.
      logger.error('stripe payment webhook cannot be verified — configuration missing');
      return NextResponse.json({ error: 'not_configured' }, { status: 500 });
    }
    logger.error('stripe payment webhook failed before verification');
    return NextResponse.json({ error: 'unhandled' }, { status: 500 });
  }

  if (!HANDLED_PAYMENT_EVENT_TYPES.includes(event.type)) {
    // 200, deliberately. A payments endpoint receives events Studdy has no
    // opinion on — `charge.*`, `payment_intent.created` — and retrying them
    // forever would be noise, not safety.
    logger.info('stripe payment webhook ignored', { eventType: event.type });
    return NextResponse.json({ received: true, handled: false });
  }

  /*
   * LIVEMODE IS CHECKED BEFORE ANY WRITE, on the envelope and again on the
   * fetched intent.
   *
   * A live-mode event arriving at a sandbox deployment means the endpoint is
   * wired to the wrong Stripe account. Applying it would confirm a booking on
   * the strength of a real charge this ledger knows nothing about, and would
   * create a real obligation to pay a tutor. 200 so Stripe stops retrying at
   * a misconfigured endpoint; the log is what an operator acts on.
   */
  if (event.livemode !== EXPECTED_LIVEMODE) {
    logger.error('stripe payment webhook livemode mismatch — refusing to apply');
    return NextResponse.json({ received: true, handled: false }, { status: 200 });
  }

  if (event.paymentIntentId === null) {
    logger.warn('stripe payment event carried no payment intent');
    return NextResponse.json({ received: true, handled: false });
  }

  const correlationId = randomUUID();

  try {
    // THE FETCH IS THE AUTHORITY. The event said something happened; Stripe
    // says what is now true, including the amount actually received.
    const authoritative = await retrieveAuthoritativePaymentIntent(stripe, event.paymentIntentId);

    if (authoritative.livemode !== EXPECTED_LIVEMODE) {
      logger.error('stripe payment intent livemode mismatch — refusing to apply');
      return NextResponse.json({ received: true, handled: false }, { status: 200 });
    }

    const outcome = await applyPaymentProviderEvent({
      provider: STRIPE_PROVIDER,
      providerEventId: event.id,
      eventType: event.type,
      /*
       * A REDUCTION, NOT A PAYLOAD DUMP. PCI discipline (SAQ-A) says never log
       * or store a PaymentIntent wholesale — it carries payment-method detail
       * Studdy has no reason to hold. What is stored is what Studdy actually
       * decided on: the ids, the status, and the money it was checked against.
       */
      redactedPayload: {
        providerPaymentIntentId: authoritative.providerPaymentIntentId,
        status: authoritative.status,
        amountReceivedMinor: authoritative.amountReceivedMinor.toString(),
        currencyCode: authoritative.currencyCode,
        chargeId: authoritative.chargeId,
        balanceTransactionId: authoritative.balanceTransactionId,
        lastFailureCode: authoritative.lastFailureCode,
      },
      authoritative: {
        providerPaymentIntentId: authoritative.providerPaymentIntentId,
        status: authoritative.status,
        livemode: authoritative.livemode,
        amountReceivedMinor: authoritative.amountReceivedMinor,
        currencyCode: authoritative.currencyCode,
        chargeId: authoritative.chargeId,
        balanceTransactionId: authoritative.balanceTransactionId,
        providerCostMinor: authoritative.providerCostMinor,
        lastFailureCode: authoritative.lastFailureCode,
        studdyPaymentId: authoritative.metadata.paymentId,
      },
      correlationId,
    });

    /*
     * Outcomes and correlation ids only. NEVER a reference, an amount, a tutor,
     * a student or a family — the existing logging discipline, and this is the
     * one route where a slip would be a slip about somebody's money.
     */
    if (OPS_ATTENTION.has(outcome)) {
      logger.error('stripe payment webhook needs attention', { eventType: event.type, outcome });
    } else {
      logger.info('stripe payment webhook processed', { eventType: event.type, outcome });
    }

    /*
     * 200 EVEN FOR THE OUTCOMES THAT NEED A HUMAN. A mismatch or a blocked
     * fulfilment is a decision Studdy has already made and recorded; asking
     * Stripe to redeliver would not change it, and would bury the real signal
     * under retries. The event ledger carries `failed` and the log carries the
     * alert — those are what an operator reads, not Stripe's retry queue.
     */
    return NextResponse.json({ received: true, handled: outcome === 'fulfilled' });
  } catch {
    /*
     * 500 so Stripe retries. The unique `provider_event_id` makes that retry
     * harmless — and if the failure was after the event row was written, the
     * retry is recorded as a duplicate and the reconciliation sweep picks the
     * payment up instead. Never lose the event; never 500 forever.
     */
    logger.error('stripe payment webhook could not be applied');
    return NextResponse.json({ error: 'apply_failed' }, { status: 500 });
  }
}

/**
 * Whether this deployment expects live-mode events.
 *
 * FALSE EVERYWHERE UNTIL LIVE MONEY IS APPROVED. It is derived from Studdy's own
 * environment rather than from anything in the request, so a forged or
 * misrouted event cannot talk its way past the check.
 */
const EXPECTED_LIVEMODE = process.env.STUDDY_ENVIRONMENT === 'production';

/** Outcomes an operator has to see. Everything else is routine webhook life. */
const OPS_ATTENTION = new Set<string>([
  'amount_mismatch',
  'currency_mismatch',
  'fulfilment_blocked',
]);

/** Webhooks mutate state; a GET must never be able to. */
export function GET(): NextResponse {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}
