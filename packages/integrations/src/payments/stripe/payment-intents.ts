import type Stripe from 'stripe';
import { StripeConfigurationError, StripeSignatureError } from './connect';

/**
 * The Stripe adapter for PAYMENT events — the fulfilment half of the Stripe
 * integration, sitting beside the Connect half rather than replacing it.
 *
 * WHY THIS IS A SEPARATE FILE FROM `connect.ts`, AND A SEPARATE ROUTE FROM THE
 * CONNECT WEBHOOK. Not a preference; Stripe leaves no choice:
 *
 *   - Connect account events are ACCOUNTS V2 THIN events, verified with
 *     `parseEventNotification`, forwarded by the CLI's `--forward-thin-to`.
 *   - PaymentIntent events are V1 SNAPSHOT events, verified with
 *     `constructEvent`, forwarded by `--forward-to`.
 *
 * Two verification APIs, two CLI flags, and — because Stripe issues a signing
 * secret PER ENDPOINT — two secrets. A single route would have to guess which
 * secret and which parser a request wanted before it had verified anything,
 * which is exactly the decision a webhook must not make on unverified input.
 * So the architecture is extended rather than duplicated: same client, same
 * error types, same order of operations, one more endpoint.
 *
 * THE EVENT IS A NOTIFICATION, NOT A SOURCE OF TRUTH. Every handler here
 * re-reads the PaymentIntent from Stripe and acts on THAT. A snapshot event
 * does embed the object, which makes trusting it tempting and wrong: the
 * embedded copy is the state at emission, and delivery can be delayed, retried
 * or reordered. Re-reading makes a stale delivery harmless by construction —
 * the same property the Connect half gets for free from thin events.
 */

/** Studdy's provider discriminator, shared with the Connect adapter. */
export { STRIPE_PROVIDER } from './connect';

/**
 * PaymentIntent events Studdy acts on, and nothing else.
 *
 * DELIBERATELY FOUR. Stripe emits a dozen PaymentIntent events, and Studdy has
 * an opinion only on the ones that change what its own ledger should say:
 *
 *   - `succeeded` — the authoritative fulfilment. The whole slice.
 *   - `processing` — an asynchronous confirmation is in flight. Needed because
 *     the expiry sweep's in-flight guard reads the payment's status: without
 *     this event the payment stays `requires_payment` and the sweep may lapse a
 *     request whose money is already on its way.
 *   - `payment_failed` — an annotation, never a status change. A recoverable
 *     decline must leave the payment `requires_payment` so the family retries
 *     on the same intent; this records WHY, which is what support reads.
 *   - `canceled` — a terminal cancellation. Needed because the partial unique
 *     index counts `requires_payment` as live: an intent cancelled at Stripe
 *     with no matching Studdy status would leave a dead row occupying the one
 *     live-payment slot, and the family could not start a fresh attempt inside
 *     their own window.
 *
 * `charge.*`, refunds and disputes are NOT here. They record history rather
 * than change what Studdy owes, and they belong to the refund slice.
 */
export const HANDLED_PAYMENT_EVENT_TYPES: readonly string[] = [
  'payment_intent.succeeded',
  'payment_intent.processing',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
];

/** A verified v1 snapshot event, reduced to what the route needs to route it. */
export interface VerifiedPaymentEvent {
  readonly id: string;
  readonly type: string;
  /** Event creation time. Recorded, never used to decide an outcome. */
  readonly createdAt: Date;
  /**
   * Stripe's own environment flag on the ENVELOPE.
   *
   * Checked before anything is written. A live-mode event reaching a sandbox
   * deployment means the endpoint is wired to the wrong account, and applying
   * it would move a booking on the strength of a real charge this ledger knows
   * nothing about.
   */
  readonly livemode: boolean;
  /** The PaymentIntent this concerns, when the payload names one. */
  readonly paymentIntentId: string | null;
}

/**
 * Verify a webhook signature and parse the event. NOTHING is written before
 * this succeeds.
 *
 * Takes the RAW body. A parsed-and-restringified body will not verify, because
 * the signature covers the exact bytes Stripe sent.
 *
 * `constructEvent` is the v1 verifier, and it enforces Stripe's timestamp
 * tolerance as well as the HMAC — so a captured body replayed hours later is
 * rejected on age even though its signature is genuine.
 */
