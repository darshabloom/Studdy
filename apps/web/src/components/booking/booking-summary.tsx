import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  BOOKING_STEPS,
  bookingHref,
  paramsUpTo,
  type BookingParams,
  type BookingStep,
} from '@/lib/booking/draft';

/**
 * One answered — or not yet answered — question, as the summary shows it.
 *
 * `value` is what the parent chose, already formatted. `settled` marks a
 * question that never had to be asked because only one answer was possible: it
 * belongs in the summary as a fact about the request, but not as something the
 * parent decided.
 */
export interface SummaryRow {
  readonly step: BookingStep;
  readonly label: string;
  readonly value: string | null;
  readonly settled?: boolean;
}

export interface BookingSummaryProps {
  readonly rows: readonly SummaryRow[];
  readonly current: BookingStep;
  readonly params: BookingParams;
  /** Rendered flat, without the panel chrome — for the review screen. */
  readonly bare?: boolean;
}

/**
 * The request as it stands, built up answer by answer.
 *
 * WHY THIS EXISTS. A wizard that shows one question at a time and then takes
 * the answer away asks a parent to hold six decisions in their head and trust
 * that the seventh screen knows them. Keeping the answers on screen turns the
 * journey into something being assembled rather than a series of forms, and it
 * means the review screen is the finished state of a thing the parent has
 * watched grow rather than a summary appearing from nowhere at the end.
 *
 * EVERY ANSWERED ROW IS A LINK BACK. Changing an early answer is the commonest
 * thing a parent wants and the most expensive thing to get wrong; going back
 * drops the answers that depended on it, exactly as the URL model already does,
 * so a stale price or a time derived for a different lesson cannot survive.
 *
 * There is no client state here at all. The rows come from the same
 * `resolveBooking` every screen runs, so what the summary claims and what the
 * server would accept are the same thing by construction.
 */
export function BookingSummary({
  rows,
  current,
  params,
  bare = false,
}: BookingSummaryProps): ReactNode {
  const frontier = BOOKING_STEPS.indexOf(current);

  const list = (
    <ol className="flex flex-col">
      {rows.map((row) => {
        const answered = row.value !== null;
        const isCurrent = row.step === current;
        const canGoBack = answered && !isCurrent && BOOKING_STEPS.indexOf(row.step) < frontier;

        return (
          <li
            key={row.step}
            className="flex items-baseline justify-between gap-3 border-b border-surface-border py-2 last:border-b-0"
          >
            <span className="flex min-w-0 items-baseline gap-2">
              <span
                aria-hidden
                className={
                  answered
                    ? 'text-sm font-semibold text-brand-purple'
                    : isCurrent
                      ? 'text-sm font-semibold text-brand-purple'
                      : 'text-sm text-text-muted'
                }
              >
                {answered ? '✓' : isCurrent ? '▸' : '·'}
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-text-muted">{row.label}</span>
                {answered ? (
                  <span className="block text-sm font-medium text-text-primary">
                    {row.value}
                    {row.settled === true ? (
                      // Said plainly rather than hidden: the parent did not
                      // choose this, and a summary that implied they had would
                      // be putting words in their mouth.
                      <span className="ml-1 font-normal text-text-muted">(only option)</span>
                    ) : null}
                  </span>
                ) : (
                  <span className="block text-sm text-text-muted">
                    {isCurrent ? 'Choosing now' : 'Not yet'}
                  </span>
                )}
              </span>
            </span>

            {canGoBack ? (
              <Link
                href={bookingHref(row.step, paramsUpTo(row.step, params))}
                className="shrink-0 rounded-[var(--radius-gentle)] text-xs font-medium text-brand-purple underline underline-offset-2 hover:text-brand-purple-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-purple"
              >
                Change<span className="sr-only"> {row.label}</span>
              </Link>
            ) : null}
          </li>
        );
      })}
    </ol>
  );

  if (bare) return list;

  return (
    <aside
      aria-label="Your request so far"
      className="rounded-[var(--radius-medium)] border border-surface-border bg-surface-card p-4"
    >
      <h2 className="mb-1 text-sm font-semibold text-text-primary">Your request so far</h2>
      <p className="mb-2 text-xs text-text-muted">Nothing is sent until you review it.</p>
      {list}
    </aside>
  );
}
