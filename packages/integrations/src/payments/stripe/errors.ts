export interface StripeErrorClassification {
  /**
   * True when Stripe has definitively REFUSED, and asking again cannot help: the
   * payment is already refunded, the amount is wrong, the destination cannot
   * receive transfers, the object is gone. False for everything that is merely a
   * failure to get an answer — a network error, a rate limit, a bad key — where
   * the right move is to leave the work `pending` and ask again later.
   */
  readonly definitive: boolean;
  /** Stripe's machine-readable code, e.g. `charge_already_refunded`. Operational. */
  readonly code: string | null;
}

/**
 * Decide whether a Stripe error ENDS a money-moving attempt or merely interrupts it.
 *
 * DEFAULTS TO "NOT DEFINITIVE". Recording a refund or a transfer as failed raises
 * an alert and lets a new attempt be made, so doing it for a transient fault
 * would be both noisy and — if the first request actually reached Stripe — a
 * route to paying twice. Only the two error types that mean "Stripe understood
 * and said no" qualify.
 *
 * Duck-typed on `type`, because the web layer does not import the SDK and an
 * `instanceof` across a package boundary is fragile. Shared by refunds and
 * transfers so the two cannot come to judge Stripe's answers differently.
 */
export function classifyStripeError(error: unknown): StripeErrorClassification {
  if (typeof error !== 'object' || error === null) return { definitive: false, code: null };
  const { type, code } = error as { type?: unknown; code?: unknown };
  const definitive = type === 'StripeInvalidRequestError' || type === 'StripeCardError';
  return { definitive, code: typeof code === 'string' ? code : null };
}
