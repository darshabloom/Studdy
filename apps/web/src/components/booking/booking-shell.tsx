import Link from 'next/link';
import type { ReactNode } from 'react';
import { BookingSummary, type SummaryRow } from './booking-summary';
import {
  BOOKING_STEPS,
  bookingHref,
  paramsUpTo,
  type BookingParams,
  type BookingStep,
} from '@/lib/booking/draft';

export interface BookingShellProps {
  readonly step: BookingStep;
  readonly params: BookingParams;
  /** The request so far, from `summaryRows`. */
  readonly rows: readonly SummaryRow[];
  /** Steps this journey never asks, e.g. format with one possible answer. */
  readonly skipped?: readonly BookingStep[];
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
}

/**
 * The frame every booking step sits in, and the reason the answers stay on
 * screen.
 *
 * ONE DOM, TWO SHAPES. On a wide screen the current question sits beside a
 * persistent panel holding everything decided so far. On a narrow one the same
 * rows become an accordion: answered sections collapsed above, the open
 * question in place, the rest waiting below. Only the summary markup is
 * duplicated across the two — static rows, each hidden by `display: none` at
 * the other width, so neither is read twice. THE QUESTION IS RENDERED ONCE;
 * duplicating it would double-mount its form.
 *
 * The accordion needs no client state. Each route already IS one section
 * expanded, so "tap a completed section to reopen it" is an ordinary link, and
 * refresh, the back button and deep links keep working exactly as before.
 */
export function BookingShell({
  step,
  params,
  rows,
  skipped = [],
  title,
  description,
  children,
}: BookingShellProps): ReactNode {
  const visible = rows.filter((row) => !skipped.includes(row.step) || row.value !== null);
  const currentIndex = visible.findIndex((row) => row.step === step);

  /**
   * The review screen renders the summary itself, as its whole content.
   *
   * Showing the panel there too would put the same six answers on screen twice,
   * side by side — which reads less like a reminder than like two things that
   * might disagree, at exactly the moment a parent is checking they agree.
   */
  const ownsItsSummary = currentIndex === -1;
  const before = ownsItsSummary ? [] : visible.slice(0, currentIndex + 1);
  const after = ownsItsSummary ? [] : visible.slice(currentIndex + 1);

  const backHref = previousHref(step, params, skipped);

  return (
    // Wide enough that the summary panel does not squeeze the question. The
    // times step draws a seven-column week with a real minimum width; at the
    // narrower container the last day fell off the edge behind a scrollbar.
    <section className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <header className="mb-5">
        <h1 className="font-display text-2xl font-semibold text-brand-purple-deep md:text-3xl">
          {title}
        </h1>
        {description !== undefined ? (
          <p className="mt-2 max-w-2xl text-text-secondary">{description}</p>
        ) : null}
      </header>

      <div
        className={
          ownsItsSummary ? '' : 'md:grid md:grid-cols-[minmax(0,1fr)_18rem] md:items-start md:gap-8'
        }
      >
        {/* Mobile: the sections already answered, collapsed above the question. */}
        {before.length > 0 ? (
          <div className="mb-4 md:hidden">
            <BookingSummary rows={before} current={step} params={params} bare />
          </div>
        ) : null}

        <main className="min-w-0">{children}</main>

        {/* Mobile: the questions still to come, waiting below. */}
        {after.length > 0 ? (
          <div className="mt-5 md:hidden">
            <BookingSummary rows={after} current={step} params={params} bare />
          </div>
        ) : null}

        {/* Desktop: the whole request, always in view. */}
        {ownsItsSummary ? null : (
          <div className="hidden md:sticky md:top-6 md:block">
            <BookingSummary rows={visible} current={step} params={params} />
          </div>
        )}
      </div>

      {backHref !== null ? (
        <div className="mt-6 border-t border-surface-border pt-4">
          <Link href={backHref} className="text-sm text-brand-purple hover:underline">
            ← Back
          </Link>
        </div>
      ) : null}
    </section>
  );
}

/**
 * The previous question, skipping any this journey never asked.
 *
 * Back has to land where the parent actually came from, not on a screen they
 * were routed past because it had only one possible answer.
 */
function previousHref(
  step: BookingStep,
  params: BookingParams,
  skipped: readonly BookingStep[],
): string | null {
  let index = BOOKING_STEPS.indexOf(step) - 1;
  while (index > 0 && skipped.includes(BOOKING_STEPS[index]!)) index -= 1;
  if (index < 0) return null;
  const target = BOOKING_STEPS[index]!;
  return bookingHref(target, paramsUpTo(target, params));
}
