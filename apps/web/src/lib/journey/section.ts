/**
 * One question in a multi-step journey, as its chrome needs to see it.
 *
 * Deliberately says nothing about booking, shortlists or steps: it is the
 * SHAPE the receipt and the accordion draw, and both journeys compute their own
 * sections — with their own ordering and their own hrefs — before handing them
 * over. That is what lets the optional multi-tutor journey look and behave like
 * `/book` without either one owning the other's rules.
 */

export type SectionState = 'complete' | 'current' | 'upcoming';

export interface JourneySection {
  /** Stable identity for React and for tests. */
  readonly key: string;
  readonly label: string;
  /** A single answer, already formatted. */
  readonly value: string | null;
  /**
   * An answer that is genuinely several things — the preferred times — listed
   * one per line rather than joined, because joining them reads as several
   * lessons being asked for rather than alternatives.
   */
  readonly values: readonly string[];
  /** A short qualifier under the value, e.g. 'Any one of these'. */
  readonly note: string | null;
  readonly state: SectionState;
  /**
   * Where reopening this section goes, or null when it does not open.
   *
   * Null for the section already open and for questions not yet reached. An
   * answered section behind the current one always reopens, however few options
   * its question had — a family reconsidering an answer with one option is
   * exactly who needs the way back.
   */
  readonly href: string | null;
}

export function sectionIsAnswered(section: JourneySection): boolean {
  return section.value !== null || section.values.length > 0;
}
