import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  BOOKING_STEPS,
  bookingHref,
  paramsUpTo,
  type BookingParams,
  type BookingStep,
} from '@/lib/booking/draft';
import { rowIsAnswered } from '@/lib/booking/sections';

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
 * That includes a row whose question had only one option, and a row that
 * arrived prefilled from the entry context. Both are real choices the parent
 * made, and a parent who wants to reconsider "the only tutor" is exactly the
 * person who most needs the way back.
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
        const answered = rowIsAnswered(row);
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
                    {row.values !== undefined ? (
                      <>
                        {row.values.map((entry) => (
                          <span key={entry} className="block tabular-nums">
                            {entry}
                          </span>
                        ))}
                        {row.note !== undefined ? (
                          <span className="mt-0.5 block text-xs font-normal text-text-muted">
                            {row.note}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      row.value
                    )}
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
