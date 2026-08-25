import 'server-only';
import { PLATFORM_TIME_ZONE } from '../time';
import { bookingIntervalLabel } from './time-labels';
import type { SummaryRow } from '@/components/booking/booking-summary';
import type { ResolvedBooking } from './resolve';

/**
 * The request so far, as one list every screen renders identically.
 *
 * Derived from the SAME `ResolvedBooking` the screens are guarded by, so the
 * summary cannot claim an answer the server would refuse. There is no separate
 * draft to drift.
 */

function money(amountMinor: bigint, currencyCode: string): string {
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: currencyCode }).format(
    Number(amountMinor) / 100,
  );
}

/** 'Mon 24 Aug, 5:30 pm' — recognisable out of context. */
export function bookingTimeLabel(at: Date): string {
  return new Intl.DateTimeFormat('en-NZ', {
    timeZone: PLATFORM_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
    .format(at)
    .replace(',', '');
}

/**
 * Every answer the family has actually given.
 *
 * There is no "settled" state any more, and no `(only option)` marker. Every
 * value on this list is a choice the parent made — including one that arrived
 * prefilled from the entry context, because choosing "Book a lesson" on a
 * tutor's profile IS choosing that tutor. So every answered row is changeable,
 * and none of them needs an apology for how it got here.
 *
 * TIMES ARE INTERVALS, AND THEY ARE ALTERNATIVES. Each is written as the span
 * the lesson would occupy rather than as a bare start, and they are kept as
 * separate entries rather than joined into one sentence — a comma-joined list
 * reads like a series of lessons being requested, when in fact the tutor will
 * accept at most one of them.
 */
export function summaryRows(booking: ResolvedBooking): readonly SummaryRow[] {
  const { student, subject, tutor, version, format, times } = booking;

  return [
    { step: 'child', label: 'Who for', value: student?.preferredName ?? null },
    { step: 'subject', label: 'Subject', value: subject?.displayName ?? null },
    { step: 'tutor', label: 'Tutor', value: tutor?.firstName ?? null },
    {
      step: 'length',
      label: 'Lesson length',
      value:
        version === null
          ? null
          : `${String(version.durationMinutes)} minutes · ${money(version.priceAmountMinor, version.currencyCode)}`,
    },
    {
      step: 'format',
      label: 'Online or in person',
      value: format === null ? null : format === 'online' ? 'Online' : 'In person',
    },
    {
      step: 'times',
      label: times.length === 1 ? 'Preferred time' : 'Preferred times',
      value: times.length === 0 || version === null ? null : null,
      values:
        times.length === 0 || version === null
          ? undefined
          : times.map((at) => bookingIntervalLabel(at, version.durationMinutes)),
      // Said where the times are, because a list of them is exactly what looks
      // like several lessons.
      note: times.length > 1 ? 'Any one of these' : undefined,
    },
  ];
}
