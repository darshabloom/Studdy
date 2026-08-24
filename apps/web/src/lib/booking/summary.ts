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

export function summaryRows(booking: ResolvedBooking): readonly SummaryRow[] {
  const { student, subject, tutor, version, format, formats, times } = booking;

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
      /**
       * Settled rather than chosen when the tutor delivers this lesson only one
       * way. It belongs in the summary — it is a fact about the request — but
       * marking it keeps the summary from crediting the parent with a decision
       * they were never offered.
       */
      settled: formats.length === 1,
    },
    {
      step: 'times',
      label: times.length === 1 ? 'Time' : 'Times',
      value: times.length === 0 ? null : times.map(bookingTimeLabel).join(', '),
    },
  ];
}
