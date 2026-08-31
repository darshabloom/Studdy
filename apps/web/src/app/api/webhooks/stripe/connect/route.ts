import { NextResponse } from 'next/server';
import { connectedAccountExists, recordProviderEvent } from '@studdy/database';
import {
  HANDLED_CONNECT_EVENT_TYPES,
  retrieveConnectAccount,
  STRIPE_PROVIDER,
  stripeClient,
  StripeConfigurationError,
  StripeSignatureError,
  verifyConnectEvent,
} from '@studdy/integrations/payments/stripe';
import { createLogger } from '@studdy/observability';

/**
 * Stripe Connect webhooks — Accounts v2 recipient events.
 *
 * THE ORDER OF OPERATIONS IS THE SECURITY MODEL, and it is strict:
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
 * V2 EVENTS ARE THIN, and that changes the shape of this handler. A v1
 * `account.updated` embedded the whole account; a v2 notification carries a
 * `related_object` REFERENCE, so the authoritative state is fetched afterwards.
 * Two consequences worth stating:
 *
 *   - The fetch is the authority, not the event. Studdy always reads current
 *     state rather than trusting a payload, which also makes a replayed or
 *     out-of-order event harmless by construction.
 *   - The request body cannot contain KYC data, because it contains almost
 *     nothing. v1 required redacting the payload; v2 gives that for free.
 *
 * PAYMENT FULFILMENT IS NOT HERE. No PaymentIntent handling, no
 * `awaiting_payment → fulfilled`, no transfers. Those belong to slices 5 and 6.
 * This route exists now to prove signature verification and idempotency end to
 * end on events that cannot move money.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const logger = createLogger({ job: 'stripe-connect-webhook' });

export async function POST(request: Request): Promise<NextResponse> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

  // THE RAW BODY, read before anything parses it.
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  let stripe;
  let event;
  try {
    stripe = stripeClient(secretKey);
    event = verifyConnectEvent(stripe, rawBody, signature, webhookSecret);
  } catch (error) {
    if (error instanceof StripeSignatureError) {
      // 400 so Stripe stops retrying: a bad signature will never become good.
      // The log records that it happened, never the body or the header.
      logger.warn('stripe webhook signature rejected');
      return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
    }
    if (error instanceof StripeConfigurationError) {
      // 500 so Stripe DOES retry: this is Studdy's fault and is fixable, and
      // dropping the event would silently desynchronise a tutor's payability.
      logger.error('stripe webhook cannot be verified — configuration missing');
      return NextResponse.json({ error: 'not_configured' }, { status: 500 });
    }
    logger.error('stripe webhook failed before verification');
    return NextResponse.json({ error: 'unhandled' }, { status: 500 });
  }

  if (!HANDLED_CONNECT_EVENT_TYPES.includes(event.type)) {
    // 200, deliberately. A Connect endpoint receives events Studdy has no
    // opinion on; retrying them forever would be noise, not safety.
    logger.info('stripe webhook ignored', { eventType: event.type });
    return NextResponse.json({ received: true, handled: false });
  }

  if (event.relatedAccountId === null) {
    logger.warn('stripe connect event carried no related account');
    return NextResponse.json({ received: true, handled: false });
  }

  /*
   * IS THIS OUR ACCOUNT? Checked BEFORE fetching, so an event for an account
   * Studdy does not hold costs one indexed lookup rather than a Stripe round
   * trip. It is also the isolation boundary: routing is by provider account id
   * alone, so an event naming somebody else's account can never reach another
   * tutor's row.
   */
  if (!(await connectedAccountExists(event.relatedAccountId))) {
    logger.info('stripe connect event for an unknown account', { eventType: event.type });
    return NextResponse.json({ received: true, handled: false });
  }

  try {
    // THE FETCH IS THE AUTHORITY. The event said something changed; Stripe says
    // what the state now is.
    const snapshot = await retrieveConnectAccount(stripe, event.relatedAccountId);

    const outcome = await recordProviderEvent({
      provider: STRIPE_PROVIDER,
      providerEventId: event.id,
      eventType: event.type,
      /*
       * The capability projection, not a provider payload. v2 notifications
       * carry no account data to begin with, and what is stored here is the
       * state Studdy acted on — capability statuses and machine-readable reason
       * codes, never requirement values or identity.
       */
      redactedPayload: {
        providerAccountId: snapshot.providerAccountId,
        transfersCapability: snapshot.transfersCapability,
        payoutsCapability: snapshot.payoutsCapability,
        statusDetails: snapshot.statusDetails,
        countryCode: snapshot.countryCode,
      },
      providerAccountId: snapshot.providerAccountId,
      snapshot,
      eventCreatedAt: event.createdAt,
    });

    /*
     * Counts and outcomes only. NEVER the account id, the tutor, or a reason
     * list — a reason code attached to a specific person is still a statement
     * about that person's verification, which is not something to leave in a
     * log.
     */
    logger.info('stripe connect webhook processed', { eventType: event.type, outcome });
    return NextResponse.json({ received: true, handled: outcome === 'applied' });
  } catch {
    // 500 so Stripe retries. The unique event id makes the retry harmless.
    logger.error('stripe connect webhook could not be applied');
    return NextResponse.json({ error: 'apply_failed' }, { status: 500 });
  }
}

/** Webhooks mutate state; a GET must never be able to. */
export function GET(): NextResponse {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}
