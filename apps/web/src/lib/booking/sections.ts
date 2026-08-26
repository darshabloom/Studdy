import {
  BOOKING_STEPS,
  bookingHref,
  paramsUpTo,
  type BookingParams,
  type BookingStep,
} from './draft';
import type { JourneySection, SectionState } from '@/lib/journey/section';
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

export type { SectionState };

/**
 * Answered at all, in either shape.
 *
 * Lives here rather than beside the component so that this module stays pure —
 * importing a runtime value from a `.tsx` would drag React into a unit test
 * that has no business rendering anything.
 */
export function rowIsAnswered(row: SummaryRow): boolean {
  return row.value !== null || (row.values !== undefined && row.values.length > 0);
}

/**
 * A journey section, plus the booking step it came from.
 *
 * Extending the shared shape rather than restating it: the chrome draws
 * `JourneySection`, and this journey's own logic keys on `step`.
 */
export interface BookingSection extends JourneySection {
  readonly step: BookingStep;
}

export function bookingSections(
  rows: readonly SummaryRow[],
  current: BookingStep,
  params: BookingParams,
): readonly BookingSection[] {
  const currentIndex = rows.findIndex((row) => row.step === current);

  return rows.map((row, index) => {
    const answered = rowIsAnswered(row);

    // Review is not one of these rows, so it reports no current index; from
    // there every answered section reads as complete.
    const state: SectionState =
      index === currentIndex
        ? 'current'
        : currentIndex === -1 || index < currentIndex
          ? 'complete'
          : 'upcoming';

    const canReopen = state === 'complete' && answered;

    return {
      // `key` is what the shared journey chrome identifies a section by; `step`
      // stays because the booking journey's own logic is keyed on it.
      key: row.step,
      step: row.step,
      label: row.label,
      value: row.value,
      values: row.values ?? [],
      note: row.note ?? null,
      state,
      href: canReopen ? bookingHref(row.step, paramsUpTo(row.step, params)) : null,
    };
  });
}

/**
 * Steps this journey never puts to the family.
 *
 * Nothing is inferred here any more: a question with one option is still asked,
 * so the only unasked steps are the ones a caller states outright. The set is
 * kept because Back still has to skip whatever those are.
 */
export function unaskedSteps(
  _rows: readonly SummaryRow[],
  alwaysSkipped: readonly BookingStep[] = [],
): ReadonlySet<BookingStep> {
  return new Set<BookingStep>(alwaysSkipped);
}

/**
 * The previous question the family was actually asked, or null if this was the
 * first.
 *
 * Back has to land where the parent came from, not on a screen they were routed
 * past. With nothing skipped this is simply the previous step; the walk stays
 * because a caller may still declare a step unasked, and because landing on a
 * screen the journey never showed is a confusing way to go backwards.
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
