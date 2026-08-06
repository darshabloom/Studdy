import { describe, expect, it } from 'vitest';
import { assignPositions, validateFanOut, type FanOutInput } from './fan-out';
import { PROVISIONAL_REQUEST_RULES, type RequestRules } from './request-rules';

const now = new Date('2026-08-10T09:00:00.000Z');
const start = new Date('2026-08-15T09:00:00.000Z');
const end = new Date('2026-08-15T10:00:00.000Z');

function input(overrides: Partial<FanOutInput> = {}): FanOutInput {
  return {
    targets: [
      { tutorProfileId: 'tutor-a', serviceVersionId: 'sv-a' },
      { tutorProfileId: 'tutor-b', serviceVersionId: 'sv-b' },
    ],
    proposedStartAt: start,
    proposedEndAt: end,
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
    const result = validateFanOut(rules, input({ proposedStartAt: past, proposedEndAt: now }), now);
    expect(issuesOf(result)['proposedStartAt']).toMatch(/in the future/i);
  });

  it('enforces minimum notice', () => {
    const soon = new Date(now.getTime() + 30 * 60 * 1000);
    const soonEnd = new Date(soon.getTime() + 60 * 60 * 1000);
    const result = validateFanOut(
      rules,
      input({ proposedStartAt: soon, proposedEndAt: soonEnd }),
      now,
    );
    expect(issuesOf(result)['proposedStartAt']).toMatch(/at least 2 hours/i);
  });

  it('rejects an end time at or before the start', () => {
    expect(
      issuesOf(validateFanOut(rules, input({ proposedEndAt: start }), now))['proposedEndAt'],
    ).toMatch(/end after it starts/i);
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

describe('assignPositions', () => {
  it('numbers tutors from one in the order chosen', () => {
    const positions = assignPositions([
      { tutorProfileId: 'a', serviceVersionId: 'sv-a' },
      { tutorProfileId: 'b', serviceVersionId: 'sv-b' },
    ]);
    expect(positions.map((entry) => entry.position)).toEqual([1, 2]);
  });
});
