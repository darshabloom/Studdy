/**
 * Bookable-slot derivation (Database spec §8.5).
 *
 * The approved layered formula is:
 *
 *   base recurring availability
 * + one-off additions
 * - blocked time
 * - confirmed bookings
 * - active holds
 * - travel buffers          (not in this checkpoint — see NOT YET SUBTRACTED)
 * - holidays and breaks
 * - capacity restrictions   (not in this checkpoint — see NOT YET SUBTRACTED)
 * - minimum notice
 * - service eligibility
 * = bookable availability
 *
 * This module is pure: no database, no clock of its own, no Next.js. `now` is
 * always passed in, so every case is testable without freezing time globally.
 *
 * NOT YET SUBTRACTED, and declared rather than left to be discovered:
 * travel buffers (§8.8) and capacity rules (§8.9). Both are modelled in doc 07
 * but out of scope for this checkpoint. A tutor may therefore be offered more
 * requests than a capacity rule would allow, and back-to-back in-person lessons
 * are not spaced. Both must land before in-person booking is real.
 */

/** A half-open interval [startAt, endAt). Instants, always UTC-based. */
export interface Interval {
  readonly startAt: Date;
  readonly endAt: Date;
}

export interface RecurringRule {
  /** 0 = Sunday … 6 = Saturday, matching PostgreSQL `extract(dow …)`. */
  readonly dayOfWeek: number;
  /** Local wall-clock 'HH:MM' or 'HH:MM:SS' in `ianaTimeZone`. */
  readonly localStartTime: string;
  readonly localEndTime: string;
  readonly ianaTimeZone: string;
  /** 'YYYY-MM-DD' inclusive. */
  readonly effectiveFrom: string;
  /** 'YYYY-MM-DD' inclusive, or null for open-ended. */
  readonly effectiveUntil: string | null;
  readonly minimumNoticeMinutes: number | null;
  readonly maximumAdvanceBookingDays: number | null;
}

export interface AvailabilityException extends Interval {
  readonly effectCode: 'adds' | 'removes';
}

export interface BookableSlotsInput {
  readonly rules: readonly RecurringRule[];
  readonly exceptions: readonly AvailabilityException[];
  /** Active reservations: confirmed bookings AND request holds alike. */
  readonly reservations: readonly Interval[];
  /** The window the caller wants slots for. */
  readonly window: Interval;
  readonly durationMinutes: number;
  /** Applied when a rule does not carry its own. */
  readonly defaultMinimumNoticeMinutes: number;
  readonly defaultMaximumAdvanceBookingDays: number;
  readonly now: Date;
  /**
   * Slot start granularity in minutes. 30 means slots begin on the hour and
   * half-hour, which is how people actually think about lesson times — an
   * arbitrary 09:07 start would be technically bookable and practically absurd.
   */
  readonly stepMinutes?: number;
}

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
/** A recurring rule cannot be projected further than this in one query. */
const MAX_WINDOW_DAYS = 62;

/**
 * The UTC instant of a local wall-clock time in an IANA zone.
 *
 * Node has no zone-aware Date, and the repository carries no date library, so
 * this inverts `Intl.DateTimeFormat` instead: guess an instant, ask what local
 * time it lands on, and correct by the error. Two passes settle it, including
 * across a daylight-saving transition where the first correction can overshoot.
 *
 * Times that do not exist (the spring-forward gap) resolve to the instant the
 * clock jumps to. Times that occur twice (autumn) resolve to the first.
 */
export function zonedTimeToUtc(localDate: string, localTime: string, ianaTimeZone: string): Date {
  const [year, month, day] = localDate.split('-').map(Number);
  const [hour, minute, second = 0] = localTime.split(':').map(Number);
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined
  ) {
    throw new Error(`Invalid local date/time: ${localDate} ${localTime}`);
  }

  const wanted = Date.UTC(year, month - 1, day, hour, minute, second);
  let instant = wanted;
  for (let pass = 0; pass < 2; pass += 1) {
    const offset = zoneOffsetMs(new Date(instant), ianaTimeZone);
    const corrected = wanted - offset;
    if (corrected === instant) break;
    instant = corrected;
  }
  return new Date(instant);
}

