import type Stripe from 'stripe';

/**
 * Stripe refunds — the provider half of giving a parent's money back.
 *
 * THIS FILE ONLY TALKS TO STRIPE. Whether a refund is allowed, how much, and
 * what Studdy records are decided in `@studdy/domain` and `@studdy/database`;
 * what crosses in here is a payment intent id, an amount in minor units and an
 * idempotency key, and what comes back is a Studdy-shaped snapshot.
 *
 * NO `reverse_transfer`, and that is deliberate rather than forgotten. Studdy
 * uses separate charges and transfers, and a payment is only ever refunded here
 * when NO booking was made — which means no tutor obligation was ever created
 * and no transfer exists to reverse. The money is still in Studdy's own Stripe
 * balance. Refunding a lesson that was booked, with a transfer that may already
 * have gone, is the cancellation slice's problem and needs its own parameters.
 *
 * NO `reason`. Stripe's three values (`duplicate`, `fraudulent`,
 * `requested_by_customer`) all assert something about WHY that is not true
 * here, and a reason recorded on Stripe's side cannot be corrected later. The
 * real reason lives on Studdy's refund row.
 */

export interface StripeRefundSnapshot {
  readonly providerRefundId: string;
  /** Stripe's own status, untouched: `pending`, `succeeded`, `failed`, `canceled`, `requires_action`. */
  readonly providerStatus: string;
  readonly amountMinor: bigint;
  /** Upper case, normalised at the boundary like every other currency here. */
  readonly currencyCode: string;
  /** Stripe's machine-readable reason a refund failed or was cancelled. */
  readonly failureReason: string | null;
  readonly providerPaymentIntentId: string | null;
}

function snapshotOf(refund: Stripe.Refund): StripeRefundSnapshot {
  const paymentIntent = refund.payment_intent ?? null;
  return {
    providerRefundId: refund.id,
    providerStatus: refund.status ?? 'pending',
    amountMinor: BigInt(refund.amount),
    currencyCode: refund.currency.toUpperCase(),
    failureReason: refund.failure_reason ?? null,
    providerPaymentIntentId:
      paymentIntent === null
        ? null
        : typeof paymentIntent === 'string'
          ? paymentIntent
          : paymentIntent.id,
  };
}

export interface CreateRefundInput {
  readonly providerPaymentIntentId: string;
  /** Minor units. ALWAYS stated: never leave the amount to Stripe's default. */
  readonly amountMinor: bigint;
  /** Stable per attempt. Stripe returns the SAME refund for a repeated key. */
  readonly idempotencyKey: string;
  /** Studdy's own ids, for support to correlate. Never a person. */
  readonly studdyRefundId: string;
  readonly studdyPaymentId: string;
}

/**
 * Ask Stripe to refund a payment.
 *
 * THE IDEMPOTENCY KEY IS WHAT MAKES A CRASH SURVIVABLE. Studdy writes its own
 * `requested` row first, then calls this; if the process dies before recording
 * the answer, the reconcile pass calls this again with the same key and Stripe
 * hands back the refund it already made rather than making a second one.
 *
 * The amount is passed explicitly and as a safe integer. A BigInt that does not
 * fit is refused here rather than silently rounded.
 */
export async function createRefund(
  stripe: Stripe,
  input: CreateRefundInput,
): Promise<StripeRefundSnapshot> {
  if (input.amountMinor <= 0n || input.amountMinor > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('A refund amount must be a positive, safe integer of minor units.');
  }
  const refund = await stripe.refunds.create(
    {
      payment_intent: input.providerPaymentIntentId,
      amount: Number(input.amountMinor),
      metadata: {
        studdy_refund_id: input.studdyRefundId,
        studdy_payment_id: input.studdyPaymentId,
      },
    },
    { idempotencyKey: input.idempotencyKey },
  );
  return snapshotOf(refund);
}

/** Read a refund back. THE FETCH IS THE AUTHORITY on a pending refund's outcome. */
export async function retrieveRefund(
  stripe: Stripe,
  providerRefundId: string,
): Promise<StripeRefundSnapshot> {
  return snapshotOf(await stripe.refunds.retrieve(providerRefundId));
}

/**
 * Find a refund Studdy already asked for, by Studdy's OWN id.
 *
 * WHY THE IDEMPOTENCY KEY IS NOT ENOUGH. Stripe honours a key for twenty-four
 * hours. A refund row left `requested` for longer than that — the reconcile
 * pass was down, the deploy was broken — and then retried with the same key
 * would not be recognised as a repeat, and could issue a SECOND refund. Asking
 * Stripe what it already holds for this payment, and adopting the refund whose
 * metadata names this Studdy refund, closes that window completely rather than
 * relying on a time limit nobody is watching.
 *
 * Reads at most the first page; one payment has at most a handful of refunds.
 */
export async function findRefundByStuddyId(
  stripe: Stripe,
  providerPaymentIntentId: string,
  studdyRefundId: string,
): Promise<StripeRefundSnapshot | null> {
  const page = await stripe.refunds.list({ payment_intent: providerPaymentIntentId, limit: 20 });
  const match = page.data.find(
    (refund) => refund.metadata?.['studdy_refund_id'] === studdyRefundId,
  );
  return match === undefined ? null : snapshotOf(match);
}

export interface RefundErrorClassification {
  /**
   * True when Stripe has definitively REFUSED, and asking again cannot help:
   * the payment is already refunded, the amount is wrong, the charge is gone.
   * False for everything that is merely a failure to get an answer — a network
   * error, a rate limit, a bad key — where the right move is to leave the refund
   * `requested` and ask again later.
   */
  readonly definitive: boolean;
  /** Stripe's machine-readable code, e.g. `charge_already_refunded`. Operational. */
  readonly code: string | null;
}

/**
 * Decide whether a Stripe error ends a refund attempt or merely interrupts it.
 *
 * DEFAULTS TO "NOT DEFINITIVE". Marking a refund `failed` raises an ops alert
 * and lets a new attempt be made, so doing it for a transient fault would be
 * both noisy and — if the first request actually reached Stripe — a route to a
 * double refund. Only the two error types that mean "Stripe understood and said
 * no" qualify. Duck-typed on `type`, because the web layer does not import the
 * SDK and an `instanceof` across a package boundary is fragile.
 */
export function classifyRefundError(error: unknown): RefundErrorClassification {
  if (typeof error !== 'object' || error === null) return { definitive: false, code: null };
  const { type, code } = error as { type?: unknown; code?: unknown };
  const definitive = type === 'StripeInvalidRequestError' || type === 'StripeCardError';
  return { definitive, code: typeof code === 'string' ? code : null };
}
