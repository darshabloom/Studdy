import { domainError } from '../core/errors';
import { fail, ok, type CommandResult } from '../core/result';

/**
 * Shortlist rules. A shortlist is the set of candidate tutors saved against
 * one Student Subject Section. It is NOT a request: no Intended Lesson
 * Request, Tutor Request, calendar hold or booking exists at this stage.
 *
 * The cap matches the approved Tutor Request fan-out limit, so a saved
 * shortlist maps one-to-one onto the future request slice.
 */
export const SHORTLIST_MAX_TUTORS = 3;

export interface ShortlistEntrySummary {
  readonly tutorProfileId: string;
  readonly position: number;
}

/**
 * Choose the position for a new entry: the lowest free slot in 1..3.
 *
 * This is an optimistic suggestion only — the database holds the real
 * guarantee via CHECK (position between 1 and 3) plus a partial unique index
 * on (section, position) WHERE active. Two concurrent callers can compute the
 * same free slot; the second insert then fails with a unique violation, which
 * the repository maps to RESOURCE_CONFLICT. No lock is taken here.
 */
export function nextShortlistPosition(
  existing: readonly ShortlistEntrySummary[],
): CommandResult<number> {
  if (existing.length >= SHORTLIST_MAX_TUTORS) {
    return fail(
      domainError(
        'PRECONDITION_FAILED',
        `A shortlist holds at most ${SHORTLIST_MAX_TUTORS} tutors.`,
        { max: SHORTLIST_MAX_TUTORS },
      ),
    );
  }
  const taken = new Set(existing.map((entry) => entry.position));
  for (let position = 1; position <= SHORTLIST_MAX_TUTORS; position += 1) {
    if (!taken.has(position)) return ok(position);
  }
  return fail(
    domainError('PRECONDITION_FAILED', `A shortlist holds at most ${SHORTLIST_MAX_TUTORS} tutors.`),
  );
}

export function isTutorOnShortlist(
  existing: readonly ShortlistEntrySummary[],
  tutorProfileId: string,
): boolean {
  return existing.some((entry) => entry.tutorProfileId === tutorProfileId);
}

export function shortlistIsFull(existing: readonly ShortlistEntrySummary[]): boolean {
  return existing.length >= SHORTLIST_MAX_TUTORS;
}
