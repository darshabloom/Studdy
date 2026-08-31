import { describe, expect, it } from 'vitest';
import {
  InvalidPricingError,
  MAX_MONEY_MINOR,
  PRICING_RULE_KEYS,
  PROVISIONAL_PRICING_RULES,
  computePaymentBreakdown,
  type PricingRules,
} from './pricing';

/**
 * The money split, without a database and without a provider.
 *
 * The rounding cases are the point. A fee and an entitlement derived
 * independently will disagree on some amount eventually, and the amount it
 * happens on will be a real lesson somebody paid for — so the invariant is
 * asserted directly and swept across a wide range rather than spot-checked.
 */

const NZD = 'NZD';
const ALPHA = PROVISIONAL_PRICING_RULES;

function breakdown(lessonAmountMinor: bigint, rules: PricingRules = ALPHA) {
  return computePaymentBreakdown({ lessonAmountMinor, currencyCode: NZD, rules });
}

describe('the approved launch values', () => {
  it('takes 10% and lets Studdy absorb the processing cost', () => {
    expect(ALPHA.platformFeeRateBps).toBe(1000);
    expect(ALPHA.processingFeePayer).toBe('platform');
  });

  /**
   * Deliberately unset. A percentage invented now would bake a guess about a
   * provider's pricing into the product before anyone had decided the policy.
   */
  it('invents no parent-facing processing fee', () => {
    expect(ALPHA.disclosedProcessingFeeMinor).toBeNull();
  });
});

describe('a $40 lesson', () => {
  it('is $4 to Studdy and $36 to the tutor, with the parent paying $40', () => {
    expect(breakdown(4000n)).toEqual({
      currencyCode: 'NZD',
      lessonAmountMinor: 4000n,
      platformFeeRateBps: 1000,
      platformFeeAmountMinor: 400n,
      tutorEntitlementMinor: 3600n,
      processingFeePayer: 'platform',
      processingFeeChargedMinor: 0n,
      totalChargedMinor: 4000n,
    });
  });

  /** The parent sees the tutor's listed price. Nothing is added on top. */
  it('charges the parent exactly the listed price', () => {
    const result = breakdown(4000n);
    expect(result.totalChargedMinor).toBe(result.lessonAmountMinor);
  });
});

describe('rounding', () => {
  /**
   * $33.33 is the classic case: 10% is 333.3, which no integer represents.
   * The fee rounds and the entitlement takes the remainder, so the two still
   * sum to the lesson exactly.
   */
  it('splits $33.33 without losing or inventing a cent', () => {
    const result = breakdown(3333n);
    expect(result.platformFeeAmountMinor).toBe(333n);
    expect(result.tutorEntitlementMinor).toBe(3000n);
    expect(result.platformFeeAmountMinor + result.tutorEntitlementMinor).toBe(3333n);
  });

  /** Half up, stated rather than inherited from whatever the language does. */
  it('rounds a half-cent fee up', () => {
    // 5 minor units at 10% is exactly 0.5.
    const result = breakdown(5n);
    expect(result.platformFeeAmountMinor).toBe(1n);
    expect(result.tutorEntitlementMinor).toBe(4n);
  });

  it('handles the smallest amounts without going negative', () => {
    for (const [lesson, fee, tutor] of [
      [0n, 0n, 0n],
      [1n, 0n, 1n],
      [4n, 0n, 4n],
      [5n, 1n, 4n],
      [9n, 1n, 8n],
      [10n, 1n, 9n],
    ] as const) {
      const result = breakdown(lesson);
      expect(result.platformFeeAmountMinor).toBe(fee);
      expect(result.tutorEntitlementMinor).toBe(tutor);
    }
  });

  /**
   * THE INVARIANT THE DATABASE ALSO ENFORCES, swept rather than sampled.
   *
   * Every cent from nothing to a thousand dollars, plus a spread of larger and
   * awkward amounts. If any of these disagreed, the CHECK constraint would
   * reject a real payment at the worst possible moment.
   */
  it('always splits the lesson exactly, across every amount tried', () => {
    const amounts: bigint[] = [];
    for (let cents = 0n; cents <= 100_000n; cents += 1n) amounts.push(cents);
    for (const extra of [
      123_456n,
      999_999n,
      1_000_000n,
      33_333_333n,
      7n,
      77n,
      777n,
      7777n,
      MAX_MONEY_MINOR / 2n,
    ]) {
      amounts.push(extra);
    }

    /*
     * Compared in a plain loop and asserted ONCE. Four `expect` calls per
     * amount over a hundred thousand amounts is four hundred thousand
     * assertions, which times the test out without covering anything extra —
     * the breadth is the point, not the assertion count.
     */
    const mismatches = amounts.filter((lesson) => {
      const result = breakdown(lesson);
      return (
        result.platformFeeAmountMinor + result.tutorEntitlementMinor !== lesson ||
        result.platformFeeAmountMinor < 0n ||
        result.tutorEntitlementMinor < 0n ||
        result.totalChargedMinor !== lesson + result.processingFeeChargedMinor
      );
    });
    expect(mismatches).toEqual([]);
  });

  /** The invariant must hold at every rate, not only at 10%. */
  it('splits exactly at other rates too', () => {
    for (const bps of [0, 1, 333, 1000, 1500, 9999, 10_000]) {
      const rules: PricingRules = { ...ALPHA, platformFeeRateBps: bps };
      for (const lesson of [1n, 7n, 3333n, 4000n, 123_457n]) {
        const result = breakdown(lesson, rules);
        expect(result.platformFeeAmountMinor + result.tutorEntitlementMinor).toBe(lesson);
      }
    }
  });
});

