import { ASK_STEPS, askHref, askParamsUpTo, type AskParams, type AskStep } from './draft';
import type { JourneySection, SectionState } from '@/lib/journey/section';

/**
 * The optional multi-tutor journey as the shared chrome draws it.
 *
 * Pure, and mirroring `lib/booking/sections.ts` deliberately: the two journeys
 * ask different questions in a different order, but a family should not feel
 * they have changed product on the way between them.
 */

export interface AskRow {
  readonly step: AskStep;
  readonly label: string;
  readonly value: string | null;
  readonly values?: readonly string[] | undefined;
  readonly note?: string | undefined;
}

/**
 * `current` is null on the review screen, where nothing is being asked.
 *
 * Review renders the finished summary as its own content, so no section may
 * claim to be open — a section marked current would keep the persistent panel
 * on screen and put the same answers up twice, side by side, which reads less
 * like a reminder than like two things that might disagree.
 */
export function askSections(
  rows: readonly AskRow[],
  current: AskStep | null,
  subjectSectionId: string,
  params: AskParams,
): readonly JourneySection[] {
  const currentIndex = current === null ? -1 : rows.findIndex((row) => row.step === current);

  return rows.map((row, index) => {
    const answered = row.value !== null || (row.values ?? []).length > 0;

    // Review is not one of these rows, so it reports no current index; from
    // there every answered section reads as complete.
    const state: SectionState =
      index === currentIndex
        ? 'current'
        : currentIndex === -1 || index < currentIndex
          ? 'complete'
          : 'upcoming';

    return {
      key: row.step,
      label: row.label,
      value: row.value,
      values: row.values ?? [],
      note: row.note ?? null,
      state,
      /**
       * "Tutors being asked" is a CONSEQUENCE, not a question.
       *
       * It has no screen of its own to reopen — who receives the request falls
       * out of the length and the format — so offering a Change on it would
       * link to the review screen the family is already reading. The way to a
       * different set of tutors is to change one of the answers above it, which
       * is what the exclusion note says.
       */
      href:
        state === 'complete' && answered && row.step !== 'review'
          ? askHref(subjectSectionId, row.step, askParamsUpTo(row.step, params))
          : null,
    };
  });
}

/**
 * Where Back goes, or null from the first question.
 *
 * The first question's Back is the shortlist itself rather than nothing, but
 * that is the caller's business: this only answers "was there an earlier
 * question in this journey?".
 */
export function previousAskStep(step: AskStep): AskStep | null {
  const index = ASK_STEPS.indexOf(step) - 1;
  return index < 0 ? null : (ASK_STEPS[index] ?? null);
}

export function previousAskHref(
  subjectSectionId: string,
  step: AskStep,
  params: AskParams,
): string | null {
  const target = previousAskStep(step);
  return target === null ? null : askHref(subjectSectionId, target, askParamsUpTo(target, params));
}
