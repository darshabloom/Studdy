import {
  MINUTES_IN_DAY,
  clockLabel,
  fittedWindow,
  type CalendarBlock,
  type CalendarWindow,
} from '@studdy/design-system';
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
 * that a time is blocked, and that time has gone. `bookableSlotBlocks` renders
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
 * Derived positive slots as calendar blocks, and nothing else.
 *
 * THE ONE PROJECTION EVERY FAMILY-FACING CALENDAR GOES THROUGH — the tutor's
 * "Preview as family", the discovery card, the tutor profile, and whatever the
 * booking journey grows into. Every block is `available` by construction, so
 * `assertFamilySafe` passes not because the assertion has been carefully
 * satisfied but because the input genuinely holds no rule, block, reason or
 * reservation to leak in the first place.
 *
 * Keeping it to one function is the point. A second projection written for a
 * new screen is where a private role eventually slips through; here there is
 * nowhere for one to enter, because `BookableSlot` is two instants.
 */
export function bookableSlotBlocks(
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
/**
 * The hours a FAMILY-facing calendar shows before anything widens it: 8am–9pm.
 *
 * Narrower at the top than the tutor's editor, which runs to 10pm, because the
 * two windows answer different questions. The editor must offer somewhere new
 * to draw, so it shows hours nobody has claimed yet. A family is reading, not
 * drawing, and every empty hour on screen costs the legibility of the hours
 * that are not empty.
 *
 * It is still deliberately WIDER than the data. Fitting a family calendar to
 * one tutor's slots would make the same vertical position mean 4pm on one card
 * and 7pm on the next, so two tutors could not be compared by looking — which
 * is the whole reason a card carries a calendar rather than a list.
 */
export const FAMILY_CALENDAR_WINDOW: CalendarWindow = {
  dayStartMinutes: 8 * 60,
  dayEndMinutes: 21 * 60,
};

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

/**
 * The family window, widened to include every slot being shown.
 *
 * Only ever widens, like `teachingWindow`. A tutor who teaches at 7am must not
 * have that hour silently dropped for falling outside the default — an omitted
 * slot reads as time the tutor is not free, which is exactly the inference a
 * family-facing calendar must never invite.
 *
 * PASS EVERY CALENDAR ON THE PAGE AT ONCE. Discovery computes this across all
 * the cards it is about to render so they share one vertical scale; computing
 * it per card would give each tutor a private one.
 */
export function familyCalendarWindow(blocks: readonly CalendarBlock[]): CalendarWindow {
  return teachingWindow(blocks, FAMILY_CALENDAR_WINDOW);
}

/** Padding kept either side of a tutor's own hours on their profile. */
const PROFILE_CONTEXT_MINUTES = 90;

/**
 * The least a profile calendar ever shows, however little a tutor offers.
 *
 * A tutor with one Tuesday hour would otherwise get a calendar three hours
 * tall, which reads as a fragment rather than as a day and gives a parent
 * nowhere to place "after school" against. Six hours is enough day either side
 * of a single lesson for the position to mean something.
 */
const PROFILE_MINIMUM_SPAN_MINUTES = 6 * 60;

/**
 * The hours ONE tutor's profile shows: fitted to their own availability.
 *
 * DELIBERATELY UNLIKE the discovery window and unlike the tutor's editor, and
 * for the same reason in both directions. The editor shows a broad fixed day
 * because a tutor is CREATING availability and needs somewhere new to draw. A
 * discovery card shares one window across the page because its whole job is
 * comparison. A profile is neither: it shows one tutor, already chosen, and a
 * parent is reading rather than comparing or drawing — so eight empty morning
 * hours cost the legibility of the hours that are not empty and buy nothing.
 *
 * Fitted, but never tightly. Ninety minutes of context sits either side and the
 * result is stretched to at least six hours, so a band still reads as sitting
 * at a time of day rather than filling the frame.
 */
export function profileCalendarWindow(blocks: readonly CalendarBlock[]): CalendarWindow {
  if (blocks.length === 0) return FAMILY_CALENDAR_WINDOW;

  const fitted = fittedWindow(blocks, FAMILY_CALENDAR_WINDOW, PROFILE_CONTEXT_MINUTES);
  const span = fitted.dayEndMinutes - fitted.dayStartMinutes;
  if (span >= PROFILE_MINIMUM_SPAN_MINUTES) return fitted;

  // Grow both ways, then push back off whichever end of the day it runs into,
  // so a very early or very late tutor still gets the full minimum rather than
  // a window silently clipped short at midnight.
  const wanted = PROFILE_MINIMUM_SPAN_MINUTES - span;
  let start = fitted.dayStartMinutes - Math.floor(wanted / 2);
  let end = fitted.dayEndMinutes + Math.ceil(wanted / 2);
  if (start < 0) {
    end -= start;
    start = 0;
  }
  if (end > MINUTES_IN_DAY) {
    start = Math.max(0, start - (end - MINUTES_IN_DAY));
    end = MINUTES_IN_DAY;
  }
  return { dayStartMinutes: start, dayEndMinutes: end };
}

/**
 * Merge blocks that touch or overlap, per day.
 *
 * Derived slots are START TIMES, so a tutor free from 4pm to 7pm at half-hour
 * granularity produces five overlapping hour-long slots. Drawn as five blocks
 * they stack into a striped smear that reads as structure where there is none —
 * a parent sees stripes and wonders what the lines mean.
 *
 * Merged, the same data says the true and useful thing: bookable time runs from
 * 4pm to 7pm. FOR READ-ONLY VIEWS ONLY. The moment a family picks a specific
 * time — step 4 — the individual slots come back, because then the difference
 * between 4:00 and 4:30 is exactly what is being chosen.
 *
 * Merging cannot leak: it only ever joins positive time to positive time, and
 * a merged block is still `available` and still says nothing about any gap.
 */
export function mergeContiguousBlocks(blocks: readonly CalendarBlock[]): readonly CalendarBlock[] {
  const ordered = [...blocks].sort(
    (a, b) => a.dayIndex - b.dayIndex || a.startMinutes - b.startMinutes,
  );
  const merged: CalendarBlock[] = [];
  for (const block of ordered) {
    const last = merged[merged.length - 1];
    if (
      last !== undefined &&
      last.dayIndex === block.dayIndex &&
      last.role === block.role &&
      block.startMinutes <= last.endMinutes
    ) {
      merged[merged.length - 1] = {
        ...last,
        endMinutes: Math.max(last.endMinutes, block.endMinutes),
      };
      continue;
    }
    // The id names the run rather than one slot inside it, so nothing
    // downstream can mistake a merged band for a bookable start time.
    merged.push({
      id: `run:${String(block.dayIndex)}:${String(block.startMinutes)}`,
      dayIndex: block.dayIndex,
      startMinutes: block.startMinutes,
      endMinutes: block.endMinutes,
      role: block.role,
    });
  }
  // Labelled last, once each run knows how far it actually runs. The label says
  // the extent of the band and nothing more — it is the picture in words, not a
  // second, subtly different claim about availability.
  return merged.map((block) => ({
    ...block,
    label: `${clockLabel(block.startMinutes)} – ${clockLabel(block.endMinutes)}`,
  }));
}
