/**
 * What a lesson costs, what Studdy takes, and what the tutor earns.
 *
 * THREE SEPARATE CONCEPTS, never conflated:
 *
 *   1. STUDDY'S COMMISSION — 10% of the tutor's listed price. Studdy's revenue.
 *   2. THE PARENT'S PROCESSING FEE — what a parent is explicitly charged and
 *      shown, on top of the lesson price. Zero while Studdy absorbs the cost.
 *   3. THE PROVIDER'S ACTUAL COST — what Stripe really took. NOT modelled here
 *      at all: it is recorded on the payment row after the fact, from the
 *      provider's own figures, and is never estimated.
 *
 * The third is deliberately absent from this module. A "provider cost" constant
 * would be a guess presented as fact — real card costs vary by card, and the
 * only honest source is the balance transaction after settlement.
 *
 * THE ROUNDING INVARIANT, which is the whole reason this is one function:
 * the fee is computed and rounded, and the entitlement is the REMAINDER. They
 * are never derived independently, so they cannot disagree and the database's
 * arithmetic CHECK can never fail. Compute both from the rate and $33.33 gives
 * 333 + 3000 = 3333 by construction rather than by luck.
 *
 * Pure: no database, no clock, no provider. Every amount is an integer number
 * of minor units as a bigint — floats are prohibited for money.
 */

import { type Money, money } from '../core/money';

/**
 * Rule keys in `platform.rule_settings`.
 *
 * VERSIONED PER KEY, which is the thing to remember. `setRuleSetting`
 * increments from that key's own current row, so the fee rate can sit at v3
 * while the payer policy is still v1. Anything snapshotting these must record
 * ONE VERSION PER KEY — a single "pricing rule version" would claim to describe
 * a decision half of which it could not account for.
 */
export const PRICING_RULE_KEYS = {
  platformFeeRateBps: 'payments.platform_fee_rate_bps',
  processingFeePayer: 'payments.processing_fee_payer',
  /**
   * The explicitly disclosed fee a parent is charged, in minor units.
   *
   * NOT SEEDED, and deliberately so. It has no meaning while Studdy absorbs
   * processing costs, and inventing a percentage now would bake a guess about
   * Stripe's pricing into the product. It is configured at the moment the
   * policy actually changes, alongside the copy that discloses it.
   */
  disclosedProcessingFeeMinor: 'payments.disclosed_processing_fee_minor',
} as const;

/** Who bears the cost of taking the payment. */
export type ProcessingFeePayer = 'platform' | 'payer';

export const PROCESSING_FEE_PAYERS: readonly ProcessingFeePayer[] = ['platform', 'payer'];

export interface PricingRules {
  /** Basis points of the tutor's listed price. 1000 bps = 10%. */
  readonly platformFeeRateBps: number;
  readonly processingFeePayer: ProcessingFeePayer;
  /**
   * What the parent is charged when they bear it. Required when the payer is
   * `payer`, meaningless otherwise.
   */
  readonly disclosedProcessingFeeMinor: bigint | null;
}

/**
 * Approved launch values (owner, 2026-08-26).
 *
 * Studdy takes 10% and absorbs the cost of taking the payment for private
 * alpha. The final public policy is validated with parents before launch, so
 * neither is hard-coded anywhere but here, and both travel through
 * `rule_settings` at runtime.
 */
export const PROVISIONAL_PRICING_RULES: PricingRules = {
  platformFeeRateBps: 1000,
  processingFeePayer: 'platform',
  disclosedProcessingFeeMinor: null,
};

const BPS_DIVISOR = 10_000n;

/**
 * The largest amount a `bigint` money column can hold.
 *
 * Checked in the domain as well as the database so an impossible amount is
 * refused before it reaches a transaction, and with the same bound, rather than
 * surfacing as a driver error nobody can read.
 */
export const MAX_MONEY_MINOR = 9_223_372_036_854_775_807n;

export class InvalidPricingError extends Error {
  override name = 'InvalidPricingError';
}

export interface PaymentBreakdown {
  readonly currencyCode: string;
  /** The tutor's listed price. What the parent sees as the lesson price. */
  readonly lessonAmountMinor: bigint;
  readonly platformFeeRateBps: number;
  readonly platformFeeAmountMinor: bigint;
  /** Listed price minus Studdy's fee. The tutor's money. */
  readonly tutorEntitlementMinor: bigint;
  readonly processingFeePayer: ProcessingFeePayer;
  /** Zero unless the parent bears the processing cost. */
  readonly processingFeeChargedMinor: bigint;
  /** What the parent actually pays. */
  readonly totalChargedMinor: bigint;
}

