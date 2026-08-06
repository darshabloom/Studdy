import { describe, expect, it } from 'vitest';
import {
  SHORTLIST_MAX_TUTORS,
  isTutorOnShortlist,
  nextShortlistPosition,
  shortlistIsFull,
} from './shortlist';

const entry = (tutorProfileId: string, position: number) => ({ tutorProfileId, position });

describe('nextShortlistPosition', () => {
  it('fills positions 1..3 in order', () => {
    const empty = nextShortlistPosition([]);
    expect(empty.ok && empty.value).toBe(1);
    const one = nextShortlistPosition([entry('a', 1)]);
    expect(one.ok && one.value).toBe(2);
    const two = nextShortlistPosition([entry('a', 1), entry('b', 2)]);
    expect(two.ok && two.value).toBe(3);
  });

  it('reuses a freed slot rather than growing past the cap', () => {
    const result = nextShortlistPosition([entry('a', 1), entry('c', 3)]);
    expect(result.ok && result.value).toBe(2);
  });

  it('refuses a fourth tutor', () => {
    const result = nextShortlistPosition([entry('a', 1), entry('b', 2), entry('c', 3)]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PRECONDITION_FAILED');
  });

  it('caps at the approved fan-out limit of three', () => {
    expect(SHORTLIST_MAX_TUTORS).toBe(3);
  });
});

describe('shortlist helpers', () => {
  it('detects a tutor already on the shortlist', () => {
    expect(isTutorOnShortlist([entry('a', 1)], 'a')).toBe(true);
    expect(isTutorOnShortlist([entry('a', 1)], 'b')).toBe(false);
  });

  it('reports fullness', () => {
    expect(shortlistIsFull([entry('a', 1), entry('b', 2)])).toBe(false);
    expect(shortlistIsFull([entry('a', 1), entry('b', 2), entry('c', 3)])).toBe(true);
  });
});
