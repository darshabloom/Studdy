import { describe, expect, it } from 'vitest';
import {
  InvalidPaymentWindowRulesError,
  PROVISIONAL_PAYMENT_WINDOW_RULES,
  paymentWindowFor,
  paymentWindowRefusalMessage,
  selectionLeadMinutes,
  type PaymentWindowRules,
} from './payment-window';

/**
 * The payment window, without a database and without a clock.
 *
 * The boundary cases are the point of this file. A window that has already
 * closed is the specific failure this module exists to make unrepresentable, so
 * it is asserted directly rather than inferred from the happy path.
 */

const RULES = PROVISIONAL_PAYMENT_WINDOW_RULES;
const SELECTED_AT = new Date('2026-09-01T04:00:00.000Z');

/** A lesson `minutes` after the moment of selection. */
function lessonIn(minutes: number): Date {
  return new Date(SELECTED_AT.getTime() + minutes * 60_000);
}

describe('the approved launch values', () => {
  it('is a 60-minute window and a 30-minute cutoff', () => {
    expect(RULES.windowMinutes).toBe(60);
    expect(RULES.nearLessonCutoffMinutes).toBe(30);
  });

  /**
   * The number the family-facing copy quotes. It is DERIVED from the two rules
   * rather than written down separately, so changing either rule cannot leave
   * the message quoting a figure the system no longer enforces.
   */
  it('requires 90 minutes of lead time, derived rather than restated', () => {
    expect(selectionLeadMinutes(RULES)).toBe(90);
  });
});

describe('the near-lesson boundary', () => {
  it('allows a lesson exactly 90 minutes away', () => {
    const outcome = paymentWindowFor({
      selectedAt: SELECTED_AT,
      lessonStartAt: lessonIn(90),
      rules: RULES,
    });
    expect(outcome.kind).toBe('open');
  });

  it('allows a lesson one minute beyond the boundary', () => {
    const outcome = paymentWindowFor({
      selectedAt: SELECTED_AT,
      lessonStartAt: lessonIn(91),
      rules: RULES,
    });
    expect(outcome.kind).toBe('open');
  });

  it('refuses a lesson one minute inside the boundary', () => {
    const outcome = paymentWindowFor({
      selectedAt: SELECTED_AT,
      lessonStartAt: lessonIn(89),
      rules: RULES,
    });
    expect(outcome).toEqual({
      kind: 'refused',
      reason: 'lesson_too_close',
      requiredLeadMinutes: 90,
    });
  });

  /**
   * A lesson already under way, or in the past, is refused by the same rule
   * rather than by a special case — there is only one boundary to reason about.
   */
  it('refuses a lesson that has already started', () => {
    for (const minutes of [0, -1, -600]) {
      const outcome = paymentWindowFor({
        selectedAt: SELECTED_AT,
        lessonStartAt: lessonIn(minutes),
        rules: RULES,
      });
      expect(outcome.kind).toBe('refused');
    }
  });
});

describe('the deadline itself', () => {
  it('is exactly the selection moment plus the window', () => {
    const outcome = paymentWindowFor({
      selectedAt: SELECTED_AT,
      lessonStartAt: lessonIn(90),
      rules: RULES,
    });
    if (outcome.kind !== 'open') throw new Error('expected an open window');
    expect(outcome.deadlineAt.toISOString()).toBe('2026-09-01T05:00:00.000Z');
  });

  /**
   * THE FAILURE THIS MODULE EXISTS TO PREVENT.
   *
   * The previous design took the earlier of "now + window" and "lesson start −
   * cutoff", which produced a deadline in the past for a lesson 90 minutes
   * away. Here the deadline is the window and nothing else, so a lesson right
   * on the boundary still gets its full hour.
   */
  it('never shortens the window, however close the lesson', () => {
    for (const minutes of [90, 91, 95, 120, 60 * 24]) {
      const outcome = paymentWindowFor({
        selectedAt: SELECTED_AT,
        lessonStartAt: lessonIn(minutes),
        rules: RULES,
      });
      if (outcome.kind !== 'open') throw new Error(`expected an open window at ${String(minutes)}`);
      const windowMs = outcome.deadlineAt.getTime() - SELECTED_AT.getTime();
      expect(windowMs).toBe(60 * 60_000);
    }
  });

  /**
   * Swept broadly rather than at chosen points: no lead time that is accepted
   * may yield a deadline at or before the moment of selection.
   */
  it('produces a strictly positive window for every accepted lead time', () => {
    for (let minutes = 90; minutes <= 60 * 48; minutes += 7) {
      const outcome = paymentWindowFor({
        selectedAt: SELECTED_AT,
        lessonStartAt: lessonIn(minutes),
        rules: RULES,
      });
      if (outcome.kind !== 'open') throw new Error(`unexpectedly refused at ${String(minutes)}`);
      expect(outcome.deadlineAt.getTime()).toBeGreaterThan(SELECTED_AT.getTime());
    }
  });

  it('carries the rule inputs so the arithmetic stays explainable', () => {
    const outcome = paymentWindowFor({
      selectedAt: SELECTED_AT,
      lessonStartAt: lessonIn(600),
      rules: RULES,
    });
    if (outcome.kind !== 'open') throw new Error('expected an open window');
    expect(outcome.windowMinutes).toBe(60);
    expect(outcome.nearLessonCutoffMinutes).toBe(30);
  });
});