function assertUsable(lessonAmountMinor: bigint, rules: PricingRules): void {
  if (lessonAmountMinor < 0n) {
    throw new InvalidPricingError('A lesson amount cannot be negative.');
  }
  if (lessonAmountMinor > MAX_MONEY_MINOR) {
    throw new InvalidPricingError('That lesson amount is larger than money storage allows.');
  }
  const { platformFeeRateBps: bps } = rules;
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) {
    throw new InvalidPricingError(
      'The platform fee rate must be a whole number of basis points between 0 and 10000.',
    );
  }
  if (!PROCESSING_FEE_PAYERS.includes(rules.processingFeePayer)) {
    throw new InvalidPricingError('Unknown processing-fee payer.');
  }
}

/**
 * What the parent is charged on top of the lesson, and who decided it.
 *
 * When Studdy absorbs the cost the answer is zero — not "the provider's cost,
 * borne elsewhere", just zero, because nothing extra is charged. When the payer
 * bears it, the amount must have been CONFIGURED: there is no percentage to
 * fall back on, and guessing one would put an invented number on a receipt.
 */
function processingFeeFor(rules: PricingRules): bigint {
  if (rules.processingFeePayer === 'platform') return 0n;

  const disclosed = rules.disclosedProcessingFeeMinor;
  if (disclosed === null) {
    throw new InvalidPricingError(
      'A parent-paid processing fee must be configured before it can be charged. ' +
        `Set ${PRICING_RULE_KEYS.disclosedProcessingFeeMinor}.`,
    );
  }
  if (disclosed < 0n) throw new InvalidPricingError('A processing fee cannot be negative.');
  return disclosed;
}

/**
 * Split a lesson price into Studdy's fee and the tutor's entitlement.
 *
 * Rounded HALF UP on the fee, then the entitlement takes the remainder. Half up
 * because it is what a person doing this on paper would do, and because the
 * direction has to be written down somewhere rather than inherited from
 * whatever the language does.
 *
 * SWITCHING THE PROCESSING-FEE POLICY MOVES TWO FIELDS AND NO OTHERS.
 * `processingFeeChargedMinor` and `totalChargedMinor` change; the lesson
 * amount, the rate, Studdy's fee and the tutor's entitlement are identical
 * under both policies. That is the property that lets the policy be tested with
 * parents later without redesigning the ledger.
 */
export function computePaymentBreakdown(input: {
  readonly lessonAmountMinor: bigint;
  readonly currencyCode: string;
  readonly rules: PricingRules;
}): PaymentBreakdown {
  const { lessonAmountMinor, currencyCode, rules } = input;
  assertUsable(lessonAmountMinor, rules);
  // Validates the ISO code and rejects a float amount in one place.
  money(lessonAmountMinor, currencyCode);

  const scaled = lessonAmountMinor * BigInt(rules.platformFeeRateBps);
  // Half up. Both operands are non-negative, so adding half the divisor before
  // flooring is exactly round-half-up with no sign cases to reason about.
  const platformFeeAmountMinor = (scaled + BPS_DIVISOR / 2n) / BPS_DIVISOR;
  // THE REMAINDER, never a second rounded calculation.
  const tutorEntitlementMinor = lessonAmountMinor - platformFeeAmountMinor;

  const processingFeeChargedMinor = processingFeeFor(rules);
  const totalChargedMinor = lessonAmountMinor + processingFeeChargedMinor;

  return {
    currencyCode,
    lessonAmountMinor,
    platformFeeRateBps: rules.platformFeeRateBps,
    platformFeeAmountMinor,
    tutorEntitlementMinor,
    processingFeePayer: rules.processingFeePayer,
    processingFeeChargedMinor,
    totalChargedMinor,
  };
}

/** The breakdown's money values, for callers that speak `Money`. */
export function breakdownAsMoney(breakdown: PaymentBreakdown): {
  readonly lesson: Money;
  readonly platformFee: Money;
  readonly tutorEntitlement: Money;
  readonly processingFee: Money;
  readonly total: Money;
} {
  const at = (amount: bigint): Money => money(amount, breakdown.currencyCode);
  return {
    lesson: at(breakdown.lessonAmountMinor),
    platformFee: at(breakdown.platformFeeAmountMinor),
    tutorEntitlement: at(breakdown.tutorEntitlementMinor),
    processingFee: at(breakdown.processingFeeChargedMinor),
    total: at(breakdown.totalChargedMinor),
  };
}
