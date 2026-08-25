import 'server-only';
import { PLATFORM_TIME_ZONE } from '../time';
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
 * Every answer, and whether the parent actually made it.
 *
 * `settled` carries two behaviours further out: the row is marked
 * `(only option)`, and it offers no `Change` — because following one would land
 * on a screen with a single choice already taken, which is not a change at all.
 * A parent wanting a different answer changes something UPSTREAM that could
 * genuinely open other options.
 */
export function summaryRows(booking: ResolvedBooking): readonly SummaryRow[] {
  const { student, subject, tutor, version, format, times, settled } = booking;

  return [
    {
      step: 'child',
      label: 'Who for',
      value: student?.preferredName ?? null,
      settled: settled.has('child'),
    },
    {
      step: 'subject',
      label: 'Subject',
      value: subject?.displayName ?? null,
      // Never settled by the server: every subject is a valid answer, so a
      // subject already filled in came from the family, not from us.
      settled: false,
    },
    {
      step: 'tutor',
      label: 'Tutor',
      value: tutor?.firstName ?? null,
      settled: settled.has('tutor'),
    },
    {
      step: 'length',
      label: 'Lesson length',
      value:
        version === null
          ? null
          : `${String(version.durationMinutes)} minutes · ${money(version.priceAmountMinor, version.currencyCode)}`,
      settled: settled.has('length'),
    },
    {
      step: 'format',
      label: 'Online or in person',
      value: format === null ? null : format === 'online' ? 'Online' : 'In person',
      settled: settled.has('format'),
    },
    {
      step: 'times',
      label: times.length === 1 ? 'Time' : 'Times',
      value: times.length === 0 ? null : times.map(bookingTimeLabel).join(', '),
      settled: false,
    },
  ];
}
