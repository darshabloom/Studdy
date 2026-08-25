import Link from 'next/link';
import type { ReactNode } from 'react';
import { CollapsedSection, CurrentSectionHeader } from './booking-accordion';
import { BookingSummary, type SummaryRow } from './booking-summary';
import { bookingSections, previousHref, unaskedSteps } from '@/lib/booking/sections';
import type { BookingParams, BookingStep } from '@/lib/booking/draft';

export interface BookingShellProps {
  readonly step: BookingStep;
  readonly params: BookingParams;
  /** The request so far, from `summaryRows`. */
  readonly rows: readonly SummaryRow[];
  /**
   * Steps this journey states outright it will not ask.
   *
   * Nothing is inferred into this any more — a question with one option is
   * still asked — but the prop stays so a screen that genuinely knows a step is
   * unreachable can say so rather than promise it.
   */
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
 * answers become an accordion: completed sections collapsed above, the open
 * question beneath its own section header, the rest waiting below. Only the
 * static summary markup differs between the two, and each copy is hidden by
 * `display: none` at the other width, so nothing is read twice. THE QUESTION IS
 * RENDERED ONCE; duplicating it would double-mount its form.
 *
 * The accordion needs no client state. Each route already IS one section
 * expanded, so "tap a completed section to reopen it" is an ordinary link, and
 * opening one closes the current one because the next page renders with a
 * different section open.
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
  const sections = bookingSections(visible, step, params);
  const currentIndex = sections.findIndex((section) => section.state === 'current');

  /**
   * The review screen renders the summary itself, as its whole content.
   *
   * Showing the panel there too would put the same answers on screen twice,
   * side by side — which reads less like a reminder than like two things that
   * might disagree, at exactly the moment a parent is checking they agree.
   */
  const ownsItsSummary = currentIndex === -1;
  const before = ownsItsSummary ? [] : sections.slice(0, currentIndex);
  const current = ownsItsSummary ? null : (sections[currentIndex] ?? null);
  const after = ownsItsSummary ? [] : sections.slice(currentIndex + 1);

  const back = previousHref(step, params, unaskedSteps(visible, skipped));

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
          <div className="mb-3 flex flex-col gap-2 md:hidden">
            {before.map((section) => (
              <CollapsedSection key={section.step} section={section} />
            ))}
          </div>
        ) : null}

        {/*
         * The open section. On mobile it is a card carrying its own header, so
         * the question reads as one expanded accordion panel rather than as a
         * form that happens to follow a receipt. Above `md` the card chrome is
         * dropped and this is simply the first grid column, unchanged.
         */}
        <div className="min-w-0 rounded-[var(--radius-medium)] border border-brand-purple/40 bg-surface-card p-3 shadow-sm md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none">
          {current !== null ? (
            <div className="md:hidden">
              <CurrentSectionHeader section={current} />
            </div>
          ) : null}
          <main className="min-w-0">{children}</main>
        </div>

        {/* Mobile: the questions still to come, waiting below. */}
        {after.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2 md:hidden">
            {after.map((section) => (
              <CollapsedSection key={section.step} section={section} />
            ))}
          </div>
        ) : null}

        {/* Desktop: the whole request, always in view. */}
        {ownsItsSummary ? null : (
          <div className="hidden md:sticky md:top-6 md:block">
            <BookingSummary rows={visible} current={step} params={params} />
          </div>
        )}
      </div>

      {back !== null ? (
        <div className="mt-6 border-t border-surface-border pt-4">
          <Link href={back} className="text-sm text-brand-purple hover:underline">
            ← Back
          </Link>
        </div>
      ) : null}
    </section>
  );
}
