'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  archiveAvailabilityException,
  archiveAvailabilityRule,
  createAvailabilityException,
  createAvailabilityRule,
  tutorProfileForUser,
  updateAvailabilityException,
  updateAvailabilityRule,
} from '@studdy/database';
import { validateAvailabilityRule, validateBlockedPeriod } from '@studdy/domain/availability';
import { resolveIdentity } from '../identity/resolve';
import { PLATFORM_TIME_ZONE } from '../time';
import { MINUTES_IN_DAY, minutesToClock, splitDateTime, storedDayOfWeek } from './calendar-time';

/**
 * Tutor availability management.
 *
 * Every action resolves the tutor profile from the SESSION and passes that id
 * into the repository, which folds ownership into the WHERE clause. A posted
 * rule or exception id belonging to another tutor therefore matches zero rows
 * — it is never loaded and then refused, so there is no difference in behaviour
 * between "not yours" and "does not exist".
 */

async function requireTutor(): Promise<{ tutorProfileId: string; studdyUserId: string }> {
  const identity = await resolveIdentity();
  if (identity === null || identity.studdyUserId === null) {
    redirect('/sign-in?next=%2Ftutor%2Favailability');
  }
  const profile = await tutorProfileForUser(identity.studdyUserId);
  if (profile === null) redirect('/tutor');
  return { tutorProfileId: profile.id, studdyUserId: identity.studdyUserId };
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

// ---------------------------------------------------------------------------
// Calendar-driven editing
// ---------------------------------------------------------------------------

/**
 * What the calendar gets back from an edit.
 *
 * The calendar is a direct-manipulation surface: a tutor drags a block and
 * expects it to stay where they put it. When the server refuses, the screen has
 * to say why in the tutor's own words and put the block back, so a thrown error
 * is not enough — the message is part of the result.
 */
export interface CalendarActionResult {
  readonly ok: boolean;
  readonly error: string | null;
}

const OK: CalendarActionResult = { ok: true, error: null };

function refused(error: string): CalendarActionResult {
  return { ok: false, error };
}

/**
 * The first field-level message, which is the one worth showing.
 *
 * The domain validators return a per-field map plus a generic summary. On a
 * calendar there are no fields to highlight, so the summary ("please check the
 * highlighted fields") would leave the tutor with nothing to act on.
 */
function firstIssue(details: Record<string, string> | undefined, fallback: string): string {
  const first = Object.values(details ?? {})[0];
  return first ?? fallback;
}

/**
 * A rule reaching the end of the day is stored a minute short of midnight.
 *
 * Minute 1440 is not a time of day and the stored column is a `time`. A minute
 * is immaterial to a lesson, and it keeps a drag to the bottom of the column
 * from failing with a message about entering a valid time.
 */
function ruleEndClock(minutes: number): string {
  return minutes >= MINUTES_IN_DAY ? '23:59' : minutesToClock(minutes);
}

/** Draw a new weekly rule by dragging on an empty part of the grid. */
export async function createRuleFromCalendarAction(
  dayIndex: number,
  startMinutes: number,
  endMinutes: number,
): Promise<CalendarActionResult> {
  const { tutorProfileId, studdyUserId } = await requireTutor();

  const validated = validateAvailabilityRule({
    dayOfWeek: String(storedDayOfWeek(dayIndex)),
    localStartTime: minutesToClock(startMinutes),
    localEndTime: ruleEndClock(endMinutes),
    ianaTimeZone: PLATFORM_TIME_ZONE,
  });
  if (!validated.ok) {
    return refused(
      firstIssue(validated.error.details as Record<string, string>, validated.error.message),
    );
  }

  await createAvailabilityRule({
    tutorProfileId,
    createdByUserId: studdyUserId,
    dayOfWeek: validated.value.dayOfWeek,
    localStartTime: validated.value.localStartTime,
    localEndTime: validated.value.localEndTime,
    ianaTimeZone: validated.value.ianaTimeZone,
    // Adding hours means "from now on", not retroactively.
    effectiveFrom: new Date().toISOString().slice(0, 10),
  });

  revalidateAvailability();
  return OK;
}

/**
 * Move or resize an existing weekly rule, KEEPING ITS IDENTITY.
 *
 * Archiving and recreating would mint a new id on every drag, so a rule a tutor
 * has taught to for a year would look newly created each time they nudged it by
 * half an hour, and anything referring to the row would lose its referent.
 */
export async function updateRuleFromCalendarAction(
  ruleId: string,
  dayIndex: number,
  startMinutes: number,
  endMinutes: number,
): Promise<CalendarActionResult> {
  const { tutorProfileId, studdyUserId } = await requireTutor();

  const validated = validateAvailabilityRule({
    dayOfWeek: String(storedDayOfWeek(dayIndex)),
    localStartTime: minutesToClock(startMinutes),
    localEndTime: ruleEndClock(endMinutes),
    ianaTimeZone: PLATFORM_TIME_ZONE,
  });
  if (!validated.ok) {
    return refused(
      firstIssue(validated.error.details as Record<string, string>, validated.error.message),
    );
  }

  const updated = await updateAvailabilityRule(ruleId, tutorProfileId, studdyUserId, {
    dayOfWeek: validated.value.dayOfWeek,
    localStartTime: validated.value.localStartTime,
    localEndTime: validated.value.localEndTime,
  });
  if (!updated) return refused('Those hours are no longer there. Reload and try again.');

  revalidateAvailability();
  return OK;
}

export async function deleteRuleFromCalendarAction(ruleId: string): Promise<CalendarActionResult> {
  const { tutorProfileId, studdyUserId } = await requireTutor();
  const archived = await archiveAvailabilityRule(ruleId, tutorProfileId, studdyUserId);
  if (!archived) return refused('Those hours are no longer there. Reload and try again.');
  revalidateAvailability();
  return OK;
}

/**
 * A one-off change on a specific date: extra hours, or time blocked out.
 *
 * The private note is accepted and stored here, and no family-facing projection
 * selects it.
 */
export async function createExceptionFromCalendarAction(
  date: string,
  startMinutes: number,
  endMinutes: number,
  effectCode: 'adds' | 'removes',
  privateNote?: string | null,
): Promise<CalendarActionResult> {
  const { tutorProfileId, studdyUserId } = await requireTutor();
  const start = splitDateTime(date, startMinutes);
  const end = splitDateTime(date, endMinutes);

  const validated = validateBlockedPeriod({
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    ianaTimeZone: PLATFORM_TIME_ZONE,
    effectCode,
  });
  if (!validated.ok) {
    return refused(
      firstIssue(validated.error.details as Record<string, string>, validated.error.message),
    );
  }

  await createAvailabilityException({
    tutorProfileId,
    createdByUserId: studdyUserId,
    startsAt: validated.value.startsAt,
    endsAt: validated.value.endsAt,
    effectCode: validated.value.effectCode,
    privateNote: emptyToNull(privateNote ?? ''),
  });

  revalidateAvailability();
  return OK;
}

/**
 * Move or resize a one-off change in place.
 *
 * The reason and private note are left alone. Dragging a blocked period to a
 * different hour is not a statement that the tutor no longer has a reason for
 * it, and quietly discarding one would lose something they wrote for themselves.
 */
export async function updateExceptionFromCalendarAction(
  exceptionId: string,
  date: string,
  startMinutes: number,
  endMinutes: number,
): Promise<CalendarActionResult> {
  const { tutorProfileId, studdyUserId } = await requireTutor();
  const start = splitDateTime(date, startMinutes);
  const end = splitDateTime(date, endMinutes);

  const validated = validateBlockedPeriod({
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    ianaTimeZone: PLATFORM_TIME_ZONE,
    // Only the times are changing; the stored row keeps the effect it has.
    effectCode: 'removes',
  });
  if (!validated.ok) {
    return refused(
      firstIssue(validated.error.details as Record<string, string>, validated.error.message),
    );
  }

  const updated = await updateAvailabilityException(exceptionId, tutorProfileId, studdyUserId, {
    startsAt: validated.value.startsAt,
    endsAt: validated.value.endsAt,
  });
  if (!updated) return refused('That one-off change is no longer there. Reload and try again.');

  revalidateAvailability();
  return OK;
}

export async function deleteExceptionFromCalendarAction(
  exceptionId: string,
): Promise<CalendarActionResult> {
  const { tutorProfileId, studdyUserId } = await requireTutor();
  const archived = await archiveAvailabilityException(exceptionId, tutorProfileId, studdyUserId);
  if (!archived) return refused('That one-off change is no longer there. Reload and try again.');
  revalidateAvailability();
  return OK;
}

function revalidateAvailability(): void {
  revalidatePath('/tutor/availability');
  revalidatePath('/tutor');
}
