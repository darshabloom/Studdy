import type { ReactNode } from 'react';
import { JourneyShell } from '@/components/journey/journey-shell';
import type { SummaryRow } from './booking-summary';
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

  return (
    <JourneyShell
      sections={bookingSections(visible, step, params)}
      title={title}
      description={description}
      summaryTitle="Your request so far"
      summaryCaption="Nothing is sent until you review it."
      backHref={previousHref(step, params, unaskedSteps(visible, skipped))}
    >
      {children}
    </JourneyShell>
  );
}
