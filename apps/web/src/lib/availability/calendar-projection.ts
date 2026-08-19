import type { CalendarBlock, CalendarWindow } from '@studdy/design-system';
import type {
  AvailabilityExceptionRecord,
  AvailabilityRuleRecord,
  BookableSlot,
  TutorReservationRecord,
} from '@studdy/database';
import { calendarDayIndex, clockToMinutes, minutesWithinDay, type WeekDay } from './calendar-time';

/**
 * Projecting stored availability onto the week calendar.
 *
 * The calendar speaks WALL-CLOCK coordinates — a Monday-first day index and
 * minutes past local midnight — and knows nothing about dates or zones. The
 * arithmetic that crosses between the two lives in `calendar-time.ts`; this
 * module turns the results into blocks.
 *
 * TWO SHAPES, AND THE DIFFERENCE IS THE PRIVACY BOUNDARY. `tutorWeekBlocks`
 * shows the tutor their own raw rules, blocked periods, holds and lessons —
 * that a time is blocked, and that time has gone. `familyPreviewBlocks` renders
 * derived bookable slots and nothing else. They are separate functions over
 * separate inputs because the tutor's "preview as family" must go through the
 * second: a preview built from the first would show a picture no family ever
 * receives, and would betray the shape of every gap.
 *
 * Neither carries the private REASON or note. Those are rendered from their own
 * list on the tutor's page, so the calendar's props hold no private text at all.
 */

/**
 * What a calendar block came from, so an edit can find its row again.
 *
 * A block id carries the day as well as the row id, because one stored row can
 * appear as several blocks — a week-long holiday is seven of them. Only a
 * segment that is the whole of its row is `editable`: dragging one day of a
 * holiday would otherwise silently truncate the other six.
 */
export type SegmentKind = 'rule' | 'exception' | 'hold' | 'lesson';

/**
 * Deliberately carries no private note and no reason.
 *
 * A segment exists so an edit gesture can find its row again, and that needs an
 * id and a date. The note is rendered from its own list; putting it here as
 * well would serialise the tutor's private text into the calendar's client
 * props a second time, for nothing. What crosses to the browser should be what
 * the browser actually uses.
 */
export interface CalendarSegment {
  readonly blockId: string;
  readonly kind: SegmentKind;
  readonly rowId: string;
  /** The local date this segment falls on. */
  readonly date: string;
  readonly editable: boolean;
  /** online | in_person | any. Not private; it is what the tutor offers. */
  readonly formatCode: string;
  /** Wall-clock minutes, so the editor can open already filled in. */
  readonly startMinutes: number;
  readonly endMinutes: number;
}

export interface TutorWeek {
  readonly blocks: readonly CalendarBlock[];
  readonly segments: readonly CalendarSegment[];
}

export interface TutorWeekInput {
  readonly rules: readonly AvailabilityRuleRecord[];
  readonly exceptions: readonly AvailabilityExceptionRecord[];
  readonly reservations: readonly TutorReservationRecord[];
  readonly days: readonly WeekDay[];
  readonly timeZone: string;
}

/**
 * The tutor's own week: recurring hours, one-off changes, holds and lessons.
 *
 * NEVER hand the result to a family-facing calendar. It deliberately carries
 * `blocked`, `hold` and `lesson` roles, which `assertFamilySafe` refuses.
 */
export function tutorWeekBlocks(input: TutorWeekInput): TutorWeek {
  const blocks: CalendarBlock[] = [];
  const segments: CalendarSegment[] = [];

  for (const rule of input.rules) {
    const dayIndex = calendarDayIndex(rule.dayOfWeek);
    const day = input.days[dayIndex];
    if (day === undefined) continue;
    // A rule that has not started yet, or has already ended, is not this week's
    // availability even though its row is still active.
    if (day.date < rule.effectiveFrom) continue;
    if (rule.effectiveUntil !== null && day.date > rule.effectiveUntil) continue;

    const blockId = `rule:${rule.id}:${day.date}`;
    blocks.push({
      id: blockId,
      dayIndex,
      startMinutes: clockToMinutes(rule.localStartTime),
      endMinutes: clockToMinutes(rule.localEndTime),
      role: 'available',
      label: `Weekly${formatSuffix(rule.lessonFormatCode)}`,
    });
    segments.push({
      blockId,
      kind: 'rule',
      rowId: rule.id,
      date: day.date,
      editable: true,
      formatCode: rule.lessonFormatCode,
      startMinutes: clockToMinutes(rule.localStartTime),
      endMinutes: clockToMinutes(rule.localEndTime),
    });
  }

  for (const exception of input.exceptions) {
    const touched = input.days.filter(
      (day) => exception.startsAt < day.endAt && day.startAt < exception.endsAt,
    );
    const only = touched[0];
    // Whole-row only when this week contains all of it, so an edit cannot
    // truncate a period continuing into a week the tutor is not looking at.
    const wholeRow =
      touched.length === 1 &&
      only !== undefined &&
      exception.startsAt >= only.startAt &&
      exception.endsAt <= only.endAt;

    // The exceptions table names its columns `starts_at`/`ends_at`; slots and
    // reservations use `start_at`/`end_at`. Normalised here rather than making
    // the shared helper accept both spellings.
    const interval = { startAt: exception.startsAt, endAt: exception.endsAt };

    for (const [dayIndex, day] of input.days.entries()) {
      const span = minutesWithinDay(interval, day, input.timeZone);
      if (span === null) continue;
      const blockId = `exception:${exception.id}:${day.date}`;
      const adds = exception.effectCode === 'adds';
      blocks.push({
        id: blockId,
        dayIndex,
        startMinutes: span.startMinutes,
        endMinutes: span.endMinutes,
        // A one-off addition gets its own role so the tutor can tell it from a
        // recurring rule while editing. Family projections never emit it.
        role: adds ? 'available_once' : 'blocked',
        label: adds ? `One-off${formatSuffix(exception.lessonFormatCode)}` : 'Blocked',
      });
      segments.push({
        blockId,
        kind: 'exception',
        rowId: exception.id,
        date: day.date,
        editable: wholeRow,
        formatCode: exception.lessonFormatCode,
        startMinutes: span.startMinutes,
        endMinutes: span.endMinutes,
      });
    }
  }

  for (const reservation of input.reservations) {
    const isLesson = reservation.reservationTypeCode === 'booking_confirmed';
    for (const [dayIndex, day] of input.days.entries()) {
      const span = minutesWithinDay(reservation, day, input.timeZone);
      if (span === null) continue;
      const blockId = `${isLesson ? 'lesson' : 'hold'}:${reservation.id}:${day.date}`;
      blocks.push({
        id: blockId,
        dayIndex,
        startMinutes: span.startMinutes,
        endMinutes: span.endMinutes,
        role: isLesson ? 'lesson' : 'hold',
        // A hold says when it lapses. Left open-ended it reads like a booking,
        // and the tutor has no way to tell how long their time is spoken for.
        label: isLesson ? 'Confirmed lesson' : holdLabel(reservation.expiresAt, input.timeZone),
      });
      segments.push({
        blockId,
        kind: isLesson ? 'lesson' : 'hold',
        rowId: reservation.id,
        date: day.date,
        // Neither is availability, so neither is the tutor's to drag away here.
        editable: false,
        formatCode: 'any',
        startMinutes: span.startMinutes,
        endMinutes: span.endMinutes,
      });
    }
  }

  return { blocks, segments };
}