/** How far ahead of UTC the zone is, at this instant, in milliseconds. */
function zoneOffsetMs(instant: Date, ianaTimeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTimeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const field = (type: string): number => {
    const found = parts.find((part) => part.type === type);
    return found === undefined ? 0 : Number(found.value);
  };

  // `hour: '2-digit'` with hour12:false yields 24 for midnight in some ICU
  // versions; Date.UTC handles 24 as the next day, which is what we want.
  const asUtc = Date.UTC(
    field('year'),
    field('month') - 1,
    field('day'),
    field('hour'),
    field('minute'),
    field('second'),
  );
  return asUtc - instant.getTime();
}

/** The 'YYYY-MM-DD' local date, and weekday, of an instant in a zone. */
function zonedDateParts(instant: Date, ianaTimeZone: string): { date: string; dayOfWeek: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ianaTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = formatter.formatToParts(instant);
  const value = (type: string): string => parts.find((part) => part.type === type)?.value ?? '';
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    dayOfWeek: weekdays[value('weekday')] ?? 0,
  };
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}

/** Subtract `cuts` from `base`, returning what remains, in order. */
export function subtractIntervals(
  base: readonly Interval[],
  cuts: readonly Interval[],
): Interval[] {
  let remaining = [...base];
  for (const cut of cuts) {
    const next: Interval[] = [];
    for (const piece of remaining) {
      if (!overlaps(piece, cut)) {
        next.push(piece);
        continue;
      }
      // Left fragment, if the cut starts after the piece does.
      if (piece.startAt < cut.startAt) {
        next.push({ startAt: piece.startAt, endAt: cut.startAt });
      }
      // Right fragment, if the cut ends before the piece does.
      if (cut.endAt < piece.endAt) {
        next.push({ startAt: cut.endAt, endAt: piece.endAt });
      }
    }
    remaining = next;
  }
  return remaining.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

/** Merge overlapping or touching intervals so slot generation cannot double-count. */
export function mergeIntervals(intervals: readonly Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last !== undefined && interval.startAt <= last.endAt) {
      if (interval.endAt > last.endAt) {
        merged[merged.length - 1] = { startAt: last.startAt, endAt: interval.endAt };
      }
      continue;
    }
    merged.push({ startAt: interval.startAt, endAt: interval.endAt });
  }
  return merged;
}

/**
 * Project one recurring rule onto concrete instants inside `window`.
 *
 * Each day is converted independently through the rule's zone, so a rule
 * spanning a daylight-saving change keeps its local wall-clock time on both
 * sides rather than drifting by an hour.
 */
export function projectRule(rule: RecurringRule, window: Interval): Interval[] {
  const projected: Interval[] = [];
  // Start a day early and end a day late: a local day in a distant zone can
  // begin before, or end after, the UTC window edge.
  const firstDay = new Date(window.startAt.getTime() - MS_PER_DAY);
  const lastDay = new Date(window.endAt.getTime() + MS_PER_DAY);

  for (let cursor = firstDay.getTime(); cursor <= lastDay.getTime(); cursor += MS_PER_DAY) {
    const { date, dayOfWeek } = zonedDateParts(new Date(cursor), rule.ianaTimeZone);
    if (dayOfWeek !== rule.dayOfWeek) continue;
    if (date < rule.effectiveFrom) continue;
    if (rule.effectiveUntil !== null && date > rule.effectiveUntil) continue;

    const startAt = zonedTimeToUtc(date, rule.localStartTime, rule.ianaTimeZone);
    const endAt = zonedTimeToUtc(date, rule.localEndTime, rule.ianaTimeZone);
    if (endAt <= startAt) continue;
    if (!overlaps({ startAt, endAt }, window)) continue;
    projected.push({ startAt, endAt });
  }
  return projected;
}

/**
 * The layered calculation. Returns **positive bookable slots only** — never a
 * reason, never a gap, never the rule or block that produced either.
 *
 * That output shape is the privacy boundary for every family-facing surface:
 * because only bookable slots are returned, a gap is indistinguishable between
 * "already booked", "blocked for a private reason", "on holiday", "held by
 * another family's acceptance" and "outside working hours".
 */
