import { zonedClockTime, zonedDateOnly, zonedTimeToUtc } from '@studdy/domain/availability';

/**
 * Wall-clock arithmetic for the availability calendar.
 *
 * Deliberately free of any dependency on the design system, because the server
 * actions need this arithmetic too and a `'use server'` module has no business
 * pulling React components into its graph. The block-shaped projection that
 * does depend on the calendar lives next door in `calendar-projection.ts`.
 *
 * Everything here works in ONE zone, passed in by the caller. The platform
 * schedules on a single clock, so the conversion between an instant and a
 * (day, minutes) pair happens here and nowhere else.
 */

/** Kept in step with the design system's own constant, which a test asserts. */
export const MINUTES_IN_DAY = 24 * 60;

/** The database stores 0 = Sunday, matching `extract(dow ...)`; the calendar puts Monday first. */
export function calendarDayIndex(dayOfWeek: number): number {
  return (dayOfWeek + 6) % 7;
}

/** The inverse, for turning a calendar column back into a stored rule. */
export function storedDayOfWeek(dayIndex: number): number {
  return (dayIndex + 1) % 7;
}

export interface WeekDay {
  /** 'YYYY-MM-DD' in the platform zone — a stable key, not for display. */
  readonly date: string;
  /** Local midnight, as an instant. */
  readonly startAt: Date;
  /** The next local midnight. Not simply +24h: a DST day is 23 or 25 hours long. */
  readonly endAt: Date;
  /** 'Mon 1 Sep' */
  readonly label: string;
}

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** 'YYYY-MM-DD' shifted by whole days, anchored at UTC noon so a DST hop cannot roll the date. */
export function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const noon = Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12);
  return new Date(noon + days * 86_400_000).toISOString().slice(0, 10);
}

/** The Monday on or before `instant`, as a plain date in the display zone. */
export function mondayOf(instant: Date, timeZone: string): string {
  const date = zonedDateOnly(instant, timeZone);
  const weekday = new Intl.DateTimeFormat('en-NZ', { timeZone, weekday: 'short' }).format(instant);
  const dayOfWeek = WEEKDAY_TO_INDEX[weekday] ?? 1;
  return shiftDate(date, -calendarDayIndex(dayOfWeek));
}

/** The seven days of the week beginning at `mondayDate`. */
export function weekDays(mondayDate: string, timeZone: string): readonly WeekDay[] {
  const days: WeekDay[] = [];
  for (let index = 0; index < 7; index += 1) {
    const date = shiftDate(mondayDate, index);
    days.push({
      date,
      startAt: zonedTimeToUtc(date, '00:00', timeZone),
      endAt: zonedTimeToUtc(shiftDate(date, 1), '00:00', timeZone),
      label: dayColumnLabel(date, timeZone),
    });
  }
  return days;
}

function dayColumnLabel(date: string, timeZone: string): string {
  const instant = zonedTimeToUtc(date, '12:00', timeZone);
  return new Intl.DateTimeFormat('en-NZ', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(instant)
    .replace(',', '');
}

/** 'HH:mm' or 'HH:mm:ss' to minutes past midnight. */
export function clockToMinutes(value: string): number {
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
}

/** Minutes past midnight to 'HH:mm', for storage. */
export function minutesToClock(minutes: number): string {
  const clamped = Math.min(Math.max(minutes, 0), MINUTES_IN_DAY);
  const hours = Math.floor(clamped / 60);
  const rest = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

/**
 * A (date, minutes) pair as a storable date and time, rolling midnight over.
 *
 * A block dragged to the very bottom of a column ends at minute 1440, which is
 * not a time of day at all — it is midnight the following morning. Storing it
 * as '24:00' would fail validation with a message about entering a time, which
 * tells the tutor nothing about what they actually did.
 */
export function splitDateTime(date: string, minutes: number): { date: string; time: string } {
  if (minutes >= MINUTES_IN_DAY) return { date: shiftDate(date, 1), time: '00:00' };
  return { date, time: minutesToClock(minutes) };
}

/**
 * Where an instant interval sits within one local day, in wall-clock minutes.
 *
 * Null when the interval misses the day entirely. The minutes are read off the
 * CLOCK rather than counted as elapsed time from midnight: on the two days a
 * year the clocks move, an hour elapsed is not an hour on the wall, and a block
 * positioned from elapsed minutes would sit an hour out for the rest of the day.
 */
export function minutesWithinDay(
  interval: { readonly startAt: Date; readonly endAt: Date },
  day: WeekDay,
  timeZone: string,
): { startMinutes: number; endMinutes: number } | null {
  const start = interval.startAt > day.startAt ? interval.startAt : day.startAt;
  const end = interval.endAt < day.endAt ? interval.endAt : day.endAt;
  if (end <= start) return null;

  const startMinutes =
    start.getTime() === day.startAt.getTime() ? 0 : clockToMinutes(zonedClockTime(start, timeZone));
  const endMinutes =
    end.getTime() === day.endAt.getTime()
      ? MINUTES_IN_DAY
      : clockToMinutes(zonedClockTime(end, timeZone));
  if (endMinutes <= startMinutes) return null;
  return { startMinutes, endMinutes };
}
