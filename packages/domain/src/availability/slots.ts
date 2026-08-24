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
 * - the tutor's minimum gap between lessons
 * - holidays and breaks
 * - capacity restrictions   (not in this checkpoint — see NOT YET SUBTRACTED)
 * - minimum notice
 * - service eligibility
 * = bookable availability
 *
 * This module is pure: no database, no clock of its own, no Next.js. `now` is
 * always passed in, so every case is testable without freezing time globally.
 *
 * NOT YET SUBTRACTED, and declared rather than left to be discovered: capacity
 * rules (§8.9), modelled in doc 07 but out of scope. A tutor may therefore be
 * offered more requests than a capacity rule would allow.
 *
 * The minimum gap is ONE tutor-level number, not yet split by format. A
 * per-format travel buffer (§8.8) is a different, larger idea — an in-person
 * lesson across town needs more than a reset between two video calls — and
 * inventing half of it here would be worse than one honest figure.
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
  /**
   * Which lesson format this rule offers: 'any' means either.
   *
   * A SCOPE ON SUPPLY, NOT A THIRD FORMAT. A lesson is delivered one way or the
   * other, so demand is always concrete; a rule is either tied to one format or
   * unscoped. Optional so callers written before formats existed keep working —
   * absent reads as 'any'.
   */
  readonly lessonFormatCode?: LessonFormatScope;
}

/** What a lesson can actually be. `any` is only ever a scope on availability. */
export type LessonFormat = 'online' | 'in_person';
export type LessonFormatScope = LessonFormat | 'any';

export interface AvailabilityException extends Interval {
  readonly effectCode: 'adds' | 'removes';
  /**
   * Scope of a one-off ADDITION. Ignored for `removes`: being unavailable is a
   * fact about the tutor, not about how a lesson would have been delivered, so
   * a block removes the time whatever format was asked for.
   */
  readonly lessonFormatCode?: LessonFormatScope;
}

/**
 * Does an availability scope satisfy the format being asked for?
 *
 * No format asked means no filtering at all, which keeps every caller written
 * before formats existed behaving exactly as it did.
 */
export function formatMatches(
  scope: LessonFormatScope | undefined,
  requested: LessonFormat | undefined,
): boolean {
  if (requested === undefined) return true;
  const effective = scope ?? 'any';
  return effective === 'any' || effective === requested;
}

export interface BookableSlotsInput {
  readonly rules: readonly RecurringRule[];
  readonly exceptions: readonly AvailabilityException[];
  /** Active reservations: confirmed bookings AND request holds alike. */
  readonly reservations: readonly Interval[];
  /**
   * The least time that must separate one lesson from the next, in minutes.
   *
   * Applied to RESERVATIONS ONLY — bookings and holds, which are lessons. A
   * blocked period is the tutor's own time off, not a lesson needing
   * turnaround, so it is subtracted exactly as it stands.
   */
  readonly minimumGapMinutes?: number;
  /** The window the caller wants slots for. */
  readonly window: Interval;
  readonly durationMinutes: number;
  /**
   * Narrow to availability that can be delivered this way. Omitted means the
   * caller is not asking about a format and every rule contributes.
   */
  readonly formatCode?: LessonFormat;
  /** Applied when a rule does not carry its own. */
  readonly defaultMinimumNoticeMinutes: number;
  readonly defaultMaximumAdvanceBookingDays: number;
  readonly now: Date;
  /**
   * Slot start granularity in minutes.
   *
   * Fifteen: quarter past and quarter to are times people say out loud, and a
   * school day does not divide neatly into halves — a lesson after a 3:45
   * pick-up is a real lesson. An arbitrary 09:07 start would be technically
   * bookable and practically absurd, which is what the grid exists to prevent.
   */
  readonly stepMinutes?: number;
}

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
/** A recurring rule cannot be projected further than this in one query. */
const MAX_WINDOW_DAYS = 62;

/**
 * The grid family-selectable lesson starts sit on.
 *
 * Exported because the booking calendar draws one block per possible start and
 * has to size them to the same figure; a display that disagreed with the
 * derivation would show gaps between adjacent options, or overlap them.
 */
export const SLOT_STEP_MINUTES = 15;

/** Used when a tutor has no configured gap. Mirrors the column default. */
export const DEFAULT_MINIMUM_GAP_MINUTES = 15;

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
    stepMinutes = SLOT_STEP_MINUTES,
    minimumGapMinutes = DEFAULT_MINIMUM_GAP_MINUTES,
    formatCode,
  } = input;

  if (durationMinutes <= 0) return [];
  if (window.endAt <= window.startAt) return [];
  if (window.endAt.getTime() - window.startAt.getTime() > MAX_WINDOW_DAYS * MS_PER_DAY) {
    throw new Error(`Availability window may not exceed ${MAX_WINDOW_DAYS} days.`);
  }

  // Only rules that could deliver the requested format contribute anything —
  // including their notice and advance limits. Narrowing this first matters:
  // an in-person rule with a long notice period must not tighten the notice on
  // an online request it can play no part in.
  const applicableRules = rules.filter((rule) => formatMatches(rule.lessonFormatCode, formatCode));

  // Minimum notice and maximum advance are per rule where set. Take the
  // strictest across the contributing rules: offering a slot one rule would
  // refuse would be offering something the tutor did not agree to.
  const notice = applicableRules.reduce(
    (strictest, rule) =>
      Math.max(strictest, rule.minimumNoticeMinutes ?? defaultMinimumNoticeMinutes),
    applicableRules.length === 0 ? defaultMinimumNoticeMinutes : 0,
  );
  const advanceDays = applicableRules.reduce(
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
  const base = applicableRules.flatMap((rule) => projectRule(rule, effectiveWindow));

  // + one-off additions, scoped the same way a rule is
  const additions = exceptions
    .filter(
      (exception) =>
        exception.effectCode === 'adds' && formatMatches(exception.lessonFormatCode, formatCode),
    )
    .map((exception) => ({ startAt: exception.startAt, endAt: exception.endAt }));

  const available = mergeIntervals([...base, ...additions]);

  // - blocked time, holidays and breaks. NOT filtered by format: a block takes
  //   the time away whatever was asked for.
  const removals = exceptions
    .filter((exception) => exception.effectCode === 'removes')
    .map((exception) => ({ startAt: exception.startAt, endAt: exception.endAt }));

  /**
   * - confirmed bookings and active holds (one table, both kinds), each widened
   *   by the tutor's minimum gap ON BOTH SIDES.
   *
   * Both sides, because this asks "may a NEW lesson sit here" with only the
   * existing lesson in hand: a candidate must neither begin too soon after it
   * nor end too soon before it, and there is no second row's padding to lean
   * on. The database constraint pads one side instead, because there both rows
   * carry their own padding and padding both would demand two gaps. The two
   * express the same minimum separation from opposite ends.
   *
   * REMOVALS ARE NOT WIDENED. A blocked period is the tutor's own time off,
   * not a lesson they need to reset after — widening it would quietly take
   * half an hour of bookable time either side of every holiday.
   */
  const gapMs = Math.max(0, minimumGapMinutes) * MS_PER_MINUTE;
  const spacedReservations = reservations.map((reservation) => ({
    startAt: new Date(reservation.startAt.getTime() - gapMs),
    endAt: new Date(reservation.endAt.getTime() + gapMs),
  }));
  const cuts = [...removals, ...spacedReservations];

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