export function bookableSlots(input: BookableSlotsInput): Interval[] {
  const {
    rules,
    exceptions,
    reservations,
    window,
    durationMinutes,
    defaultMinimumNoticeMinutes,
    defaultMaximumAdvanceBookingDays,
    now,
    stepMinutes = 30,
  } = input;

  if (durationMinutes <= 0) return [];
  if (window.endAt <= window.startAt) return [];
  if (window.endAt.getTime() - window.startAt.getTime() > MAX_WINDOW_DAYS * MS_PER_DAY) {
    throw new Error(`Availability window may not exceed ${MAX_WINDOW_DAYS} days.`);
  }

  // Minimum notice and maximum advance are per rule where set. Take the
  // strictest across the contributing rules: offering a slot one rule would
  // refuse would be offering something the tutor did not agree to.
  const notice = rules.reduce(
    (strictest, rule) =>
      Math.max(strictest, rule.minimumNoticeMinutes ?? defaultMinimumNoticeMinutes),
    rules.length === 0 ? defaultMinimumNoticeMinutes : 0,
  );
  const advanceDays = rules.reduce(
    (strictest, rule) =>
      Math.min(strictest, rule.maximumAdvanceBookingDays ?? defaultMaximumAdvanceBookingDays),
    defaultMaximumAdvanceBookingDays,
  );

  const earliestStart = new Date(now.getTime() + notice * MS_PER_MINUTE);
  const latestEnd = new Date(now.getTime() + advanceDays * MS_PER_DAY);

  const effectiveWindow: Interval = {
    startAt: new Date(Math.max(window.startAt.getTime(), earliestStart.getTime())),
    endAt: new Date(Math.min(window.endAt.getTime(), latestEnd.getTime())),
  };
  if (effectiveWindow.endAt <= effectiveWindow.startAt) return [];

  // base recurring availability
  const base = rules.flatMap((rule) => projectRule(rule, effectiveWindow));

  // + one-off additions
  const additions = exceptions
    .filter((exception) => exception.effectCode === 'adds')
    .map((exception) => ({ startAt: exception.startAt, endAt: exception.endAt }));

  const available = mergeIntervals([...base, ...additions]);

  // - blocked time, holidays and breaks
  const removals = exceptions
    .filter((exception) => exception.effectCode === 'removes')
    .map((exception) => ({ startAt: exception.startAt, endAt: exception.endAt }));

  // - confirmed bookings and active holds (one table, both kinds)
  const cuts = [...removals, ...reservations];

  const openPeriods = subtractIntervals(available, cuts)
    // Clip to the effective window so notice and advance limits bind.
    .map((period) => ({
      startAt: new Date(Math.max(period.startAt.getTime(), effectiveWindow.startAt.getTime())),
      endAt: new Date(Math.min(period.endAt.getTime(), effectiveWindow.endAt.getTime())),
    }))
    .filter((period) => period.endAt > period.startAt);

  // Cut each open period into bookable slots of the requested duration.
  const durationMs = durationMinutes * MS_PER_MINUTE;
  const stepMs = stepMinutes * MS_PER_MINUTE;
  const slots: Interval[] = [];

  for (const period of openPeriods) {
    // Align the first start to the step grid, in UTC. Lesson times in practice
    // sit on hour and half-hour boundaries in the tutor's own zone, and every
    // zone Studdy serves is offset from UTC by a whole or half hour, so a UTC
    // grid and a local grid coincide.
    const firstStart = Math.ceil(period.startAt.getTime() / stepMs) * stepMs;
    for (let start = firstStart; start + durationMs <= period.endAt.getTime(); start += stepMs) {
      slots.push({ startAt: new Date(start), endAt: new Date(start + durationMs) });
    }
  }

  return slots.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

/** The soonest bookable slot, or null. Drives the coarse public signal. */
export function nextBookableSlot(slots: readonly Interval[]): Interval | null {
  return slots.length === 0 ? null : (slots[0] ?? null);
}
