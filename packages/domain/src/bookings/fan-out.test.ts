import { describe, expect, it } from 'vitest';
import { assignPositions, offeredSubset, validateFanOut, type FanOutInput } from './fan-out';
import { PROVISIONAL_REQUEST_RULES, type RequestRules } from './request-rules';

const now = new Date('2026-08-10T09:00:00.000Z');
const start = new Date('2026-08-15T09:00:00.000Z');
const laterStart = new Date('2026-08-16T09:00:00.000Z');

function input(overrides: Partial<FanOutInput> = {}): FanOutInput {
  return {
    targets: [
      { tutorProfileId: 'tutor-a', serviceVersionId: 'sv-a' },
      { tutorProfileId: 'tutor-b', serviceVersionId: 'sv-b' },
    ],
    proposedStarts: [start, laterStart],
    durationMinutes: 60,
    formatCode: 'online',
    hasPaymentMethodOnFile: false,
    paymentExemptionCode: null,
    ...overrides,
  };
}

function issuesOf(result: ReturnType<typeof validateFanOut>): Record<string, string> {
  if (result.ok) throw new Error('expected failure');
  return (result.error.details?.['issues'] ?? {}) as Record<string, string>;
}

describe('validateFanOut', () => {
  const rules: RequestRules = PROVISIONAL_REQUEST_RULES;

  it('accepts a valid fan-out and derives the duration', () => {
    const result = validateFanOut(rules, input(), now);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.durationMinutes).toBe(60);
  });

  it('requires at least one tutor', () => {
    expect(issuesOf(validateFanOut(rules, input({ targets: [] }), now))['targets']).toMatch(
      /at least one tutor/i,
    );
  });

  it('enforces the fan-out cap', () => {
    const four = ['a', 'b', 'c', 'd'].map((id) => ({
      tutorProfileId: id,
      serviceVersionId: `sv-${id}`,
    }));
    expect(issuesOf(validateFanOut(rules, input({ targets: four }), now))['targets']).toMatch(
      /at most 3 tutors/i,
    );
  });

  it('rejects the same tutor twice', () => {
    const duplicate = [
      { tutorProfileId: 'tutor-a', serviceVersionId: 'sv-1' },
      { tutorProfileId: 'tutor-a', serviceVersionId: 'sv-2' },
    ];
    expect(issuesOf(validateFanOut(rules, input({ targets: duplicate }), now))['targets']).toMatch(
      /only be asked once/i,
    );
  });

  it('rejects a lesson in the past', () => {
    const past = new Date(now.getTime() - 60 * 60 * 1000);
    const result = validateFanOut(rules, input({ proposedStarts: [past, laterStart] }), now);
    expect(issuesOf(result)['times']).toMatch(/in the future/i);
  });

  it('enforces minimum notice on every offered time, not just the first', () => {
    // A tutor may accept any of them, so a time that is already too close is
    // not a lesser option — it is one they could be asked to honour.
    const soon = new Date(now.getTime() + 30 * 60 * 1000);
    const result = validateFanOut(rules, input({ proposedStarts: [laterStart, soon] }), now);
    expect(issuesOf(result)['times']).toMatch(/at least 2 hours/i);
  });

  it('requires at least two different times', () => {
    expect(
      issuesOf(validateFanOut(rules, input({ proposedStarts: [start] }), now))['times'],
    ).toMatch(/at least 2 different times/i);
  });

  it('does not let the same time twice satisfy the minimum', () => {
    // Two identical times are one choice. Counting them as two would let a
    // family meet the bound while giving a tutor no alternative at all.
    const twice = [start, new Date(start.getTime())];
    expect(issuesOf(validateFanOut(rules, input({ proposedStarts: twice }), now))['times']).toMatch(
      /at least 2 different times/i,
    );
  });

  it('rejects more times than the cap', () => {
    const six = Array.from(
      { length: 6 },
      (_unused, index) => new Date(start.getTime() + index * 86_400_000),
    );
    expect(issuesOf(validateFanOut(rules, input({ proposedStarts: six }), now))['times']).toMatch(
      /no more than 5 times/i,
    );
  });

  it('returns the offered times chronologically and de-duplicated', () => {
    const result = validateFanOut(
      rules,
      input({ proposedStarts: [laterStart, start, new Date(start.getTime())] }),
      now,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.proposedStarts.map((at) => at.toISOString())).toEqual([
        start.toISOString(),
        laterStart.toISOString(),
      ]);
    }
  });

  it('rejects an unknown format', () => {
    expect(
      issuesOf(validateFanOut(rules, input({ formatCode: 'hybrid' }), now))['formatCode'],
    ).toBe('Choose whether the lesson is online or in person.');
  });

  describe('card-on-file gate', () => {
    const gated: RequestRules = { ...rules, requirePaymentMethodBeforeSend: true };

    it('is disabled by default until the Stripe slice lands', () => {
      expect(rules.requirePaymentMethodBeforeSend).toBe(false);
      expect(validateFanOut(rules, input({ hasPaymentMethodOnFile: false }), now).ok).toBe(true);
    });

    it('blocks sending when enabled and no payment method is on file', () => {
      const result = validateFanOut(gated, input({ hasPaymentMethodOnFile: false }), now);
      expect(issuesOf(result)['paymentMethod']).toMatch(/will not be charged now/i);
    });

    it('allows sending when enabled and a payment method exists', () => {
      expect(validateFanOut(gated, input({ hasPaymentMethodOnFile: true }), now).ok).toBe(true);
    });

    it('allows sending under an approved exemption', () => {
      const result = validateFanOut(
        gated,
        input({ hasPaymentMethodOnFile: false, paymentExemptionCode: 'free_trial' }),
        now,
      );
      expect(result.ok).toBe(true);
    });
  });
});

describe('offeredSubset', () => {
  const a = new Date('2026-08-15T09:00:00.000Z');
  const b = new Date('2026-08-16T09:00:00.000Z');
  const c = new Date('2026-08-17T09:00:00.000Z');

  it('offers a tutor only the times they can actually do', () => {
    expect(offeredSubset([a, b, c], [b, c]).map((at) => at.toISOString())).toEqual([
      b.toISOString(),
      c.toISOString(),
    ]);
  });

  it('keeps the family order rather than the tutor calendar order', () => {
    expect(offeredSubset([a, b], [b, a]).map((at) => at.toISOString())).toEqual([
      a.toISOString(),
      b.toISOString(),
    ]);
  });

  it('is empty when the tutor can do none of them', () => {
    // The caller must not send this tutor a request at all: an unanswerable
    // request is worse than no request.
    expect(offeredSubset([a, b], [c])).toEqual([]);
  });

  it('matches on the instant, not object identity', () => {
    expect(offeredSubset([a], [new Date(a.getTime())])).toHaveLength(1);
  });
});

describe('assignPositions', () => {
  it('numbers tutors from one in the order chosen', () => {
    const positions = assignPositions([
      { tutorProfileId: 'a', serviceVersionId: 'sv-a' },
      { tutorProfileId: 'b', serviceVersionId: 'sv-b' },
    ]);
    expect(positions.map((entry) => entry.position)).toEqual([1, 2]);
  });
});
