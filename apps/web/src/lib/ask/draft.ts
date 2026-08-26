import type { LessonFormat } from '@studdy/domain/availability';

/**
 * The optional multi-tutor journey, kept in the URL exactly as `/book` is.
 *
 * Same model, different questions. There is no draft row and no session blob:
 * opening this journey cannot change anything, and every answer is re-checked
 * on every request because every parameter is attacker-controlled.
 *
 * The order matters and is not arbitrary. Duration and format come BEFORE
 * times, because they decide which shortlisted tutors the request can reach —
 * and therefore whose availability the times are drawn from. Asking for times
 * first would mean redrawing them the moment either changed.
 */

export const ASK_STEPS = ['length', 'format', 'times', 'review'] as const;
export type AskStep = (typeof ASK_STEPS)[number];

export interface AskParams {
  readonly duration: number | null;
  readonly format: LessonFormat | null;
  /** Chosen starts as ISO strings, in the order the URL carried them. */
  readonly times: readonly string[];
  /** Which page of the availability horizon the times step is showing. */
  readonly week: number;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function manyValues(value: string | string[] | undefined): readonly string[] {
  if (Array.isArray(value)) return value;
  return value === undefined ? [] : [value];
}

export function parseAskParams(raw: RawSearchParams): AskParams {
  const duration = firstValue(raw['duration']);
  /**
   * Whole minutes only, matched STRICTLY rather than parsed.
   *
   * `Number.parseInt('12.5', 10)` is 12, and `parseInt('60abc')` is 60 — so a
   * parse quietly turns something that is not a lesson length into one that
   * looks perfectly ordinary by the time anything downstream sees it. A
   * duration decides a price; nonsense is dropped, never rounded into an
   * answer the family did not give.
   */
  const parsed =
    duration !== null && /^\d+$/.test(duration) ? Number.parseInt(duration, 10) : Number.NaN;
  const format = firstValue(raw['format']);
  const week = Number(firstValue(raw['week']) ?? '1');

  return {
    duration: Number.isInteger(parsed) && parsed > 0 ? parsed : null,
    format: format === 'online' || format === 'in_person' ? format : null,
    times: manyValues(raw['time']),
    // Not an answer, so it is not cleared and not carried backwards: it says
    // which seven days the calendar is drawing. `availabilityView` clamps it
    // into the published horizon, so junk lands on the first week.
    week: Number.isFinite(week) ? Math.trunc(week) : 1,
  };
}

export function askHref(
  subjectSectionId: string,
  step: AskStep,
  params: Partial<AskParams>,
): string {
  const search = new URLSearchParams();
  if (params.duration != null) search.set('duration', String(params.duration));
  if (params.format != null) search.set('format', params.format);
  for (const time of params.times ?? []) search.append('time', time);
  if (params.week != null && params.week > 1) search.set('week', String(params.week));

  const query = search.toString();
  return `/shortlist/${subjectSectionId}/ask/${step}${query === '' ? '' : `?${query}`}`;
}

/**
 * The answers a step's own question depends on, and nothing after it.
 *
 * Going back to the length question cannot keep the times, because those times
 * were drawn for a different lesson — and cannot keep the format either, since
 * which formats are on offer depends on who is still eligible at the new
 * length. Dropping them is the honest thing: they were answers to a question
 * that is being asked again.
 */
export function askParamsUpTo(step: AskStep, params: AskParams): Partial<AskParams> {
  const index = ASK_STEPS.indexOf(step);
  return {
    duration: index >= ASK_STEPS.indexOf('length') ? params.duration : null,
    format: index >= ASK_STEPS.indexOf('format') ? params.format : null,
    times: index >= ASK_STEPS.indexOf('times') ? params.times : [],
    // Deliberately absent, so going back to a question lands on the first week
    // rather than on whichever page the family happened to leave the calendar.
  };
}

export function askStepIsReachable(step: AskStep, nextStep: AskStep): boolean {
  return ASK_STEPS.indexOf(step) <= ASK_STEPS.indexOf(nextStep);
}
