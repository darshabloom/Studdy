import { describe, expect, it } from 'vitest';
import {
  bookableSlots,
  mergeIntervals,
  projectRule,
  subtractIntervals,
  zonedTimeToUtc,
  type Interval,
  type RecurringRule,
} from './slots';

const NZ = 'Pacific/Auckland';

function iso(value: string): Date {
  return new Date(value);
}

function show(intervals: readonly Interval[]): string[] {
  return intervals.map((i) => `${i.startAt.toISOString()}→${i.endAt.toISOString()}`);
}

/** A Tuesday 16:00–18:00 NZ rule, open-ended. */
function tuesdayRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    dayOfWeek: 2,
    localStartTime: '16:00',
    localEndTime: '18:00',
    ianaTimeZone: NZ,
    effectiveFrom: '2026-01-01',
    effectiveUntil: null,
    minimumNoticeMinutes: null,
    maximumAdvanceBookingDays: null,
    ...overrides,
  };
}

const BASE = {
  defaultMinimumNoticeMinutes: 120,
  defaultMaximumAdvanceBookingDays: 60,
  durationMinutes: 60,
};

describe('zonedTimeToUtc', () => {
  it('converts NZ standard time (UTC+12)', () => {
    expect(zonedTimeToUtc('2026-08-11', '16:00', NZ).toISOString()).toBe(
      '2026-08-11T04:00:00.000Z',
    );
  });

  it('converts NZ daylight time (UTC+13)', () => {
    expect(zonedTimeToUtc('2026-01-13', '16:00', NZ).toISOString()).toBe(
      '2026-01-13T03:00:00.000Z',
    );
  });

  it('keeps the same local wall-clock time either side of a DST change', () => {
    // NZ moves to daylight time in late September. The same local 16:00 must
    // map to different UTC instants, an hour apart.
    const before = zonedTimeToUtc('2026-09-22', '16:00', NZ);
    const after = zonedTimeToUtc('2026-09-29', '16:00', NZ);
    const diffHours = (after.getTime() - before.getTime()) / 3_600_000;
    // Seven days apart, minus the hour gained.
    expect(diffHours).toBe(7 * 24 - 1);
  });

  it('handles a UTC-offset zone', () => {
    expect(zonedTimeToUtc('2026-08-11', '09:00', 'UTC').toISOString()).toBe(
      '2026-08-11T09:00:00.000Z',
    );
  });
});

describe('subtractIntervals', () => {
  it('splits an interval when a cut lands inside it', () => {
    const result = subtractIntervals(
      [{ startAt: iso('2026-08-11T04:00:00Z'), endAt: iso('2026-08-11T08:00:00Z') }],
      [{ startAt: iso('2026-08-11T05:00:00Z'), endAt: iso('2026-08-11T06:00:00Z') }],
    );
    expect(show(result)).toEqual([
      '2026-08-11T04:00:00.000Z→2026-08-11T05:00:00.000Z',
      '2026-08-11T06:00:00.000Z→2026-08-11T08:00:00.000Z',
    ]);
  });

  it('removes an interval entirely when the cut covers it', () => {
    const result = subtractIntervals(
      [{ startAt: iso('2026-08-11T04:00:00Z'), endAt: iso('2026-08-11T05:00:00Z') }],
      [{ startAt: iso('2026-08-11T00:00:00Z'), endAt: iso('2026-08-12T00:00:00Z') }],
    );
    expect(result).toEqual([]);
  });

  it('leaves an interval untouched when the cut merely touches its edge', () => {
    // Half-open [start, end): a cut beginning exactly at the end does not overlap.
    const result = subtractIntervals(
      [{ startAt: iso('2026-08-11T04:00:00Z'), endAt: iso('2026-08-11T05:00:00Z') }],
      [{ startAt: iso('2026-08-11T05:00:00Z'), endAt: iso('2026-08-11T06:00:00Z') }],
    );
    expect(show(result)).toEqual(['2026-08-11T04:00:00.000Z→2026-08-11T05:00:00.000Z']);
  });
});