export function verifyPaymentEvent(
  stripe: Stripe,
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string | undefined,
): VerifiedPaymentEvent {
  if (webhookSecret === undefined || webhookSecret.trim() === '') {
    throw new StripeConfigurationError(
      'STRIPE_PAYMENTS_WEBHOOK_SECRET is not set. Refusing to process an unverifiable webhook.',
    );
  }
  if (signatureHeader === null || signatureHeader === '') {
    throw new StripeSignatureError('Missing Stripe-Signature header.');
  }
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret);
  } catch {
    // Never chain the cause: the provider's message can describe the secret's
    // shape, and an error chain is a log line waiting to happen.
    throw new StripeSignatureError('Stripe webhook signature verification failed.');
  }
  const object = event.data.object as { object?: unknown; id?: unknown };
  const paymentIntentId =
    object.object === 'payment_intent' && typeof object.id === 'string' ? object.id : null;
  return {
    id: event.id,
    type: event.type,
    createdAt: new Date(event.created * 1000),
    livemode: event.livemode,
    paymentIntentId,
  };
}

/**
 * The correlation Studdy wrote onto the intent at creation.
 *
 * IDS ONLY, and that is the whole design: no names, no emails, no amounts. It
 * is a pointer back into Studdy's own ledger, useless to anybody holding it
 * outside Studdy — and the ledger, never this, is what the amounts are checked
 * against.
 */
export interface StuddyPaymentMetadata {
  readonly paymentId: string | null;
  readonly paymentReference: string | null;
  readonly tutorRequestId: string | null;
}

/**
 * Stripe's authoritative view of a PaymentIntent, in Studdy's own shape.
 *
 * Every Stripe type stops here. What crosses into `@studdy/database` is minor
 * units as `bigint` and an upper-case ISO currency, because that is what the
 * ledger's snapshot holds — and a comparison between two spellings of the same
 * thing is a comparison waiting to be wrong.
 */
export interface AuthoritativePaymentIntent {
  readonly providerPaymentIntentId: string;
  readonly status: string;
  readonly livemode: boolean;
  /** What Stripe was asked for. */
  readonly amountMinor: bigint;
  /** What Stripe actually took. The figure fulfilment is checked against. */
  readonly amountReceivedMinor: bigint;
  /** Upper-case ISO 4217. Stripe returns lower case; normalised here. */
  readonly currencyCode: string;
  readonly chargeId: string | null;
  readonly balanceTransactionId: string | null;
  /**
   * What the provider actually took, from Stripe's balance transaction.
   *
   * NEVER ESTIMATED — null unless Stripe supplied a figure on this read. It is
   * Stripe's own number rather than a model of Stripe's pricing, which is the
   * distinction `provider_cost_minor` exists to keep.
   */
  readonly providerCostMinor: bigint | null;
  readonly lastFailureCode: string | null;
  readonly cancellationReason: string | null;
  readonly metadata: StuddyPaymentMetadata;
}

/** A Stripe reference that may arrive as an id or as an expanded object. */
function idOf(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value !== null && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === 'string' ? id : null;
  }
  return null;
}

/**
 * Read a PaymentIntent's CURRENT state from Stripe, with the charge and its
 * balance transaction expanded.
 *
 * ONE ROUND TRIP, deliberately. The provider cost is only knowable from the
 * balance transaction, and fetching it separately would be a second call that
 * can fail on its own and leave the fulfilment half-informed.
 *
 * The expansion is best-effort: an intent with no charge yet reports nulls, and
 * nothing about fulfilment depends on the cost being present.
 */
export async function retrieveAuthoritativePaymentIntent(
  stripe: Stripe,
  providerPaymentIntentId: string,
): Promise<AuthoritativePaymentIntent> {
  const intent = await stripe.paymentIntents.retrieve(providerPaymentIntentId, {
    expand: ['latest_charge.balance_transaction'],
  });

  const charge = intent.latest_charge ?? null;
  const chargeObject =
    charge !== null && typeof charge === 'object' ? (charge as Stripe.Charge) : null;
  const balanceTransaction = chargeObject?.balance_transaction ?? null;
  const balanceTransactionObject =
    balanceTransaction !== null && typeof balanceTransaction === 'object'
      ? (balanceTransaction as Stripe.BalanceTransaction)
      : null;

  const metadata: Record<string, string> = intent.metadata ?? {};
  return {
    providerPaymentIntentId: intent.id,
    status: intent.status,
    livemode: intent.livemode,
    amountMinor: BigInt(intent.amount),
    amountReceivedMinor: BigInt(intent.amount_received),
    // Stripe speaks lower case; the ledger stores upper. Normalised at the
    // boundary, so the comparison downstream is between like and like.
    currencyCode: intent.currency.toUpperCase(),
    chargeId: idOf(charge),
    balanceTransactionId: idOf(balanceTransaction),
    providerCostMinor:
      balanceTransactionObject === null ? null : BigInt(balanceTransactionObject.fee),
    lastFailureCode: intent.last_payment_error?.code ?? null,
    cancellationReason: intent.cancellation_reason ?? null,
    metadata: {
      paymentId: metadata['studdy_payment_id'] ?? null,
      paymentReference: metadata['studdy_payment_reference'] ?? null,
      tutorRequestId: metadata['studdy_tutor_request_id'] ?? null,
    },
  };
}
