import type { ReactNode } from 'react';
import { JourneySummary } from '@/components/journey/journey-summary';
import { bookingSections } from '@/lib/booking/sections';
import type { BookingParams, BookingStep } from '@/lib/booking/draft';

/**
 * One answered — or not yet answered — question, as the summary shows it.
 *
 * `value` is a single answer, already formatted. `values` is for an answer that
 * is genuinely several things — the preferred times — which are listed one per
 * line rather than joined, because joining them reads as several lessons being
 * requested rather than alternatives among which one will be accepted.
 */
export interface SummaryRow {
  readonly step: BookingStep;
  readonly label: string;
  readonly value: string | null;
  readonly values?: readonly string[] | undefined;
  /** A short qualifier under the value, e.g. 'Any one of these'. */
  readonly note?: string | undefined;
}

export interface BookingSummaryProps {
  readonly rows: readonly SummaryRow[];
  readonly current: BookingStep;
  readonly params: BookingParams;
  /** Rendered flat, without the panel chrome — for the review screen. */
  readonly bare?: boolean;
}

/**
 * The booking request as it stands.
 *
 * The rendering is `JourneySummary`, shared with the optional multi-tutor
 * journey; what stays here is the part that is specific to booking — turning
 * this journey's rows into sections, with this journey's ordering and its own
 * hrefs. A family moving between the two paths should not feel they have
 * changed product, and two copies of the receipt is how that starts.
 */
export function BookingSummary({
  rows,
  current,
  params,
  bare = false,
}: BookingSummaryProps): ReactNode {
  return (
    <JourneySummary
      sections={bookingSections(rows, current, params)}
      title="Your request so far"
      caption="Nothing is sent until you review it."
      bare={bare}
    />
  );
}
