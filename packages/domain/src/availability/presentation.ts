import type { Interval } from './slots';

/**
 * Presentation helpers for bookable slots.
 *
 * These take the two-instants shape the repository returns and nothing else,
 * so no rendering path can accidentally acquire a reason, a gap or a block by
 * going through them.
 *
 * Everything is formatted in an explicit IANA zone rather than the viewer's
 * own. A family in another zone comparing tutors needs one clock, and it has
 * to be the clock the lesson actually happens on.
 */

export interface LabelledSlot {
  readonly startAt: Date;
  readonly endAt: Date;
  /** '4:00 – 5:00 pm' */
  readonly label: string;
}

export interface SlotDay {
  /** 'YYYY-MM-DD' in the display zone — a stable key, not for display. */
  readonly date: string;
  /** 'Tue 2 Sep' */
  readonly label: string;
  readonly slots: readonly LabelledSlot[];
}

function parts(instant: Date, ianaTimeZone: string): Record<string, string> {
  const formatter = new Intl.DateTimeFormat('en-NZ', {
    timeZone: ianaTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const found: Record<string, string> = {};
  for (const part of formatter.formatToParts(instant)) found[part.type] = part.value;
  return found;
}

function dateKey(instant: Date, ianaTimeZone: string): string {
  const p = parts(instant, ianaTimeZone);
  return `${p['year'] ?? ''}-${p['month'] ?? ''}-${p['day'] ?? ''}`;
}

/**
 * 'YYYY-MM-DD' in the given zone — the machine form, for storage.
 *
 * Stored alongside the instant so a rendered time can never drift from the one
 * the family actually chose, even if a zone's rules change beneath it.
 */
export function zonedDateOnly(instant: Date, ianaTimeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ianaTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(instant);
}

/** 'HH:mm' in the given zone — the machine form, for storage. */
export function zonedClockTime(instant: Date, ianaTimeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: ianaTimeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(instant);
}

/** 'Tue 2 Sep' — weekday included because families scan by weekday. */
export function dayLabel(instant: Date, ianaTimeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-NZ', {
    timeZone: ianaTimeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return formatter.format(instant).replace(',', '');
}

/** '4:00 pm' */
export function timeLabel(instant: Date, ianaTimeZone: string): string {
  const p = parts(instant, ianaTimeZone);
  return `${p['hour'] ?? ''}:${p['minute'] ?? ''} ${(p['dayPeriod'] ?? '').toLowerCase()}`.trim();
}

/**
 * '4:00 – 5:00 pm'. The meridiem is dropped from the start when both ends
 * share it, which is the common case and reads far better in a dense grid.
 */
export function slotLabel(slot: Interval, ianaTimeZone: string): string {
  const start = parts(slot.startAt, ianaTimeZone);
  const end = parts(slot.endAt, ianaTimeZone);
  const startPeriod = (start['dayPeriod'] ?? '').toLowerCase();
  const endPeriod = (end['dayPeriod'] ?? '').toLowerCase();
  const startClock = `${start['hour'] ?? ''}:${start['minute'] ?? ''}`;
  const endClock = `${end['hour'] ?? ''}:${end['minute'] ?? ''}`;
  return startPeriod === endPeriod
    ? `${startClock} – ${endClock} ${endPeriod}`.trim()
    : `${startClock} ${startPeriod} – ${endClock} ${endPeriod}`.trim();
}

/**
 * Group slots into days, in chronological order.
 *
 * `maxDays` limits how far the caller renders, not how far availability was
 * derived — a card showing the next two days must not imply there is nothing
 * after them.
 */
export function groupSlotsByDay(
  slots: readonly Interval[],
  ianaTimeZone: string,
  maxDays?: number,
): readonly SlotDay[] {
  const days = new Map<string, LabelledSlot[]>();
  const ordered = [...slots].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  for (const slot of ordered) {
    const key = dateKey(slot.startAt, ianaTimeZone);
    const labelled: LabelledSlot = {
      startAt: slot.startAt,
      endAt: slot.endAt,
      label: slotLabel(slot, ianaTimeZone),
    };
    const existing = days.get(key);
    if (existing === undefined) days.set(key, [labelled]);
    else existing.push(labelled);
  }

  const grouped: SlotDay[] = [];
  for (const [date, daySlots] of days) {
    const first = daySlots[0];
    if (first === undefined) continue;
    grouped.push({ date, label: dayLabel(first.startAt, ianaTimeZone), slots: daySlots });
  }
  return maxDays === undefined ? grouped : grouped.slice(0, maxDays);
}

/**
 * 'Next available Tue 2 Sep, 4:00 pm', or null when there is none.
 *
 * Null means "no bookable time in the window asked about" and nothing more.
 * It carries no distinction between a full calendar, a holiday and a tutor who
 * simply does not work then.
 */
export function nextAvailableLabel(
  slots: readonly Interval[],
  ianaTimeZone: string,
): string | null {
  let earliest: Interval | undefined;
  for (const slot of slots) {
    if (earliest === undefined || slot.startAt < earliest.startAt) earliest = slot;
  }
  if (earliest === undefined) return null;
  return `${dayLabel(earliest.startAt, ianaTimeZone)}, ${timeLabel(earliest.startAt, ianaTimeZone)}`;
}
