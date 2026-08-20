import { describe, expect, it } from 'vitest';
import {
  REQUEST_TIME_OPTIONS_MAX,
  REQUEST_TIME_OPTIONS_MIN,
  combineSlotsByStart,
  validateChosenTimes,
} from './combine';

const at = (iso: string, minutes = 60): { startAt: Date; endAt: Date } => {
  const startAt = new Date(iso);
  return { startAt, endAt: new Date(startAt.getTime() + minutes * 60_000) };
};

describe('combining tutor availability', () => {
  it('lists every start any tutor can do, chronologically', () => {
    const combined = combineSlotsByStart([
      {
        tutorReference: 'TUTOR-1',
        slots: [at('2026-09-02T04:00:00Z'), at('2026-09-01T04:00:00Z')],
      },
      { tutorReference: 'TUTOR-2', slots: [at('2026-09-01T05:00:00Z')] },
    ]);

    expect(combined.map((slot) => slot.startAt.toISOString())).toEqual([
      '2026-09-01T04:00:00.000Z',
      '2026-09-01T05:00:00.000Z',
      '2026-09-02T04:00:00.000Z',
    ]);
  });

  it('records which tutors share a start', () => {
    const combined = combineSlotsByStart([
      { tutorReference: 'TUTOR-1', slots: [at('2026-09-01T04:00:00Z')] },
      { tutorReference: 'TUTOR-2', slots: [at('2026-09-01T04:00:00Z')] },
      { tutorReference: 'TUTOR-3', slots: [at('2026-09-01T05:00:00Z')] },
    ]);

    expect(combined[0]?.tutorReferences).toEqual(['TUTOR-1', 'TUTOR-2']);
    expect(combined[1]?.tutorReferences).toEqual(['TUTOR-3']);
  });

  it('matches on start even when tutors teach different lengths', () => {
    // A 45-minute tutor and a 60-minute tutor both start at 4pm. The family is
    // choosing a moment; each tutor keeps their own lesson length.
    const combined = combineSlotsByStart([
      { tutorReference: 'TUTOR-1', slots: [at('2026-09-01T04:00:00Z', 60)] },
      { tutorReference: 'TUTOR-2', slots: [at('2026-09-01T04:00:00Z', 45)] },
    ]);

    expect(combined).toHaveLength(1);
    expect(combined[0]?.tutorReferences).toEqual(['TUTOR-1', 'TUTOR-2']);
  });

  it('does not double-count a tutor listed twice for one start', () => {
    const combined = combineSlotsByStart([
      {
        tutorReference: 'TUTOR-1',
        slots: [at('2026-09-01T04:00:00Z'), at('2026-09-01T04:00:00Z')],
      },
    ]);
    expect(combined[0]?.tutorReferences).toEqual(['TUTOR-1']);
  });

  it('is empty when no tutor has any bookable time', () => {
    expect(combineSlotsByStart([{ tutorReference: 'TUTOR-1', slots: [] }])).toEqual([]);
  });

  it('holds the family to between two and five times', () => {
    expect(validateChosenTimes(REQUEST_TIME_OPTIONS_MIN)).toBeNull();
    expect(validateChosenTimes(REQUEST_TIME_OPTIONS_MAX)).toBeNull();
    expect(validateChosenTimes(REQUEST_TIME_OPTIONS_MIN - 1)).toMatch(/at least/);
    expect(validateChosenTimes(REQUEST_TIME_OPTIONS_MAX + 1)).toMatch(/no more than/);
  });
});
