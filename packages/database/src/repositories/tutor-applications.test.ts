import { describe, expect, it } from 'vitest';
import { EMPTY_TUTOR_APPLICATION } from '@studdy/domain/tutors';
import { coerceDraft } from './tutor-applications';

/**
 * The stored working copy, read back defensively.
 *
 * A draft is JSON the application wrote — but it is also the one column an older
 * version of the form may have written differently, so it is never trusted to be
 * complete or well-typed. Nothing here touches a database.
 */

describe('coerceDraft', () => {
  it('gives an empty application for anything that is not an object', () => {
    for (const value of [null, undefined, 'text', 42, true, [], ['a']]) {
      expect(coerceDraft(value)).toEqual(EMPTY_TUTOR_APPLICATION);
    }
  });

  it('keeps what is there and fills in what is not', () => {
    const draft = coerceDraft({ headline: 'Maths', yearLevelFrom: '7' });
    expect(draft.headline).toBe('Maths');
    expect(draft.yearLevelFrom).toBe('7');
    expect(draft.legalFirstName).toBe('');
    expect(draft.offersOnline).toBe(true);
    expect(draft.offersInPerson).toBe(false);
  });

  it('ignores fields of the wrong type rather than carrying them', () => {
    const draft = coerceDraft({ headline: 42, subjectIds: 'not-a-list', offersOnline: 'yes' });
    expect(draft.headline).toBe('');
    expect(draft.subjectIds).toEqual([]);
    expect(draft.offersOnline).toBe(true);
  });

  it('keeps only string subject ids', () => {
    expect(coerceDraft({ subjectIds: ['a', 7, null, 'b'] }).subjectIds).toEqual(['a', 'b']);
  });

  it('always offers at least two referee slots, and never more than three', () => {
    expect(coerceDraft({ references: [] }).references).toHaveLength(2);
    expect(
      coerceDraft({
        references: Array.from({ length: 6 }, (_, index) => ({
          fullName: `R${String(index)}`,
          email: '',
          relationship: '',
        })),
      }).references,
    ).toHaveLength(3);
  });

  it('reads a referee with missing fields as blanks', () => {
    const [first] = coerceDraft({ references: [{ fullName: 'Hemi' }, 'junk'] }).references;
    expect(first).toEqual({ fullName: 'Hemi', email: '', relationship: '' });
    expect(coerceDraft({ references: [{ fullName: 'Hemi' }, 'junk'] }).references[1]).toEqual({
      fullName: '',
      email: '',
      relationship: '',
    });
  });

  /** Acceptance of the declarations is given afresh at submission, never inherited. */
  it('never carries the declarations over from a draft', () => {
    expect(coerceDraft({ declarationsAccepted: true }).declarationsAccepted).toBe(false);
  });
});
