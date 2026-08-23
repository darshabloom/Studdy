import { clockLabel, type CalendarBlock } from '@studdy/design-system';
import { shiftDate, weekDays, type WeekDay } from '../availability/calendar-time';
import { AVAILABILITY_WINDOW_DAYS } from '../time';

/**
 * The shape of a family-facing availability calendar, for discovery and for a
 * tutor profile.
 *
 * ONE MODULE SO THE CARD AND THE PROFILE AGREE. A parent glances at a card,
 * opens the profile and expects the same week under the same hours. Two pages
 * each deciding their own days would drift the moment either changed, and the
 * drift would look like the tutor's availability changing.
 *
 * Pure: it decides which days are on screen and how they are labelled. Fetching
 * slots is the page's job, and turning slots into blocks is
 * `bookableSlotBlocks`, which is the one place the privacy boundary sits.
 */

/** Seven days on screen at a time — a week is the unit a family thinks in. */
export const AVAILABILITY_PAGE_DAYS = 7;

/**
 * How many pages the published horizon covers.
 *
 * Derived from the horizon rather than chosen, so extending how far ahead
 * availability is published extends the navigation with it instead of silently
 * hiding the extra days behind a control that stops early.
 */
export const AVAILABILITY_PAGE_COUNT = Math.max(
  1,
  Math.ceil(AVAILABILITY_WINDOW_DAYS / AVAILABILITY_PAGE_DAYS),
);

export interface AvailabilityView {
  /** 1-based, clamped into the horizon. */
  readonly page: number;
  readonly days: readonly WeekDay[];
  /** The instants to derive slots between. Never earlier than `now`. */
  readonly from: Date;
  readonly to: Date;
  /** 'Tue 26 Aug – Mon 1 Sep' */
  readonly rangeLabel: string;
  /** Full column headings, for the large calendar. */
  readonly dayLabels: readonly string[];
  /** Short column headings, for a card-sized calendar. */
  readonly compactDayLabels: readonly string[];
  /** Which column is today, or -1. Marks the column rather than relabelling it. */
  readonly todayIndex: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
}

/**
 * Seven days from today, not from Monday.
 *
 * The tutor's own calendar is Monday-anchored because a tutor is arranging a
 * repeating week. A family is asking "when could we start?", and a Monday
 * anchor answers that badly: opened on a Saturday it spends five of its seven
 * columns on days that have already gone. Availability is only derived from
 * now onwards, so those columns would come back empty — and an empty column on
 * a family calendar reads as time the tutor is not free, which is a lie the
 * whole surface is built to avoid.
 */
export function availabilityView(
  page: number,
  now: Date,
  timeZone: string,
  windowDays: number = AVAILABILITY_WINDOW_DAYS,
): AvailabilityView {
  const pageCount = Math.max(1, Math.ceil(windowDays / AVAILABILITY_PAGE_DAYS));
  const safePage = Number.isFinite(page) ? Math.min(Math.max(Math.trunc(page), 1), pageCount) : 1;

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const anchor = shiftDate(today, (safePage - 1) * AVAILABILITY_PAGE_DAYS);
  const days = weekDays(anchor, timeZone);

  const first = days[0];
  const last = days[days.length - 1];
  // `weekDays` always returns seven; the guard keeps the types honest without
  // inventing a fallback week that would quietly render the wrong dates.
  if (first === undefined || last === undefined) {
    throw new Error('availabilityView: could not build a seven-day window');
  }

  return {
    page: safePage,
    days,
    // Nothing before now is bookable, so deriving from the start of today would
    // ask the database for slots that cannot be offered.
    from: first.startAt > now ? first.startAt : now,
    to: last.endAt,
    rangeLabel: `${first.label} – ${last.label}`,
    dayLabels: days.map((day) => day.label),
    compactDayLabels: days.map((day) => compactDayLabel(day, timeZone)),
    todayIndex: days.findIndex((day) => day.startAt <= now && now < day.endAt),
    hasPrevious: safePage > 1,
    hasNext: safePage < pageCount,
  };
}

/**
 * 'Mon' — a column heading that survives a card-width column.
 *
 * Weekday alone, with no date. A card divides its width by seven, which leaves
 * roughly thirty pixels a column: 'Mon 24' truncates to 'Mon…' and the date is
 * lost anyway, while the heading beside the calendar already names the range.
 */
function compactDayLabel(day: WeekDay, timeZone: string): string {
  return new Intl.DateTimeFormat('en-NZ', { timeZone, weekday: 'short' }).format(day.startAt);
}

/**
 * The same availability as a sentence, for a screen reader.
 *
 * A calendar is absolutely positioned coloured boxes; read aloud it is nothing
 * at all. This is generated from the BLOCKS rather than from the slots so the
 * text cannot drift from the picture — if a block is clipped out of the visible
 * hours, it is absent from both.
 *
 * It still says only what the calendar says: days that have bookable time, and
 * when. A day with none is simply not mentioned, never announced as unavailable.
 */
export function availabilitySummary(
  days: readonly WeekDay[],
  blocks: readonly CalendarBlock[],
): readonly string[] {
  const lines: string[] = [];
  for (const [dayIndex, day] of days.entries()) {
    const times = blocks
      .filter((block) => block.dayIndex === dayIndex)
      .slice()
      .sort((a, b) => a.startMinutes - b.startMinutes)
      .map((block) => `${clockLabel(block.startMinutes)} to ${clockLabel(block.endMinutes)}`);
    if (times.length > 0) lines.push(`${day.label}: ${times.join(', ')}`);
  }
  return lines;
}

/**
 * What to say where a calendar would be, when this visitor gets no derived
 * availability.
 *
 * A separate shape because the reason matters and there are three of them: not
 * signed in, signed in but not acting on a subject, and signed in with no
 * subjects yet. None of them is "this tutor is busy", and none of them may be
 * rendered as an empty week.
 */
export interface AvailabilityPrompt {
  /** Follows the link, e.g. "to see available times." */
  readonly message: string;
  readonly linkLabel: string;
  readonly href: string;
}
