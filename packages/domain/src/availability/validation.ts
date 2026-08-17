import { domainError } from '../core/errors';
import { fail, ok, type CommandResult } from '../core/result';
import { zonedTimeToUtc } from './slots';

/**
 * Validation for tutor availability entry.
 *
 * These rules exist to stop a tutor accidentally publishing something they did
 * not mean — a window that ends before it starts, a block in the past, a
 * fifteen-hour teaching day. Every message is written for the tutor, not for a
 * developer, because these are the ones they will actually read.
 */

export const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** Guard against a mis-typed window swallowing a whole day. */
const MAX_DAILY_HOURS = 12;

export interface AvailabilityRuleInput {
  readonly dayOfWeek: string;
  readonly localStartTime: string;
  readonly localEndTime: string;
  readonly ianaTimeZone: string;
}

export interface ValidatedAvailabilityRule {
  readonly dayOfWeek: number;
  readonly localStartTime: string;
  readonly localEndTime: string;
  readonly ianaTimeZone: string;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function minutesOfDay(value: string): number | null {
  const match = TIME_PATTERN.exec(value);
  if (match === null) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function validateAvailabilityRule(
  input: AvailabilityRuleInput,
): CommandResult<ValidatedAvailabilityRule> {
  const issues: Record<string, string> = {};

  const dayOfWeek = Number(input.dayOfWeek);
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    issues['dayOfWeek'] = 'Choose a day of the week.';
  }

  const start = minutesOfDay(input.localStartTime);
  const end = minutesOfDay(input.localEndTime);
  if (start === null) issues['localStartTime'] = 'Enter a start time, for example 16:00.';
  if (end === null) issues['localEndTime'] = 'Enter an end time, for example 18:00.';

  if (start !== null && end !== null) {
    if (end <= start) {
      issues['localEndTime'] = 'The end time needs to be after the start time.';
    } else if (end - start > MAX_DAILY_HOURS * 60) {
      issues['localEndTime'] =
        `That is more than ${String(MAX_DAILY_HOURS)} hours in one day. Add separate blocks if you really do teach that long.`;
    }
  }

  if (!isValidTimeZone(input.ianaTimeZone)) {
    issues['ianaTimeZone'] = 'That time zone is not one we recognise.';
  }

  if (Object.keys(issues).length > 0) {
    return fail(domainError('VALIDATION_FAILED', 'Please check the highlighted fields.', issues));
  }

  return ok({
    dayOfWeek,
    localStartTime: input.localStartTime,
    localEndTime: input.localEndTime,
    ianaTimeZone: input.ianaTimeZone,
  });
}

export interface BlockedPeriodInput {
  readonly startDate: string;
  readonly startTime: string;
  readonly endDate: string;
  readonly endTime: string;
  readonly ianaTimeZone: string;
  readonly effectCode: string;
}

export interface ValidatedBlockedPeriod {
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly effectCode: 'adds' | 'removes';
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validateBlockedPeriod(
  input: BlockedPeriodInput,
  now: Date = new Date(),
): CommandResult<ValidatedBlockedPeriod> {
  const issues: Record<string, string> = {};

  if (!DATE_PATTERN.test(input.startDate)) issues['startDate'] = 'Choose a start date.';
  if (!DATE_PATTERN.test(input.endDate)) issues['endDate'] = 'Choose an end date.';
  if (minutesOfDay(input.startTime) === null) issues['startTime'] = 'Enter a start time.';
  if (minutesOfDay(input.endTime) === null) issues['endTime'] = 'Enter an end time.';

  const effectCode = input.effectCode === 'adds' ? 'adds' : 'removes';

  if (!isValidTimeZone(input.ianaTimeZone)) {
    issues['ianaTimeZone'] = 'That time zone is not one we recognise.';
  }

  if (Object.keys(issues).length > 0) {
    return fail(domainError('VALIDATION_FAILED', 'Please check the highlighted fields.', issues));
  }

  const startsAt = zonedTimeToUtc(input.startDate, input.startTime, input.ianaTimeZone);
  const endsAt = zonedTimeToUtc(input.endDate, input.endTime, input.ianaTimeZone);

  if (endsAt <= startsAt) {
    return fail(
      domainError('VALIDATION_FAILED', 'Please check the highlighted fields.', {
        endTime: 'The end needs to be after the start.',
      }),
    );
  }

  // Blocking the past cannot change anything that already happened, and
  // silently accepting it would leave a tutor believing they had.
  if (endsAt <= now) {
    return fail(
      domainError('VALIDATION_FAILED', 'Please check the highlighted fields.', {
        endDate: 'That period has already passed.',
      }),
    );
  }

  return ok({ startsAt, endsAt, effectCode });
}

function isValidTimeZone(zone: string): boolean {
  if (zone.length === 0) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
