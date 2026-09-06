import type { CalendarBlock, CalendarWindow } from '@studdy/design-system';
import { availabilityView, type AvailabilityView } from '@/lib/discovery/availability-view';
import type { WeekDay } from '@/lib/availability/calendar-time';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

/**
 * THE DEMO'S CLOCK.
 *
 * A portfolio demo has two requirements that pull against each other. It must
 * be DETERMINISTIC — the same clicks always reach the same screens, so it can
 * be rehearsed, screen-recorded and screenshotted — and it must be BELIEVABLE,
 * which a lesson dated eight months ago is not.
 *
 * The resolution: dates are a pure function of today. The week on screen is
 * always the seven days from now, and the demo lesson is always the same
 * weekday-and-hour inside it. Nothing branches on state, nothing is stored, and
 * a reviewer opening the link in March sees March. Only the date LABELS move;
 * the journey is identical every time.
 *
 * Nothing here reads a database, a clock service or an environment variable.
 */

/** Weekday keys, as `WeekDay.label` renders them ('Tue 9 Sep'). */
export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

/** One recurring band of a demo tutor's teaching week. */
export interface DemoBand {
  readonly weekday: Weekday;
  /** Minutes past local midnight. */
  readonly startMinutes: number;
  readonly endMinutes: number;
}

export const HOUR = 60;

/** 'Tue' from 'Tue 9 Sep'. The label is built by `weekDays`, so this is stable. */
export function weekdayOf(day: WeekDay): Weekday {
  return day.label.slice(0, 3) as Weekday;
}

/** The seven days the whole demo shares, starting today. */
export function demoWeek(now: Date = new Date()): AvailabilityView {
  return availabilityView(1, now, PLATFORM_TIME_ZONE);
}

/**
 * A weekly pattern projected onto the seven days actually on screen.
 *
 * Indexed by COLUMN, matching how `bookableSlotBlocks` feeds the real
 * calendars: the demo week starts today rather than on a Monday, so a band's
 * weekday decides which column it lands in and some bands fall outside the
 * window entirely. That is the honest result — a tutor free on Tuesdays is not
 * free on the Tuesday that has already gone.
 */
export function bandBlocks(
  bands: readonly DemoBand[],
  days: readonly WeekDay[],
  now: Date = new Date(),
  role: CalendarBlock['role'] = 'available',
): readonly CalendarBlock[] {
  return days.flatMap((day, columnIndex) =>
    bands
      .filter((band) => band.weekday === weekdayOf(day))
      .flatMap((band) => {
        // Nothing in the past is bookable, and the production projection never
        // returns any — it derives slots from `now` onwards. A demo band drawn
        // over an afternoon that has already gone would claim time this tutor
        // does not have, which is the one thing these calendars must not do.
        const clamped = clampToFuture(day, band.startMinutes, band.endMinutes, now);
        if (clamped === null) return [];
        return [
          {
            id: `${day.date}-${String(clamped.startMinutes)}`,
            dayIndex: columnIndex,
            startMinutes: clamped.startMinutes,
            endMinutes: clamped.endMinutes,
            role,
          },
        ];
      }),
  );
}

/**
 * A band trimmed to the part still ahead, or null when all of it has gone.
 *
 * A band the day has run into starts at the next half hour rather than at
 * "now": the grid's step is thirty minutes, and a band beginning at 4:07 would
 * draw a block whose top edge lines up with nothing.
 */
function clampToFuture(
  day: WeekDay,
  startMinutes: number,
  endMinutes: number,
  now: Date,
): { startMinutes: number; endMinutes: number } | null {
  if (instantAt(day, endMinutes) <= now) return null;
  if (instantAt(day, startMinutes) >= now) return { startMinutes, endMinutes };

  const elapsed = Math.ceil((now.getTime() - day.startAt.getTime()) / 60_000);
  const next = Math.ceil(elapsed / 30) * 30;
  return next + 30 >= endMinutes ? null : { startMinutes: next, endMinutes };
}

/** One bookable start: the block the calendar draws, and the instant behind it. */
export interface BookableStart {
  readonly block: CalendarBlock;
  readonly at: Date;
  /** The picker's key for a start — its block id without the `slot:` prefix. */
  readonly iso: string;
  readonly day: WeekDay;
  readonly startMinutes: number;
}

/**
 * The same pattern as individual bookable STARTS, for the times step.
 *
 * The read-only calendars merge availability into bands, because a parent
 * comparing tutors is asking "does the week work". Choosing a time is the one
 * screen where 4:00 and 4:30 are different answers, so here each start is its
 * own block — exactly the distinction the production picker is built around.
 *
 * Block ids carry the `slot:` prefix the production `JourneyTimePicker`
 * expects: it strips that prefix to key its selection, and re-adds it to decide
 * which blocks are drawn as chosen. Getting this wrong does not error — the
 * calendar simply never highlights anything.
 */
export function bookableStarts(
  bands: readonly DemoBand[],
  days: readonly WeekDay[],
  durationMinutes: number,
  now: Date = new Date(),
  stepMinutes = 30,
): readonly BookableStart[] {
  return days.flatMap((day, columnIndex) =>
    bands
      .filter((band) => band.weekday === weekdayOf(day))
      .flatMap((band) => {
        const starts: BookableStart[] = [];
        for (
          let minutes = band.startMinutes;
          minutes + durationMinutes <= band.endMinutes;
          minutes += stepMinutes
        ) {
          const at = instantAt(day, minutes);
          // Same rule as the bands: a start that has already passed is not a
          // start anybody can choose.
          if (at <= now) continue;
          const iso = at.toISOString();
          starts.push({
            at,
            iso,
            day,
            startMinutes: minutes,
            block: {
              id: `slot:${iso}`,
              dayIndex: columnIndex,
              startMinutes: minutes,
              endMinutes: minutes + durationMinutes,
              role: 'available',
            },
          });
        }
        return starts;
      }),
  );
}

/** A stable identifier for one bookable start — its date and its clock. */
export function startId(day: WeekDay, minutes: number): string {
  return `${day.date}T${clock(minutes)}`;
}

/**
 * A start as a real instant.
 *
 * `startAt` is local midnight in the platform zone, so adding minutes lands on
 * the right wall clock. New Zealand shifts its clocks at 2am and 3am, outside
 * every hour this demo teaches in, so no band can straddle a transition.
 */
export function instantAt(day: WeekDay, minutes: number): Date {
  return new Date(day.startAt.getTime() + minutes * 60_000);
}

/** '16:00' */
export function clock(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * The first day at or after `minimumColumn` whose weekday matches, or the last
 * matching day in the window.
 *
 * The demo lesson is meant to sit a few days out — near enough to feel real,
 * far enough that "your tutor is holding this time" is plausible.
 */
export function findDay(
  days: readonly WeekDay[],
  weekday: Weekday,
  minimumColumn: number,
): WeekDay | null {
  const matches = days.filter((day) => weekdayOf(day) === weekday);
  return (
    matches.find((day) => days.indexOf(day) >= minimumColumn) ?? matches[matches.length - 1] ?? null
  );
}

/** The window every demo calendar shares, so the screens read against each other. */
export const DEMO_CALENDAR_WINDOW: CalendarWindow = {
  dayStartMinutes: 8 * HOUR,
  dayEndMinutes: 20 * HOUR,
};