describe('mergeIntervals', () => {
  it('merges overlapping and touching intervals', () => {
    const result = mergeIntervals([
      { startAt: iso('2026-08-11T04:00:00Z'), endAt: iso('2026-08-11T05:00:00Z') },
      { startAt: iso('2026-08-11T05:00:00Z'), endAt: iso('2026-08-11T06:00:00Z') },
      { startAt: iso('2026-08-11T05:30:00Z'), endAt: iso('2026-08-11T07:00:00Z') },
    ]);
    expect(show(result)).toEqual(['2026-08-11T04:00:00.000Z→2026-08-11T07:00:00.000Z']);
  });
});

describe('projectRule', () => {
  it('projects only the matching weekday inside the window', () => {
    const result = projectRule(tuesdayRule(), {
      startAt: iso('2026-08-09T00:00:00Z'),
      endAt: iso('2026-08-23T00:00:00Z'),
    });
    // 11 and 18 August 2026 are Tuesdays in NZ.
    expect(show(result)).toEqual([
      '2026-08-11T04:00:00.000Z→2026-08-11T06:00:00.000Z',
      '2026-08-18T04:00:00.000Z→2026-08-18T06:00:00.000Z',
    ]);
  });

  it('respects effective_from and effective_until', () => {
    const result = projectRule(
      tuesdayRule({ effectiveFrom: '2026-08-12', effectiveUntil: '2026-08-18' }),
      { startAt: iso('2026-08-09T00:00:00Z'), endAt: iso('2026-08-30T00:00:00Z') },
    );
    expect(show(result)).toEqual(['2026-08-18T04:00:00.000Z→2026-08-18T06:00:00.000Z']);
  });
});

