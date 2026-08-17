import { describe, expect, it } from 'vitest';
import {
  dayLabel,
  groupSlotsByDay,
  nextAvailableLabel,
  slotLabel,
  timeLabel,
} from './presentation';

const ZONE = 'Pacific/Auckland';

/** 2026-09-01 is a Tuesday. 04:00Z = 16:00 NZST. */
const slot = (startIso: string, minutes: number): { startAt: Date; endAt: Date } => {
  const startAt = new Date(startIso);
  return { startAt, endAt: new Date(startAt.getTime() + minutes * 60_000) };
};

describe('slot presentation', () => {
  it('labels a time in the lesson zone, not the runner zone', () => {
    // The whole point: this must read the same on a UTC CI runner as in
    // Auckland, because it is the clock the lesson happens on.
    expect(timeLabel(new Date('2026-09-01T04:00:00Z'), ZONE)).toBe('4:00 pm');
  });

  it('drops the repeated meridiem across a slot', () => {
    expect(slotLabel(slot('2026-09-01T04:00:00Z', 60), ZONE)).toBe('4:00 – 5:00 pm');
  });

  it('keeps both when the slot crosses noon or midnight', () => {
    // 23:30Z = 11:30 am NZST, running to 12:30 pm.
    expect(slotLabel(slot('2026-08-31T23:30:00Z', 60), ZONE)).toBe('11:30 am – 12:30 pm');
  });

  it('labels a day with its weekday', () => {
    expect(dayLabel(new Date('2026-09-01T04:00:00Z'), ZONE)).toBe('Tue 1 Sept');
  });

  it('groups slots into chronological days', () => {
    const grouped = groupSlotsByDay(
      [
        slot('2026-09-02T04:00:00Z', 60),
        slot('2026-09-01T05:00:00Z', 60),
        slot('2026-09-01T04:00:00Z', 60),
      ],
      ZONE,
    );

    expect(grouped.map((day) => day.label)).toEqual(['Tue 1 Sept', 'Wed 2 Sept']);
    expect(grouped[0]?.slots.map((entry) => entry.label)).toEqual([
      '4:00 – 5:00 pm',
      '5:00 – 6:00 pm',
    ]);
  });

  it('limits rendered days without implying nothing follows', () => {
    const grouped = groupSlotsByDay(
      [slot('2026-09-01T04:00:00Z', 60), slot('2026-09-02T04:00:00Z', 60)],
      ZONE,
      1,
    );
    expect(grouped).toHaveLength(1);
  });

  it('names the earliest slot regardless of input order', () => {
    expect(
      nextAvailableLabel(
        [slot('2026-09-02T04:00:00Z', 60), slot('2026-09-01T04:00:00Z', 60)],
        ZONE,
      ),
    ).toBe('Tue 1 Sept, 4:00 pm');
  });

  it('says nothing at all when there is no bookable time', () => {
    // Null is the whole vocabulary here: no reason, no distinction between a
    // full calendar and a tutor who does not work then.
    expect(nextAvailableLabel([], ZONE)).toBeNull();
  });

  it('abbreviates the month the way en-NZ does', () => {
    // Pinned deliberately: en-NZ writes 'Sept', not 'Sep', and a future locale
    // change would alter every availability screen at once.
    expect(dayLabel(new Date('2026-09-01T04:00:00Z'), ZONE)).toContain('Sept');
    expect(dayLabel(new Date('2026-10-01T04:00:00Z'), ZONE)).toContain('Oct');
  });
});
