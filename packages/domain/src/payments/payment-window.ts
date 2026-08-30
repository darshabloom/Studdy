/**
 * The payment window — how long a family has to pay once they have chosen.
 *
 * ONE REQUEST BECOMES ONE BOOKING ONLY IF SOMEBODY PAYS. Selection moves the
 * request to `awaiting_payment` and keeps the winning tutor's calendar held, so
 * the window is the answer to a question the tutor is entitled to have
 * answered: how long is my time spoken for before I get it back?
 *
 * TWO SEPARATE RULES, DELIBERATELY NOT ONE NUMBER.
 *
 *   * `windowMinutes` is how long the family gets. It is the whole rule, and
 *     it is never shortened for any reason.
 *   * `nearLessonCutoffMinutes` is the margin that must still remain between
 *     the payment deadline and the lesson itself.
 *
 * They are kept apart because they answer different questions and will change
 * independently: one is about how long a person needs to find their card, the
 * other about how little notice a tutor can be given. Collapsing them into a
 * single "minimum lead time" would make either change silently alter the other.
 *
 * NOTHING HERE CLAMPS. An earlier design took the earlier of "30 minutes from
 * now" and "2 hours before the lesson", which is where zero and negative
 * windows come from: a lesson 90 minutes away produced a window that had
 * already closed, and the family met a payment screen that was dead on arrival.
 * The deadline is `selectedAt + windowMinutes`, full stop. A lesson too close
 * to carry a full window is REFUSED at selection instead — a clean refusal the
 * family can act on, rather than a payment that expires while they read it.
 *
 * Pure: the caller supplies `selectedAt`, so this is deterministic under test
 * and has no idea a database exists.
 */

export const PAYMENT_RULE_KEYS = {
  windowMinutes: 'payments.window_minutes',
  nearLessonCutoffMinutes: 'payments.near_lesson_cutoff_minutes',
} as const;

export interface PaymentWindowRules {
  /** How long the family has to pay, from the moment they choose. */
  readonly windowMinutes: number;
  /** Margin that must remain between the payment deadline and the lesson. */
  readonly nearLessonCutoffMinutes: number;
}

/**
 * Approved launch values (owner, 2026-08-26): a 60-minute window and a
 * 30-minute cutoff, so selection needs the lesson to be 90 minutes away.
 *
 * These are the seed and the fallback. `platform.rule_settings` is the source
 * of truth at runtime, and the values used are snapshotted onto the request
 * they applied to — changing configuration later never moves a deadline a
 * family or a tutor has already been given.
 */
export const PROVISIONAL_PAYMENT_WINDOW_RULES: PaymentWindowRules = {
  windowMinutes: 60,
  nearLessonCutoffMinutes: 30,
};

const MS_PER_MINUTE = 60 * 1000;

/** Why a selection cannot proceed. One value today; a union so it can grow. */
export type PaymentWindowRefusal = 'lesson_too_close';

export type PaymentWindowOutcome =
  | {
      readonly kind: 'open';
      readonly deadlineAt: Date;
      /** Snapshotted alongside the deadline so the arithmetic stays explainable. */
      readonly windowMinutes: number;
      readonly nearLessonCutoffMinutes: number;
    }
  | {
      readonly kind: 'refused';
      readonly reason: PaymentWindowRefusal;
      /** How far ahead a lesson must be to be selectable, for the message. */
      readonly requiredLeadMinutes: number;
    };

export class InvalidPaymentWindowRulesError extends Error {
  override name = 'InvalidPaymentWindowRulesError';
}

/**
 * How far ahead a lesson must start for its time to be selectable at all.
 *
 * The window plus the cutoff. Exported because the family-facing refusal has to
 * say the number, and because the booking journey may one day want to warn
 * before a family reaches selection rather than after.
 */
export function selectionLeadMinutes(rules: PaymentWindowRules): number {
  assertUsableRules(rules);
  return rules.windowMinutes + rules.nearLessonCutoffMinutes;
}

/**
 * A non-positive window is a configuration error, not an outcome.
 *
 * Checked here rather than trusted, because the whole point of this module is
 * that no input can produce a window that has already closed. Configuration
 * arrives from `rule_settings` as JSON and can be edited by an admin, so
 * "nobody would set that" is not a guarantee.
 */
function assertUsableRules(rules: PaymentWindowRules): void {
  if (!Number.isFinite(rules.windowMinutes) || rules.windowMinutes <= 0) {
    throw new InvalidPaymentWindowRulesError(
      'The payment window must be a positive number of minutes.',
    );
  }
  if (!Number.isFinite(rules.nearLessonCutoffMinutes) || rules.nearLessonCutoffMinutes < 0) {
    throw new InvalidPaymentWindowRulesError(
      'The near-lesson cutoff must be zero or a positive number of minutes.',
    );
  }
}

/**
 * The payment deadline for a selection made now, or a refusal.
 *
 * The boundary is INCLUSIVE: a lesson exactly `windowMinutes + cutoff` away is
 * selectable, and one minute closer is not. An inclusive boundary is the one a
 * person would guess from "you need 90 minutes", and the alternative would make
 * the documented number wrong by a minute.
 */
export function paymentWindowFor(input: {
  readonly selectedAt: Date;
  readonly lessonStartAt: Date;
  readonly rules: PaymentWindowRules;
}): PaymentWindowOutcome {
  const { selectedAt, lessonStartAt, rules } = input;
  assertUsableRules(rules);

  const requiredLeadMinutes = rules.windowMinutes + rules.nearLessonCutoffMinutes;
  const leadMs = lessonStartAt.getTime() - selectedAt.getTime();

  if (leadMs < requiredLeadMinutes * MS_PER_MINUTE) {
    return { kind: 'refused', reason: 'lesson_too_close', requiredLeadMinutes };
  }

  return {
    kind: 'open',
    // Never min()'d against the lesson start. The cutoff above has already
    // proved there is room, so clamping could only ever shorten a window that
    // was known to fit.
    deadlineAt: new Date(selectedAt.getTime() + rules.windowMinutes * MS_PER_MINUTE),
    windowMinutes: rules.windowMinutes,
    nearLessonCutoffMinutes: rules.nearLessonCutoffMinutes,
  };
}

/**
 * What to tell a family whose chosen time is now too close.
 *
 * About the LESSON and what to do next, never about the tutor and never about
 * why the platform needs the time. The same discipline the exclusion reasons
 * follow on the multi-tutor journey.
 */
export function paymentWindowRefusalMessage(requiredLeadMinutes: number): string {
  return (
    `That lesson now starts too soon to arrange payment. ` +
    `Choose a time at least ${String(requiredLeadMinutes)} minutes from now.`
  );
}
