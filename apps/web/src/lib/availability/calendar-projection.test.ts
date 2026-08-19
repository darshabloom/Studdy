import { describe, expect, it } from 'vitest';
import {
  assertFamilySafe,
  MINUTES_IN_DAY as DESIGN_SYSTEM_MINUTES_IN_DAY,
} from '@studdy/design-system';
import { familyPreviewBlocks, tutorWeekBlocks } from './calendar-projection';
import {
  MINUTES_IN_DAY,
  calendarDayIndex,
  clockToMinutes,
  minutesToClock,
  minutesWithinDay,
  mondayOf,
  shiftDate,
  splitDateTime,
  storedDayOfWeek,
  weekDays,
  type WeekDay,
} from './calendar-time';
import type {
  AvailabilityExceptionRecord,
  AvailabilityRuleRecord,
  TutorReservationRecord,
} from '@studdy/database';

const ZONE = 'Pacific/Auckland';

/** Mon 21 Sep 2026 — the week New Zealand daylight saving starts, on Sun 27 Sep. */
const DST_WEEK = '2026-09-21';
/** An ordinary week, well away from any transition. */
const PLAIN_WEEK = '2026-08-17';

function rule(overrides: Partial<AvailabilityRuleRecord> = {}): AvailabilityRuleRecord {
  return {
    id: 'rule-1',
    dayOfWeek: 2,
    localStartTime: '16:00:00',
    localEndTime: '18:00:00',
    ianaTimeZone: ZONE,
    effectiveFrom: '2026-01-01',
    effectiveUntil: null,
    lessonFormatCode: 'any',
    minimumNoticeMinutes: null,
    maximumAdvanceBookingDays: null,
    ...overrides,
  };
}

function exception(
  overrides: Partial<AvailabilityExceptionRecord> = {},
): AvailabilityExceptionRecord {
  return {
    id: 'exception-1',
    startsAt: new Date('2026-08-18T02:00:00Z'),
    endsAt: new Date('2026-08-18T04:00:00Z'),
    effectCode: 'removes',
    reasonCode: 'personal',
    privateNote: 'Dentist',
    ...overrides,
  };
}

describe('weekday conversion', () => {
  it('maps the stored Sunday-first day onto the Monday-first calendar column', () => {
    expect(calendarDayIndex(1)).toBe(0); // Monday is the first column
    expect(calendarDayIndex(2)).toBe(1);
    expect(calendarDayIndex(6)).toBe(5); // Saturday
    expect(calendarDayIndex(0)).toBe(6); // Sunday is last, not first
  });

  it('round-trips back to the stored value', () => {
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
      expect(storedDayOfWeek(calendarDayIndex(dayOfWeek))).toBe(dayOfWeek);
    }
  });
});

describe('week construction', () => {
  it('builds seven consecutive days beginning on the Monday', () => {
    const days = weekDays(PLAIN_WEEK, ZONE);
    expect(days).toHaveLength(7);
    expect(days[0]?.date).toBe('2026-08-17');
    expect(days[6]?.date).toBe('2026-08-23');
    expect(days[0]?.label).toContain('Mon');
    expect(days[6]?.label).toContain('Sun');
  });

  it('finds the Monday on or before an instant, and is idempotent on a Monday', () => {
    // Wed 19 Aug 2026, mid-morning in Auckland.
    expect(mondayOf(new Date('2026-08-18T22:00:00Z'), ZONE)).toBe('2026-08-17');
    expect(mondayOf(new Date('2026-08-16T22:00:00Z'), ZONE)).toBe('2026-08-17');
  });

  it('shifts plain dates across a month boundary', () => {
    expect(shiftDate('2026-08-31', 1)).toBe('2026-09-01');
    expect(shiftDate('2026-09-01', -1)).toBe('2026-08-31');
  });

  it('gives the daylight-saving day a short day rather than a full 24 hours', () => {
    const days = weekDays(DST_WEEK, ZONE);
    const sunday = days[6];
    expect(sunday?.date).toBe('2026-09-27');
    const hours = ((sunday?.endAt.getTime() ?? 0) - (sunday?.startAt.getTime() ?? 0)) / 3_600_000;
    expect(hours).toBe(23);
  });
});

