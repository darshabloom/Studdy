import { NextResponse } from 'next/server';
import { recordProviderEvent } from '@studdy/database';
import {
  snapshotFromAccount,
  STRIPE_PROVIDER,
  stripeClient,
  StripeConfigurationError,
  StripeSignatureError,
  verifyWebhookEvent,
} from '@studdy/integrations/payments/stripe';
import { createLogger } from '@studdy/observability';

/**
 * Stripe Connect webhooks. `account.updated` only, in this slice.
 *
 * THE ORDER OF OPERATIONS IS THE SECURITY MODEL, and it is strict:
 *
 *   1. read the RAW body — never a parsed-and-restringified one, because the
 *      signature covers the exact bytes Stripe sent;
 *   2. verify the signature against the server-only secret;
 *   3. only then touch the database.
 *
 * There is no branch in which an unverified request reaches a write. A caller
 * who cannot produce a valid signature cannot move a single row, which is what
 * makes it safe for this route to be unauthenticated in the ordinary sense.
 *
 * PAYMENT FULFILMENT IS NOT HERE. No `payment_intent.*` handling, no
 * `awaiting_payment → fulfilled`, no transfers. Those belong to slices 5 and 6.
 * This route exists now to prove signature verification and idempotency end to
 * end on an event that cannot move money.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const logger = createLogger({ job: 'stripe-connect-webhook' });

/** Events this route acts on. Anything else is acknowledged and dropped. */
const HANDLED_EVENT_TYPES = new Set(['account.updated']);

export async function POST(request: Request): Promise<NextResponse> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

  // THE RAW BODY, read before anything parses it.
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  let event;
  try {
    const stripe = stripeClient(secretKey);
    event = await verifyWebhookEvent(stripe, rawBody, signature, webhookSecret);
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

  if (!HANDLED_EVENT_TYPES.has(event.type)) {
    // 200, deliberately. A Connect endpoint receives events Studdy has no
    // opinion on; retrying them forever would be noise, not safety.
    logger.info('stripe webhook ignored', { eventType: event.type });
    return NextResponse.json({ received: true, handled: false });
  }

  const account = event.data.object as { id?: unknown };
  if (typeof account.id !== 'string') {
    logger.warn('stripe account.updated carried no account id');
    return NextResponse.json({ received: true, handled: false });
  }

  const snapshot = snapshotFromAccount(event.data.object as never);

  try {
    const outcome = await recordProviderEvent({
      provider: STRIPE_PROVIDER,
      providerEventId: event.id,
      eventType: event.type,
      /*
       * REDACTED, NOT RAW. A full `account.updated` carries the tutor's name,
       * date of birth, address and document details. Studdy reads none of it,
       * so storing it would create a liability in exchange for nothing. What
       * is kept is what a later reviewer would actually need: the capability
       * and payability flags, and requirement IDENTIFIERS — never their values.
       */
      redactedPayload: {
        providerAccountId: snapshot.providerAccountId,
        chargesEnabled: snapshot.chargesEnabled,
        payoutsEnabled: snapshot.payoutsEnabled,
        transfersCapability: snapshot.transfersCapability,
        detailsSubmitted: snapshot.detailsSubmitted,
        currentlyDue: snapshot.currentlyDue,
        pastDue: snapshot.pastDue,
        disabledReason: snapshot.disabledReason,
      },
      providerAccountId: snapshot.providerAccountId,
      snapshot,
      eventCreatedAt: new Date(event.created * 1000),
    });

    /*
     * Counts and outcomes only. NEVER the account id, the tutor, or a
     * requirement list — a requirements array names what identity evidence a
     * specific person still owes, which is not something to leave in a log.
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
