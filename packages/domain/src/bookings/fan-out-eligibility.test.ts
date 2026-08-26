import { describe, expect, it } from 'vitest';
import {
  durationChoices,
  exclusionLabel,
  formatChoices,
  resolveFanOutEligibility,
  type EligibilityCandidate,
} from './fan-out-eligibility';

/**
 * One request means one lesson, and nobody vanishes from it quietly.
 *
 * These are the two rules the multi-tutor journey exists to keep, so they are
 * pinned here rather than left to whatever the seeded tutors happen to publish.
 */

function tutor(
  firstName: string,
  versions: readonly { id: string; minutes: number; formats: ('online' | 'in_person')[] }[],
): EligibilityCandidate {
  return {
    tutorReference: `tut_${firstName.toLowerCase()}`,
    tutorProfileId: `profile-${firstName.toLowerCase()}`,
    firstName,
    versions: versions.map((version) => ({
      serviceVersionId: version.id,
      durationMinutes: version.minutes,
      formats: version.formats,
    })),
  };
}

const AROHA = tutor('Aroha', [
  { id: 'aroha-60', minutes: 60, formats: ['online'] },
  { id: 'aroha-90', minutes: 90, formats: ['online', 'in_person'] },
]);
const MEI = tutor('Mei', [{ id: 'mei-60', minutes: 60, formats: ['online'] }]);
const JAMES = tutor('James', [{ id: 'james-90', minutes: 90, formats: ['in_person'] }]);
const GONE = tutor('Gone', []);

describe('durationChoices', () => {
  it('offers every published length, with how much of the shortlist it reaches', () => {
    expect(durationChoices([AROHA, MEI, JAMES])).toEqual([
      { durationMinutes: 60, tutorCount: 2, ofTutors: 3 },
      { durationMinutes: 90, tutorCount: 2, ofTutors: 3 },
    ]);
  });

  it('counts a tutor once even where they publish the same length twice', () => {
    const twice = tutor('Twice', [
      { id: 'a', minutes: 60, formats: ['online'] },
      { id: 'b', minutes: 60, formats: ['in_person'] },
    ]);
    expect(durationChoices([twice])).toEqual([{ durationMinutes: 60, tutorCount: 1, ofTutors: 1 }]);
  });

  /** The denominator is tutors who still offer the subject, not the raw list. */
  it('leaves a tutor who no longer offers the subject out of the count', () => {
    expect(durationChoices([MEI, GONE])).toEqual([
      { durationMinutes: 60, tutorCount: 1, ofTutors: 1 },
    ]);
  });

  it('offers nothing when nobody publishes anything', () => {
    expect(durationChoices([GONE])).toEqual([]);
  });
});

describe('formatChoices', () => {
  it('offers only formats a tutor at that duration can actually deliver', () => {
    // At 60 minutes only Aroha and Mei qualify, and both teach online only.
    expect(formatChoices([AROHA, MEI, JAMES], 60)).toEqual([
      { format: 'online', tutorCount: 2, ofTutors: 2 },
    ]);
  });

  /**
   * A tutor whose version is unrestricted counts towards BOTH formats — Aroha's
   * 90 is either way, so she is reachable online and in person, while James is
   * in person only.
   */
  it('offers both where the remaining tutors between them do both', () => {
    expect(formatChoices([AROHA, JAMES], 90)).toEqual([
      { format: 'online', tutorCount: 1, ofTutors: 2 },
      { format: 'in_person', tutorCount: 2, ofTutors: 2 },
    ]);
  });

  it('offers nothing at a duration nobody publishes', () => {
    expect(formatChoices([AROHA, MEI], 30)).toEqual([]);
  });
});

describe('resolveFanOutEligibility', () => {
  it('includes every tutor who can take the lesson as chosen', () => {
    const { included } = resolveFanOutEligibility([AROHA, MEI], 60, 'online');

    expect(included.map((entry) => entry.firstName)).toEqual(['Aroha', 'Mei']);
    // Every included tutor is pinned to a version of the CHOSEN duration, which
    // is what makes one start mean one interval for all of them.
    expect(included.every((entry) => entry.durationMinutes === 60)).toBe(true);
  });

  it('excludes a tutor who does not publish that length, and says so', () => {
    const { included, excluded } = resolveFanOutEligibility([AROHA, JAMES], 60, 'online');

    expect(included.map((entry) => entry.firstName)).toEqual(['Aroha']);
    expect(excluded).toEqual([
      { tutorReference: 'tut_james', firstName: 'James', reason: 'duration' },
    ]);
  });

  it('excludes a tutor who cannot deliver that format, and says so', () => {
    // At 90 minutes James is in person only, so an online request leaves him out.
    const { included, excluded } = resolveFanOutEligibility([AROHA, JAMES], 90, 'online');

    expect(included.map((entry) => entry.firstName)).toEqual(['Aroha']);
    expect(excluded).toEqual([
      { tutorReference: 'tut_james', firstName: 'James', reason: 'format' },
    ]);
  });

  /**
   * THE RULE THAT MATTERS. A shortlisted tutor is always accounted for: the
   * family put them there deliberately, and a tutor silently missing from a
   * request is indistinguishable from one who declined it.
   */
  it('accounts for every shortlisted tutor, either included or explained', () => {
    const shortlist = [AROHA, MEI, JAMES, GONE];
    const { included, excluded } = resolveFanOutEligibility(shortlist, 60, 'online');

    expect(included.length + excluded.length).toBe(shortlist.length);
  });

  it('reports the reason the family can act on, in the order they chose', () => {
    // Gone fails on subject, which is reported ahead of duration or format —
    // being told "doesn't teach it in person" is useless if they no longer
    // teach it at all.
    const { excluded } = resolveFanOutEligibility([GONE], 60, 'in_person');
    expect(excluded[0]?.reason).toBe('subject');
  });

  it('takes the cheapest version where several match', () => {
    const twoPrices = tutor('Two', [
      { id: 'dear', minutes: 60, formats: ['online'] },
      { id: 'cheap', minutes: 60, formats: ['online'] },
    ]);
    const price = (version: { serviceVersionId: string }): number =>
      version.serviceVersionId === 'cheap' ? 3000 : 9000;

    const { included } = resolveFanOutEligibility([twoPrices], 60, 'online', price);
    expect(included[0]?.serviceVersionId).toBe('cheap');
  });

  it('can exclude everyone, and says nothing about why that is', () => {
    const { included, excluded } = resolveFanOutEligibility([MEI], 90, 'online');
    expect(included).toEqual([]);
    expect(excluded).toHaveLength(1);
  });
});

describe('exclusionLabel', () => {
  it('describes the lesson, never the tutor', () => {
    expect(exclusionLabel('duration', 60, 'online', 'Mathematics')).toBe(
      "Doesn't offer 60-minute Mathematics lessons",
    );
    expect(exclusionLabel('format', 60, 'in_person', 'Mathematics')).toBe(
      "Doesn't teach this lesson in person",
    );
    expect(exclusionLabel('subject', 60, 'online', 'Mathematics')).toBe(
      'No longer offers Mathematics',
    );
  });
});