describe('clock helpers', () => {
  it('reads both HH:mm and the stored HH:mm:ss', () => {
    expect(clockToMinutes('16:30')).toBe(990);
    expect(clockToMinutes('16:30:00')).toBe(990);
  });

  it('formats minutes back for storage', () => {
    expect(minutesToClock(990)).toBe('16:30');
    expect(minutesToClock(0)).toBe('00:00');
    expect(minutesToClock(24 * 60)).toBe('24:00');
  });

  /**
   * The day length is defined in two places — here and in the design system's
   * geometry — because a `'use server'` module must not pull the component
   * library into its graph. This keeps the copies honest.
   */
  it('agrees with the design system about how long a day is', () => {
    expect(MINUTES_IN_DAY).toBe(DESIGN_SYSTEM_MINUTES_IN_DAY);
  });

  it('rolls a block ending at midnight over to the next day rather than storing 24:00', () => {
    expect(splitDateTime('2026-08-18', 990)).toEqual({ date: '2026-08-18', time: '16:30' });
    expect(splitDateTime('2026-08-18', 24 * 60)).toEqual({ date: '2026-08-19', time: '00:00' });
  });
});

describe('minutesWithinDay', () => {
  const days = weekDays(PLAIN_WEEK, ZONE);

  it('positions an interval by its wall clock', () => {
    const tuesday = days[1] as WeekDay;
    // 16:00–18:00 Auckland on Tue 18 Aug 2026 (NZST, UTC+12).
    const span = minutesWithinDay(
      { startAt: new Date('2026-08-18T04:00:00Z'), endAt: new Date('2026-08-18T06:00:00Z') },
      tuesday,
      ZONE,
    );
    expect(span).toEqual({ startMinutes: 16 * 60, endMinutes: 18 * 60 });
  });

  it('returns null for an interval that misses the day', () => {
    const monday = days[0] as WeekDay;
    expect(
      minutesWithinDay(
        { startAt: new Date('2026-08-25T04:00:00Z'), endAt: new Date('2026-08-25T06:00:00Z') },
        monday,
        ZONE,
      ),
    ).toBeNull();
  });

  it('clips a multi-day interval to midnight at each edge', () => {
    const tuesday = days[1] as WeekDay;
    const span = minutesWithinDay(
      { startAt: new Date('2026-08-17T04:00:00Z'), endAt: new Date('2026-08-19T04:00:00Z') },
      tuesday,
      ZONE,
    );
    expect(span).toEqual({ startMinutes: 0, endMinutes: 24 * 60 });
  });

  /**
   * The reason the projection reads the clock instead of counting elapsed
   * minutes. On 27 Sep 2026 Auckland skips 02:00–03:00, so 16:00 local is only
   * fifteen elapsed hours after midnight. Counting elapsed time would draw the
   * block at 15:00 and every afternoon block on that day would sit an hour out.
   */
  it('positions by the clock, not elapsed time, on the day the clocks go forward', () => {
    const sunday = weekDays(DST_WEEK, ZONE)[6] as WeekDay;
    // 16:00–17:00 NZDT (UTC+13) on Sun 27 Sep 2026.
    const span = minutesWithinDay(
      { startAt: new Date('2026-09-27T03:00:00Z'), endAt: new Date('2026-09-27T04:00:00Z') },
      sunday,
      ZONE,
    );
    expect(span).toEqual({ startMinutes: 16 * 60, endMinutes: 17 * 60 });
  });
});