/**
 * ' · Online' / ' · In person', or nothing at all when the time suits either.
 *
 * Most availability is unscoped, so naming the common case would put a word on
 * every block and stop the exceptions standing out.
 */
function formatSuffix(formatCode: string): string {
  if (formatCode === 'online') return ' · Online';
  if (formatCode === 'in_person') return ' · In person';
  return '';
}

/** 'Held until Thu 20 Aug, 16:00', or plain if the hold carries no expiry. */
function holdLabel(expiresAt: Date | null, timeZone: string): string {
  if (expiresAt === null) return 'Held, temporarily';
  const when = new Intl.DateTimeFormat('en-NZ', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(expiresAt);
  return `Held until ${when}`;
}

/**
 * The family's view of the same week: derived positive slots and nothing else.
 *
 * This is what "Preview as family" renders. Every block is `available` by
 * construction, so `assertFamilySafe` passes — not because the assertion has
 * been carefully satisfied, but because the input genuinely holds no rule,
 * block, reason or reservation to leak in the first place.
 */
export function familyPreviewBlocks(
  slots: readonly BookableSlot[],
  days: readonly WeekDay[],
  timeZone: string,
  labelFor?: (slot: BookableSlot) => string,
): readonly CalendarBlock[] {
  const blocks: CalendarBlock[] = [];
  for (const [dayIndex, day] of days.entries()) {
    for (const slot of slots) {
      const span = minutesWithinDay(slot, day, timeZone);
      if (span === null) continue;
      blocks.push({
        id: `slot:${slot.startAt.toISOString()}`,
        dayIndex,
        startMinutes: span.startMinutes,
        endMinutes: span.endMinutes,
        role: 'available',
        ...(labelFor === undefined ? {} : { label: labelFor(slot) }),
      });
    }
  }
  return blocks;
}

/**
 * The hours the editable calendar always shows: 8am to 10pm.
 *
 * FITTING TO EXISTING AVAILABILITY IS WRONG FOR AN EDITOR. A window drawn
 * around what a tutor already offers cannot show them anywhere new to offer —
 * an evenings-only tutor would never see a Saturday morning to drag on, so the
 * calendar would quietly enforce the shape it found. Tutoring runs into the
 * evening on school days and across the daytime at weekends and in the
 * holidays, so both ends are present from the start.
 *
 * Configurable per-tutor bounds can come later; this is deliberately one
 * constant rather than a setting nobody has asked for yet.
 */
export const DEFAULT_CALENDAR_WINDOW: CalendarWindow = {
  dayStartMinutes: 8 * 60,
  dayEndMinutes: 22 * 60,
};

/**
 * The teaching window, widened to include anything already on the calendar.
 *
 * Only ever widens. A tutor with a 7am Saturday slot or a 10.30pm evening class
 * must still see it, so existing availability pushes the edges out rather than
 * being hidden for falling outside the default.
 */
export function teachingWindow(
  blocks: readonly CalendarBlock[],
  base: CalendarWindow = DEFAULT_CALENDAR_WINDOW,
): CalendarWindow {
  let start = base.dayStartMinutes;
  let end = base.dayEndMinutes;
  for (const block of blocks) {
    start = Math.min(start, Math.floor(block.startMinutes / 60) * 60);
    end = Math.max(end, Math.ceil(block.endMinutes / 60) * 60);
  }
  return { dayStartMinutes: Math.max(start, 0), dayEndMinutes: Math.min(end, 24 * 60) };
}
