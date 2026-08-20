import type { Interval } from './slots';

/**
 * Combining several tutors' bookable time into one grid.
 *
 * The family is choosing *times*, not per-tutor times: they pick a handful of
 * moments that suit the student, and each invited tutor is later offered the
 * subset of those they can actually do. So the unit here is a start instant,
 * and a tutor "can do" it when their own derived slots contain a slot starting
 * exactly then. Lesson length stays each tutor's own, which is why a tutor with
 * a different duration still matches on the same start.
 *
 * Only positive availability goes in and only positive availability comes out.
 * A tutor missing from an option's list is missing for no stated reason, which
 * is the same guarantee the single-tutor view gives.
 */

/** The family chooses between these many times (design §3.1 step 6). */
export const REQUEST_TIME_OPTIONS_MIN = 2;
export const REQUEST_TIME_OPTIONS_MAX = 5;

export interface TutorSlotSet {
  readonly tutorReference: string;
  readonly slots: readonly Interval[];
}

export interface CombinedSlot {
  readonly startAt: Date;
  /** Shortlisted tutors who can do this start, in the order given. */
  readonly tutorReferences: readonly string[];
}

/**
 * Every start instant any of the tutors can do, chronologically, each carrying
 * who can do it.
 *
 * Counting is scoped to the tutors passed in — the family's own shortlist —
 * so "2 of your 3 tutors" never becomes a statement about the platform.
 */
export function combineSlotsByStart(sets: readonly TutorSlotSet[]): readonly CombinedSlot[] {
  const byStart = new Map<number, { startAt: Date; tutorReferences: string[] }>();

  for (const set of sets) {
    for (const slot of set.slots) {
      const key = slot.startAt.getTime();
      const existing = byStart.get(key);
      if (existing === undefined) {
        byStart.set(key, { startAt: slot.startAt, tutorReferences: [set.tutorReference] });
      } else if (!existing.tutorReferences.includes(set.tutorReference)) {
        existing.tutorReferences.push(set.tutorReference);
      }
    }
  }

  return [...byStart.values()]
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
    .map((entry) => ({ startAt: entry.startAt, tutorReferences: entry.tutorReferences }));
}

/**
 * Whether a chosen set of times is a valid request.
 *
 * Enforced again server-side when the request is composed — this exists so the
 * grid can say what is wrong before the family submits, not so the browser can
 * be trusted.
 */
export function validateChosenTimes(count: number): string | null {
  if (count < REQUEST_TIME_OPTIONS_MIN) {
    return `Choose at least ${String(REQUEST_TIME_OPTIONS_MIN)} times so tutors have a choice.`;
  }
  if (count > REQUEST_TIME_OPTIONS_MAX) {
    return `Choose no more than ${String(REQUEST_TIME_OPTIONS_MAX)} times.`;
  }
  return null;
}
