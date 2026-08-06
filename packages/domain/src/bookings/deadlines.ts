import type { RequestRules, ResponseDeadlineTier } from './request-rules';

const MS_PER_HOUR = 60 * 60 * 1000;

export interface DeadlineCalculation {
  /** When every invited tutor must have responded by. */
  readonly respondByAt: Date;
  /** When the requester must have chosen by. */
  readonly decisionDeadlineAt: Date;
  /** The tier that produced the response window, for auditability. */
  readonly appliedTier: ResponseDeadlineTier;
}

function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_HOUR;
}

/** Select the tier for a lesson that is `hoursUntilLesson` away. */
export function selectResponseTier(
  rules: RequestRules,
  hoursUntilLesson: number,
): ResponseDeadlineTier {
  const ordered = [...rules.responseTiers].sort(
    (a, b) => b.minHoursUntilLesson - a.minHoursUntilLesson,
  );
  const match = ordered.find((tier) => hoursUntilLesson >= tier.minHoursUntilLesson);
  // The 0-hour tier always matches a future lesson; fall back to the tightest
  // configured window if configuration is missing one.
  return match ?? (ordered[ordered.length - 1] as ResponseDeadlineTier);
}

/**
 * Calculate both deadlines for a request.
 *
 * Neither deadline may fall after the lesson itself becomes unbookable: both
 * are clamped to `proposedStartAt` minus the platform's minimum notice. A
 * short-notice request therefore gets a genuinely short window rather than a
 * nominal one that expires after the lesson would have started.
 *
 * Pure: the caller supplies `now`, so this is deterministic under test.
 */
export function calculateDeadlines(
  rules: RequestRules,
  proposedStartAt: Date,
  now: Date,
): DeadlineCalculation {
  const hoursUntilLesson = hoursBetween(now, proposedStartAt);
  const appliedTier = selectResponseTier(rules, hoursUntilLesson);

  const latestUsefulMoment = new Date(
    proposedStartAt.getTime() - rules.minimumNoticeHours * MS_PER_HOUR,
  );

  const naiveRespondBy = new Date(now.getTime() + appliedTier.responseWindowHours * MS_PER_HOUR);
  const respondByAt = new Date(
    Math.min(naiveRespondBy.getTime(), Math.max(latestUsefulMoment.getTime(), now.getTime())),
  );

  const naiveDecision = new Date(respondByAt.getTime() + rules.decisionGraceHours * MS_PER_HOUR);
  const decisionDeadlineAt = new Date(
    Math.min(
      naiveDecision.getTime(),
      Math.max(latestUsefulMoment.getTime(), respondByAt.getTime()),
    ),
  );

  return { respondByAt, decisionDeadlineAt, appliedTier };
}
