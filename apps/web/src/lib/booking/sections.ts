import {
  BOOKING_STEPS,
  bookingHref,
  paramsUpTo,
  type BookingParams,
  type BookingStep,
} from './draft';
import type { SummaryRow } from '@/components/booking/booking-summary';

/**
 * The booking journey seen as a set of sections rather than a set of pages.
 *
 * This is the model the mobile accordion draws and the Back link walks. It is
 * PURE and deliberately free of `server-only`, because the rules it encodes —
 * which section is open, which may be reopened, which question was never asked
 * — are exactly the ones worth testing without a database.
 *
 * Only one section is ever open: the open one is the route the family is on, so
 * "expanded" is a fact about the URL and needs no client state to track. Tapping
 * a completed section is an ordinary link, which is why the back button, deep
 * links and reload all keep working.
 */

export type SectionState = 'complete' | 'current' | 'upcoming';

export interface BookingSection {
  readonly step: BookingStep;
  readonly label: string;
  readonly value: string | null;
  /** Answered by the server because there was only ever one valid answer. */
  readonly settled: boolean;
  readonly state: SectionState;
  /**
   * Where tapping the section header goes, or null when it does not open.
   *
   * Null for the section already open, for questions not yet reached, and for
   * settled answers — following a settled one would land on a screen with a
   * single option already taken, which is not a change the parent can make.
   */
  readonly href: string | null;
}

export function bookingSections(
  rows: readonly SummaryRow[],
  current: BookingStep,
  params: BookingParams,
): readonly BookingSection[] {
  const currentIndex = rows.findIndex((row) => row.step === current);

  return rows.map((row, index) => {
    const answered = row.value !== null;
    const settled = row.settled === true;

    // Review is not one of these rows, so it reports no current index; from
    // there every answered section reads as complete.
    const state: SectionState =
      index === currentIndex
        ? 'current'
        : currentIndex === -1 || index < currentIndex
          ? 'complete'
          : 'upcoming';

    const canReopen = state === 'complete' && answered && !settled;

    return {
      step: row.step,
      label: row.label,
      value: row.value,
      settled,
      state,
      href: canReopen ? bookingHref(row.step, paramsUpTo(row.step, params)) : null,
    };
  });
}

/**
 * Steps this journey never puts to the family.
 *
 * A settled answer is one of them, and so is a step known in advance to be
 * unreachable — the length screen can already see that a tutor delivering every
 * one of their lessons a single way will never raise the format question.
 */
export function unaskedSteps(
  rows: readonly SummaryRow[],
  alwaysSkipped: readonly BookingStep[] = [],
): ReadonlySet<BookingStep> {
  const unasked = new Set<BookingStep>(alwaysSkipped);
  for (const row of rows) {
    if (row.settled === true) unasked.add(row.step);
  }
  return unasked;
}

/**
 * The previous question the family was actually asked, or null if this was the
 * first.
 *
 * Back has to land where the parent came from, not on a screen they were routed
 * past — and a settled first step means there is nowhere behind this at all,
 * rather than somewhere they may not go.
 */
export function previousAskedStep(
  step: BookingStep,
  unasked: ReadonlySet<BookingStep>,
): BookingStep | null {
  let index = BOOKING_STEPS.indexOf(step) - 1;
  while (index >= 0 && unasked.has(BOOKING_STEPS[index]!)) index -= 1;
  return index < 0 ? null : (BOOKING_STEPS[index] ?? null);
}

/** Where Back goes, carrying only the answers that step's question depends on. */
export function previousHref(
  step: BookingStep,
  params: BookingParams,
  unasked: ReadonlySet<BookingStep>,
): string | null {
  const target = previousAskedStep(step, unasked);
  return target === null ? null : bookingHref(target, paramsUpTo(target, params));
}
