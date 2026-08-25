import { PLATFORM_TIME_ZONE } from '../time';

/**
 * How a chosen time is written once it has been chosen.
 *
 * THE GRID OFFERS STARTS EVERY FIFTEEN MINUTES; THE FAMILY IS NOT CHOOSING
 * FIFTEEN-MINUTE BLOCKS. On the calendar a marker reads `4:15` because the
 * screen has already said how long the lesson is and a full interval on every
 * marker would be unreadable. The moment a time is chosen that context is gone
 * — it travels into a receipt, an accordion row and a review screen — so from
 * then on it is written as the interval the lesson actually occupies.
 *
 * THE MINIMUM GAP IS NEVER INCLUDED. A 60-minute lesson starting at four
 * o'clock is `4:00–5:00 pm` even where the tutor keeps fifteen minutes clear
 * afterwards and cannot take another lesson until 5:15. That gap is scheduling
 * protection for the tutor, not lesson time the family is asking for or paying
 * for, and folding it in would overstate the request.
 *
 * Pure and free of `server-only` on purpose: this is the one place the wording
 * is decided, it is shared by three server screens, and it is worth testing
 * without a database.
 */

const DATE_PART = new Intl.DateTimeFormat('en-NZ', {
  timeZone: PLATFORM_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const CLOCK_PART = new Intl.DateTimeFormat('en-NZ', {
  timeZone: PLATFORM_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
});

/** '4:00 pm' → { clock: '4:00', meridiem: 'pm' } */
function splitClock(at: Date): { clock: string; meridiem: string } {
  // en-NZ puts a NARROW NO-BREAK SPACE (U+202F) before the meridiem, and some
  // runtimes use a plain no-break space (U+00A0). Written as escapes rather
  // than literals: those characters are invisible in a diff, and a reviewer
  // cannot tell a deliberate normalisation from a stray keystroke.
  const formatted = CLOCK_PART.format(at).replace(/[\u202f\u00a0]/g, ' ');
  const match = /^(.*?)\s*([ap]\.?m\.?)$/i.exec(formatted);
  if (match === null) return { clock: formatted, meridiem: '' };
  return {
    clock: match[1] ?? formatted,
    meridiem: (match[2] ?? '').toLowerCase().replace(/\./g, ''),
  };
}

export function endOfLesson(startAt: Date, durationMinutes: number): Date {
  return new Date(startAt.getTime() + durationMinutes * 60_000);
}

/**
 * '4:00–5:00 pm', or '11:30 am–1:00 pm' when the lesson crosses midday.
 *
 * The meridiem is said once where both ends share it, because repeating it
 * reads as two separate times rather than one span.
 */
export function lessonClockRange(startAt: Date, durationMinutes: number): string {
  const start = splitClock(startAt);
  const end = splitClock(endOfLesson(startAt, durationMinutes));

  return start.meridiem === end.meridiem && start.meridiem !== ''
    ? `${start.clock}–${end.clock} ${end.meridiem}`
    : `${start.clock} ${start.meridiem}–${end.clock} ${end.meridiem}`.replace(/\s+/g, ' ').trim();
}

/** 'Wed 26 Aug · 4:00–5:00 pm' — recognisable out of context. */
export function bookingIntervalLabel(startAt: Date, durationMinutes: number): string {
  const day = DATE_PART.format(startAt).replace(',', '');
  return `${day} · ${lessonClockRange(startAt, durationMinutes)}`;
}