describe('the two rules stay independent', () => {
  /**
   * Configuration is a JSON value an admin can edit, so the two must be shown
   * to move separately rather than being two names for one number.
   */
  it('moves the boundary without moving the window', () => {
    const rules: PaymentWindowRules = { windowMinutes: 60, nearLessonCutoffMinutes: 120 };
    expect(selectionLeadMinutes(rules)).toBe(180);

    expect(
      paymentWindowFor({ selectedAt: SELECTED_AT, lessonStartAt: lessonIn(179), rules }).kind,
    ).toBe('refused');

    const outcome = paymentWindowFor({
      selectedAt: SELECTED_AT,
      lessonStartAt: lessonIn(180),
      rules,
    });
    if (outcome.kind !== 'open') throw new Error('expected an open window');
    expect(outcome.deadlineAt.getTime() - SELECTED_AT.getTime()).toBe(60 * 60_000);
  });

  it('moves the window without moving the cutoff', () => {
    const rules: PaymentWindowRules = { windowMinutes: 15, nearLessonCutoffMinutes: 30 };
    const outcome = paymentWindowFor({
      selectedAt: SELECTED_AT,
      lessonStartAt: lessonIn(45),
      rules,
    });
    if (outcome.kind !== 'open') throw new Error('expected an open window');
    expect(outcome.deadlineAt.getTime() - SELECTED_AT.getTime()).toBe(15 * 60_000);
  });
});

describe('misconfiguration', () => {
  /**
   * Refused loudly rather than absorbed. A zero or negative window is not a
   * business outcome this system has any way to honour, so it must never reach
   * a family as a payment screen that is already dead.
   */
  it('refuses a window that is not a positive number of minutes', () => {
    for (const windowMinutes of [0, -30, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        paymentWindowFor({
          selectedAt: SELECTED_AT,
          lessonStartAt: lessonIn(600),
          rules: { windowMinutes, nearLessonCutoffMinutes: 30 },
        }),
      ).toThrow(InvalidPaymentWindowRulesError);
    }
  });

  it('refuses a negative cutoff, but allows zero', () => {
    expect(() =>
      paymentWindowFor({
        selectedAt: SELECTED_AT,
        lessonStartAt: lessonIn(600),
        rules: { windowMinutes: 60, nearLessonCutoffMinutes: -1 },
      }),
    ).toThrow(InvalidPaymentWindowRulesError);

    expect(
      paymentWindowFor({
        selectedAt: SELECTED_AT,
        lessonStartAt: lessonIn(60),
        rules: { windowMinutes: 60, nearLessonCutoffMinutes: 0 },
      }).kind,
    ).toBe('open');
  });
});

describe('the refusal message', () => {
  it('says what to do next and quotes the enforced number', () => {
    expect(paymentWindowRefusalMessage(90)).toBe(
      'That lesson now starts too soon to arrange payment. Choose a time at least 90 minutes from now.',
    );
  });

  /** About the lesson, never about the tutor and never about the platform. */
  it('says nothing about the tutor or about why the platform needs the time', () => {
    const message = paymentWindowRefusalMessage(90).toLowerCase();
    for (const forbidden of ['tutor', 'stripe', 'payment window', 'hold', 'calendar']) {
      expect(message).not.toContain(forbidden);
    }
  });
});