describe('tutorWeekBlocks', () => {
  const days = weekDays(PLAIN_WEEK, ZONE);
  const empty = { rules: [], exceptions: [], reservations: [], days, timeZone: ZONE };

  it('places a recurring rule in its Monday-first column', () => {
    const { blocks, segments } = tutorWeekBlocks({ ...empty, rules: [rule()] });
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      dayIndex: 1, // stored dayOfWeek 2 = Tuesday = second column
      startMinutes: 16 * 60,
      endMinutes: 18 * 60,
      role: 'available',
    });
    expect(segments[0]).toMatchObject({ kind: 'rule', rowId: 'rule-1', editable: true });
  });

  it('omits a rule that has not started, or has already ended', () => {
    expect(
      tutorWeekBlocks({ ...empty, rules: [rule({ effectiveFrom: '2027-01-01' })] }).blocks,
    ).toHaveLength(0);
    expect(
      tutorWeekBlocks({ ...empty, rules: [rule({ effectiveUntil: '2026-01-01' })] }).blocks,
    ).toHaveLength(0);
  });

  it('renders a blocked period as blocked, and editable when it is a whole row', () => {
    const { blocks, segments } = tutorWeekBlocks({ ...empty, exceptions: [exception()] });
    expect(blocks[0]?.role).toBe('blocked');
    expect(segments[0]?.editable).toBe(true);
  });

  /**
   * The private note is rendered from its own list, not carried on the segment.
   * Keeping it off the segment means the calendar's client props hold no
   * private text at all, so there is one fewer copy to leak.
   */
  it('carries no private note or reason on any segment', () => {
    const { blocks, segments } = tutorWeekBlocks({ ...empty, exceptions: [exception()] });
    const serialised = JSON.stringify({ blocks, segments });
    expect(serialised).not.toContain('Dentist');
    expect(serialised).not.toContain('personal');
  });

  /**
   * A one-off addition is bookable time, but the tutor needs to see that it
   * happens once rather than every week — so it carries its own role.
   */
  it('renders a one-off addition as its own kind of available', () => {
    const { blocks } = tutorWeekBlocks({
      ...empty,
      exceptions: [exception({ effectCode: 'adds' })],
    });
    expect(blocks[0]?.role).toBe('available_once');
    // Still positive availability, so a family-facing calendar accepts it.
    expect(() => {
      assertFamilySafe(blocks);
    }).not.toThrow();
  });

  /**
   * A holiday spanning several days becomes one block per day. Those segments
   * are not editable: resizing one of them would truncate the whole period
   * while appearing to change only that day.
   */
  it('splits a multi-day period per day and refuses to make the pieces editable', () => {
    const { blocks, segments } = tutorWeekBlocks({
      ...empty,
      exceptions: [
        exception({
          startsAt: new Date('2026-08-17T12:00:00Z'),
          endsAt: new Date('2026-08-20T12:00:00Z'),
        }),
      ],
    });
    expect(blocks.length).toBeGreaterThan(1);
    expect(segments.every((segment) => !segment.editable)).toBe(true);
    expect(new Set(segments.map((segment) => segment.rowId))).toEqual(new Set(['exception-1']));
  });

  it('distinguishes a temporary hold from a confirmed lesson, and locks both', () => {
    const reservations: TutorReservationRecord[] = [
      {
        id: 'hold-1',
        startAt: new Date('2026-08-18T04:00:00Z'),
        endAt: new Date('2026-08-18T05:00:00Z'),
        reservationTypeCode: 'request_hold',
        expiresAt: new Date('2026-08-19T04:00:00Z'),
      },
      {
        id: 'lesson-1',
        startAt: new Date('2026-08-19T04:00:00Z'),
        endAt: new Date('2026-08-19T05:00:00Z'),
        reservationTypeCode: 'booking_confirmed',
        expiresAt: null,
      },
    ];
    const { blocks, segments } = tutorWeekBlocks({ ...empty, reservations });
    expect(blocks.map((block) => block.role).sort()).toEqual(['hold', 'lesson']);
    expect(segments.every((segment) => !segment.editable)).toBe(true);

    // A hold names the moment it lapses; left open-ended it would read to the
    // tutor exactly like a booking.
    expect(blocks.find((block) => block.role === 'hold')?.label).toMatch(/^Held until /);
    expect(blocks.find((block) => block.role === 'lesson')?.label).toBe('Confirmed lesson');
  });

  it('falls back to a plain hold label when there is no expiry to show', () => {
    const { blocks } = tutorWeekBlocks({
      ...empty,
      reservations: [
        {
          id: 'hold-2',
          startAt: new Date('2026-08-18T04:00:00Z'),
          endAt: new Date('2026-08-18T05:00:00Z'),
          reservationTypeCode: 'request_hold',
          expiresAt: null,
        },
      ],
    });
    expect(blocks[0]?.label).toBe('Held, temporarily');
  });

  /**
   * The tutor's own week is exactly what a family must never be shown, and the
   * shared calendar cannot tell the two apart by looking. This proves the
   * assertion catches it rather than trusting the caller to pass the right one.
   */
  it('produces blocks a family-facing calendar refuses', () => {
    const { blocks } = tutorWeekBlocks({ ...empty, exceptions: [exception()] });
    expect(() => {
      assertFamilySafe(blocks);
    }).toThrow(/blocked/);
  });
});

describe('familyPreviewBlocks', () => {
  const days = weekDays(PLAIN_WEEK, ZONE);
  const slots = [
    { startAt: new Date('2026-08-18T04:00:00Z'), endAt: new Date('2026-08-18T05:00:00Z') },
    { startAt: new Date('2026-08-19T04:00:00Z'), endAt: new Date('2026-08-19T05:00:00Z') },
  ];

  it('turns derived slots into positioned available blocks', () => {
    const blocks = familyPreviewBlocks(slots, days, ZONE);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ dayIndex: 1, startMinutes: 960, role: 'available' });
    expect(blocks[1]).toMatchObject({ dayIndex: 2, startMinutes: 960, role: 'available' });
  });

  it('passes the family-safe assertion, because there is nothing else in it', () => {
    expect(() => {
      assertFamilySafe(familyPreviewBlocks(slots, days, ZONE));
    }).not.toThrow();
  });

  it('drops slots outside the week being shown', () => {
    const blocks = familyPreviewBlocks(
      [{ startAt: new Date('2026-09-01T04:00:00Z'), endAt: new Date('2026-09-01T05:00:00Z') }],
      days,
      ZONE,
    );
    expect(blocks).toHaveLength(0);
  });
});
