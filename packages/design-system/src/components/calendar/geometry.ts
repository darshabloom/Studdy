/**
 * Week-calendar geometry.
 *
 * Deliberately free of dates and time zones. The calendar renders WALL-CLOCK
 * coordinates — a day index and minutes past midnight — and the caller converts
 * instants into them using the one zone the platform schedules in. Keeping the
 * conversion out here means the grid maths can be tested exhaustively without a
 * clock, and there is exactly one place in the application where a zone is
 * applied rather than one per calendar.
 */

/** Monday = 0 … Sunday = 6. Weeks start Monday: school weeks read that way. */
export const WEEKDAY_COLUMN_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const DAYS_IN_WEEK = 7;
export const MINUTES_IN_DAY = 24 * 60;

/**
 * What a block means, which is also what it is allowed to say.
 *
 * `blocked` exists ONLY for the tutor's own editing view. No family-facing
 * calendar may ever be handed one: a family sees positive bookable time and
 * absence, never a marked-out reason for absence.
 */
export type CalendarBlockRole =
  'available' | 'available_once' | 'blocked' | 'hold' | 'lesson' | 'selected' | 'candidate';

/**
 * Roles a family-facing calendar may render. Enforced by `assertFamilySafe`.
 *
 * `available_once` belongs here because a one-off addition is ordinary bookable
 * time: it says the tutor is free, which is the entire point of the surface. It
 * exists as its own role so the TUTOR can tell a recurring rule from a one-off
 * while editing. Family projections still emit only `available`, so a family is
 * never told which kind of row produced a slot.
 */
export const FAMILY_SAFE_ROLES: readonly CalendarBlockRole[] = [
  'available',
  'available_once',
  'selected',
  'candidate',
];

export interface CalendarBlock {
  readonly id: string;
  /** 0 = Monday … 6 = Sunday, in the display zone. */
  readonly dayIndex: number;
  /** Minutes past local midnight. */
  readonly startMinutes: number;
  readonly endMinutes: number;
  readonly role: CalendarBlockRole;
  readonly label?: string;
  /** Aggregate views: how many tutors offer this time. */
  readonly count?: number;
}

export interface CalendarWindow {
  /** First minute shown, e.g. 7 * 60. */
  readonly dayStartMinutes: number;
  /** Last minute shown, e.g. 21 * 60. */
  readonly dayEndMinutes: number;
}

export interface BlockPosition {
  /** Percentage from the top of the day column. */
  readonly topPercent: number;
  readonly heightPercent: number;
}

/** Clamp a block to the visible window and express it as percentages. */
export function blockPosition(block: CalendarBlock, window: CalendarWindow): BlockPosition | null {
  const span = window.dayEndMinutes - window.dayStartMinutes;
  if (span <= 0) return null;

  const start = Math.max(block.startMinutes, window.dayStartMinutes);
  const end = Math.min(block.endMinutes, window.dayEndMinutes);
  // Entirely outside the visible hours: not rendered rather than squashed to a
  // sliver, which would read as availability that is not there.
  if (end <= start) return null;

  return {
    topPercent: ((start - window.dayStartMinutes) / span) * 100,
    heightPercent: ((end - start) / span) * 100,
  };
}

/** Round to the nearest step. Used when a drag ends between grid lines. */
export function snapMinutes(minutes: number, stepMinutes: number): number {
  if (stepMinutes <= 0) return minutes;
  return Math.round(minutes / stepMinutes) * stepMinutes;
}

/**
 * Minutes at a pointer position within a day column.
 *
 * `offsetY` and `height` are in the same units (pixels); the result is snapped
 * and clamped to the window, so a drag that leaves the column cannot create a
 * block outside the hours on screen.
 */
export function minutesAtOffset(
  offsetY: number,
  height: number,
  window: CalendarWindow,
  stepMinutes: number,
): number {
  if (height <= 0) return window.dayStartMinutes;
  const span = window.dayEndMinutes - window.dayStartMinutes;
  const raw = window.dayStartMinutes + (offsetY / height) * span;
  const snapped = snapMinutes(raw, stepMinutes);
  return Math.min(Math.max(snapped, window.dayStartMinutes), window.dayEndMinutes);
}

/**
 * A dragged range, normalised.
 *
 * Dragging upwards is the same gesture as dragging downwards, and a drag that
 * never moved still means "one step", so a click creates a block rather than
 * nothing at all.
 */
export function draggedRange(
  anchorMinutes: number,
  pointerMinutes: number,
  window: CalendarWindow,
  stepMinutes: number,
): { startMinutes: number; endMinutes: number } {
  const low = Math.min(anchorMinutes, pointerMinutes);
  const high = Math.max(anchorMinutes, pointerMinutes);
  const startMinutes = low;
  const endMinutes = high === low ? low + stepMinutes : high;
  return {
    startMinutes: Math.max(startMinutes, window.dayStartMinutes),
    endMinutes: Math.min(endMinutes, window.dayEndMinutes),
  };
}

/** Whole-hour gridlines inside the window, for labels and rules. */
export function hourMarks(window: CalendarWindow): readonly number[] {
  const marks: number[] = [];
  const first = Math.ceil(window.dayStartMinutes / 60) * 60;
  for (let minute = first; minute <= window.dayEndMinutes; minute += 60) marks.push(minute);
  return marks;
}

/** '4 pm', '4:30 pm' — short labels for a dense axis. */
export function clockLabel(minutes: number): string {
  const total = ((minutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const hour24 = Math.floor(total / 60);
  const minute = total % 60;
  const period = hour24 < 12 ? 'am' : 'pm';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return minute === 0
    ? `${String(hour12)} ${period}`
    : `${String(hour12)}:${String(minute).padStart(2, '0')} ${period}`;
}

/**
 * The narrowest window that shows every block, padded to whole hours.
 *
 * A calendar fixed at 00:00–24:00 wastes most of its height on hours nobody
 * teaches; one fitted to the data keeps the blocks legible, which is the whole
 * point of a mini calendar.
 */
export function fittedWindow(
  blocks: readonly CalendarBlock[],
  fallback: CalendarWindow,
  paddingMinutes = 60,
): CalendarWindow {
  if (blocks.length === 0) return fallback;
  let earliest = MINUTES_IN_DAY;
  let latest = 0;
  for (const block of blocks) {
    earliest = Math.min(earliest, block.startMinutes);
    latest = Math.max(latest, block.endMinutes);
  }
  const start = Math.max(0, Math.floor((earliest - paddingMinutes) / 60) * 60);
  const end = Math.min(MINUTES_IN_DAY, Math.ceil((latest + paddingMinutes) / 60) * 60);
  return end > start ? { dayStartMinutes: start, dayEndMinutes: end } : fallback;
}

/**
 * Refuse to render tutor-private roles in a family-facing calendar.
 *
 * One shared calendar makes it easy to pass the wrong projection in — the
 * component cannot tell a derived slot from a raw rule by looking at it. This
 * turns that mistake into a loud failure at the boundary instead of a silent
 * disclosure of when a tutor is blocked and why.
 */
export function assertFamilySafe(blocks: readonly CalendarBlock[]): void {
  const offender = blocks.find((block) => !FAMILY_SAFE_ROLES.includes(block.role));
  if (offender !== undefined) {
    throw new Error(
      `A family-facing calendar was given a '${offender.role}' block. Family views receive ` +
        'derived bookable slots only — never rules, blocks, holds or lessons.',
    );
  }
}