describe('bookableSlots — the layered calculation', () => {
  const now = iso('2026-08-10T00:00:00Z');
  const window = { startAt: iso('2026-08-10T00:00:00Z'), endAt: iso('2026-08-13T00:00:00Z') };

  it('cuts a recurring period into slots of the requested duration', () => {
    const slots = bookableSlots({
      ...BASE,
      rules: [tuesdayRule()],
      exceptions: [],
      reservations: [],
      window,
      now,
    });
    // 04:00–06:00 UTC, 60-minute slots on a 30-minute grid.
    expect(show(slots)).toEqual([
      '2026-08-11T04:00:00.000Z→2026-08-11T05:00:00.000Z',
      '2026-08-11T04:30:00.000Z→2026-08-11T05:30:00.000Z',
      '2026-08-11T05:00:00.000Z→2026-08-11T06:00:00.000Z',
    ]);
  });

  it('subtracts an active reservation, and offers what survives', () => {
    const slots = bookableSlots({
      ...BASE,
      rules: [tuesdayRule()],
      exceptions: [],
      reservations: [{ startAt: iso('2026-08-11T04:30:00Z'), endAt: iso('2026-08-11T05:30:00Z') }],
      window,
      now,
    });
    expect(show(slots)).toEqual([]);
  });

  it('subtracts blocked time', () => {
    const slots = bookableSlots({
      ...BASE,
      rules: [tuesdayRule()],
      exceptions: [
        {
          startAt: iso('2026-08-11T05:00:00Z'),
          endAt: iso('2026-08-11T06:00:00Z'),
          effectCode: 'removes',
        },
      ],
      reservations: [],
      window,
      now,
    });
    expect(show(slots)).toEqual(['2026-08-11T04:00:00.000Z→2026-08-11T05:00:00.000Z']);
  });

  it('adds a one-off extra period outside any recurring rule', () => {
    const slots = bookableSlots({
      ...BASE,
      rules: [],
      exceptions: [
        {
          startAt: iso('2026-08-12T02:00:00Z'),
          endAt: iso('2026-08-12T03:00:00Z'),
          effectCode: 'adds',
        },
      ],
      reservations: [],
      window,
      now,
    });
    expect(show(slots)).toEqual(['2026-08-12T02:00:00.000Z→2026-08-12T03:00:00.000Z']);
  });

  it('lets a removal beat an overlapping addition', () => {
    // Resolution order matters: a tutor who blocks a period expects the block
    // to win, whatever else says the time is free.
    const slots = bookableSlots({
      ...BASE,
      rules: [],
      exceptions: [
        {
          startAt: iso('2026-08-12T02:00:00Z'),
          endAt: iso('2026-08-12T04:00:00Z'),
          effectCode: 'adds',
        },
        {
          startAt: iso('2026-08-12T02:00:00Z'),
          endAt: iso('2026-08-12T04:00:00Z'),
          effectCode: 'removes',
        },
      ],
      reservations: [],
      window,
      now,
    });
    expect(slots).toEqual([]);
  });

  it('enforces minimum notice', () => {
    // The lesson is inside the window but too soon.
    const slots = bookableSlots({
      ...BASE,
      rules: [],
      exceptions: [
        {
          startAt: iso('2026-08-10T00:30:00Z'),
          endAt: iso('2026-08-10T02:00:00Z'),
          effectCode: 'adds',
        },
      ],
      reservations: [],
      window,
      now,
      defaultMinimumNoticeMinutes: 120,
    });
    expect(slots).toEqual([]);
  });

  it('enforces maximum advance booking', () => {
    const slots = bookableSlots({
      ...BASE,
      rules: [tuesdayRule({ maximumAdvanceBookingDays: 1 })],
      exceptions: [],
      reservations: [],
      window,
      now,
    });
    // The Tuesday period is more than one day out.
    expect(slots).toEqual([]);
  });

  it('takes the strictest notice across contributing rules', () => {
    const slots = bookableSlots({
      ...BASE,
      rules: [
        tuesdayRule({ minimumNoticeMinutes: 60 }),
        tuesdayRule({ minimumNoticeMinutes: 10_000 }),
      ],
      exceptions: [],
      reservations: [],
      window,
      now,
    });
    // Offering a slot one rule would refuse would offer what the tutor did not agree to.
    expect(slots).toEqual([]);
  });

  it('returns nothing when the tutor has no availability at all', () => {
    const slots = bookableSlots({
      ...BASE,
      rules: [],
      exceptions: [],
      reservations: [],
      window,
      now,
    });
    expect(slots).toEqual([]);
  });

  it('keeps the local lesson hour across a daylight-saving change', () => {
    // A 16:00 NZ rule must still produce 16:00 NZ slots after the clocks move,
    // even though the UTC instant shifts by an hour.
    const septemberNow = iso('2026-09-20T00:00:00Z');
    const slots = bookableSlots({
      ...BASE,
      rules: [tuesdayRule()],
      exceptions: [],
      reservations: [],
      window: { startAt: iso('2026-09-20T00:00:00Z'), endAt: iso('2026-10-08T00:00:00Z') },
      now: septemberNow,
      durationMinutes: 120,
    });
    const localHours = slots.map((slot) =>
      new Intl.DateTimeFormat('en-NZ', {
        timeZone: NZ,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(slot.startAt),
    );
    expect(new Set(localHours)).toEqual(new Set(['16:00']));
    expect(slots.length).toBeGreaterThan(1);
  });

  it('refuses a window longer than the projection limit', () => {
    expect(() =>
      bookableSlots({
        ...BASE,
        rules: [],
        exceptions: [],
        reservations: [],
        window: { startAt: iso('2026-01-01T00:00:00Z'), endAt: iso('2026-12-31T00:00:00Z') },
        now: iso('2026-01-01T00:00:00Z'),
      }),
    ).toThrow(/may not exceed/);
  });

  it('returns positive slots only — never a gap, reason or block', () => {
    // The output shape IS the privacy boundary. Every returned object carries
    // exactly two instants and nothing else, so a caller cannot leak a reason
    // it never received.
    const slots = bookableSlots({
      ...BASE,
      rules: [tuesdayRule()],
      exceptions: [
        {
          startAt: iso('2026-08-11T05:00:00Z'),
          endAt: iso('2026-08-11T06:00:00Z'),
          effectCode: 'removes',
        },
      ],
      reservations: [],
      window,
      now,
    });
    for (const slot of slots) {
      expect(Object.keys(slot).sort()).toEqual(['endAt', 'startAt']);
    }
  });
});