describe('the processing-fee policy', () => {
  it('adds no parent surcharge while Studdy absorbs the cost', () => {
    const result = breakdown(4000n);
    expect(result.processingFeePayer).toBe('platform');
    expect(result.processingFeeChargedMinor).toBe(0n);
    expect(result.totalChargedMinor).toBe(4000n);
  });

  /**
   * THE PROPERTY THAT LETS THE POLICY BE TESTED WITH PARENTS LATER.
   *
   * Switching to parent-pays moves the disclosed fee and the total, and moves
   * NOTHING ELSE. The commission, the rate and the tutor's entitlement are
   * identical under both policies — which is why the switch is a rule-settings
   * version rather than a ledger redesign.
   */
  it('changes only the fee and the total when the parent pays', () => {
    const alpha = breakdown(4000n);
    const parentPays = breakdown(4000n, {
      ...ALPHA,
      processingFeePayer: 'payer',
      disclosedProcessingFeeMinor: 138n,
    });

    expect(parentPays.processingFeeChargedMinor).toBe(138n);
    expect(parentPays.totalChargedMinor).toBe(4138n);

    // Untouched by the policy.
    expect(parentPays.lessonAmountMinor).toBe(alpha.lessonAmountMinor);
    expect(parentPays.platformFeeRateBps).toBe(alpha.platformFeeRateBps);
    expect(parentPays.platformFeeAmountMinor).toBe(alpha.platformFeeAmountMinor);
    expect(parentPays.tutorEntitlementMinor).toBe(alpha.tutorEntitlementMinor);
  });

  /**
   * A parent-paid fee that nobody configured is refused, loudly. There is no
   * percentage to fall back on, and guessing one would put an invented number
   * on a receipt.
   */
  it('refuses to charge a parent a fee that has not been configured', () => {
    expect(() =>
      breakdown(4000n, {
        ...ALPHA,
        processingFeePayer: 'payer',
        disclosedProcessingFeeMinor: null,
      }),
    ).toThrow(InvalidPricingError);

    expect(() =>
      breakdown(4000n, {
        ...ALPHA,
        processingFeePayer: 'payer',
        disclosedProcessingFeeMinor: null,
      }),
    ).toThrow(PRICING_RULE_KEYS.disclosedProcessingFeeMinor);
  });

  it('names the disclosed fee as its own rule key, versioned separately', () => {
    expect(PRICING_RULE_KEYS).toEqual({
      platformFeeRateBps: 'payments.platform_fee_rate_bps',
      processingFeePayer: 'payments.processing_fee_payer',
      disclosedProcessingFeeMinor: 'payments.disclosed_processing_fee_minor',
    });
  });
});

describe('money that cannot be represented', () => {
  it('refuses a negative lesson amount', () => {
    expect(() => breakdown(-1n)).toThrow(InvalidPricingError);
  });

  it('refuses an amount larger than money storage allows', () => {
    expect(() => breakdown(MAX_MONEY_MINOR + 1n)).toThrow(InvalidPricingError);
  });

  it('refuses a negative or impossible fee rate', () => {
    for (const bps of [-1, 10_001, 1.5, Number.NaN]) {
      expect(() => breakdown(4000n, { ...ALPHA, platformFeeRateBps: bps })).toThrow(
        InvalidPricingError,
      );
    }
  });

  it('refuses a negative disclosed fee', () => {
    expect(() =>
      breakdown(4000n, {
        ...ALPHA,
        processingFeePayer: 'payer',
        disclosedProcessingFeeMinor: -1n,
      }),
    ).toThrow(InvalidPricingError);
  });

  it('refuses an unknown processing-fee payer', () => {
    expect(() =>
      // A value that could only arrive from misconfigured JSON.
      breakdown(4000n, { ...ALPHA, processingFeePayer: 'somebody_else' as never }),
    ).toThrow(InvalidPricingError);
  });

  it('refuses a currency code that is not ISO 4217 shaped', () => {
    expect(() =>
      computePaymentBreakdown({ lessonAmountMinor: 4000n, currencyCode: 'nz', rules: ALPHA }),
    ).toThrow(TypeError);
  });
});
