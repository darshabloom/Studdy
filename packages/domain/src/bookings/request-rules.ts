/**
 * Versioned configuration for the request slice.
 *
 * Every value here is PROVISIONAL and admin-configurable — the planning pack
 * offers only a "potential model" (Doc 11 §13) and "suggested" payment windows
 * (Doc 04 §23-27). Values live in `platform.rule_settings`; these constants are
 * the seed and the fallback, never the source of truth at runtime.
 *
 * Deadlines calculated from these rules are SNAPSHOTTED onto the record they
 * apply to, together with the rule version used. Changing configuration later
 * never moves a deadline a tutor has already been given (approved decision 5).
 */

export const RULE_KEYS = {
  fanOutCap: 'requests.fan_out_cap',
  responseTiers: 'requests.response_deadline_tiers',
  decisionGraceHours: 'requests.decision_grace_hours',
  minimumNoticeHours: 'requests.minimum_notice_hours',
  requirePaymentMethod: 'requests.require_payment_method_before_send',
} as const;

/**
 * Response-window tiers, matched by how far away the lesson is. The first tier
 * whose `minHoursUntilLesson` is satisfied wins, so order matters: widest
 * first.
 */
export interface ResponseDeadlineTier {
  /** Applies when the lesson is at least this many hours away. */
  readonly minHoursUntilLesson: number;
  /** Hours the tutor gets to respond. */
  readonly responseWindowHours: number;
}

export interface RequestRules {
  readonly fanOutCap: number;
  readonly responseTiers: readonly ResponseDeadlineTier[];
  /** Extra time the requester gets to choose after the last response is due. */
  readonly decisionGraceHours: number;
  /** A lesson may not be requested closer than this to its start. */
  readonly minimumNoticeHours: number;
  /**
   * Whether a payment method must be on file before requests may be sent.
   *
   * Approved policy is TRUE, but it stays DISABLED until the Stripe slice
   * provides a real way to add and verify a card. Enabling it before then
   * would block every request with no way for a user to satisfy it.
   */
  readonly requirePaymentMethodBeforeSend: boolean;
}

/** Provisional seed values. Doc 11 §13's "potential model", labelled as such. */
export const PROVISIONAL_REQUEST_RULES: RequestRules = {
  fanOutCap: 3,
  responseTiers: [
    { minHoursUntilLesson: 48, responseWindowHours: 24 },
    { minHoursUntilLesson: 24, responseWindowHours: 12 },
    { minHoursUntilLesson: 6, responseWindowHours: 4 },
    { minHoursUntilLesson: 0, responseWindowHours: 1 },
  ],
  decisionGraceHours: 24,
  minimumNoticeHours: 2,
  requirePaymentMethodBeforeSend: false,
};
