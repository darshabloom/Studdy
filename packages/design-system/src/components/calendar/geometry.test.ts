import { describe, expect, it } from 'vitest';
import {
  assertFamilySafe,
  blockPosition,
  clockLabel,
  draggedRange,
  fittedWindow,
  hourMarks,
  minutesAtOffset,
  snapMinutes,
  type CalendarBlock,
} from './geometry';

const window = { dayStartMinutes: 8 * 60, dayEndMinutes: 20 * 60 };

const block = (startMinutes: number, endMinutes: number, extra?: Partial<CalendarBlock>) =>
  ({
    id: 'b',
    dayIndex: 1,
    startMinutes,
    endMinutes,
    role: 'available',
    ...extra,
  }) satisfies CalendarBlock;

describe('blockPosition', () => {
  it('places a block proportionally within the visible day', () => {
    // 8am–8pm is 12 hours; 2pm–3pm starts halfway and covers a twelfth.
    const position = blockPosition(block(14 * 60, 15 * 60), window);
    expect(position?.topPercent).toBeCloseTo(50);
    expect(position?.heightPercent).toBeCloseTo(100 / 12);
  });

  it('clamps a block that overhangs the window', () => {
    const position = blockPosition(block(6 * 60, 9 * 60), window);
    expect(position?.topPercent).toBe(0);
    expect(position?.heightPercent).toBeCloseTo(100 / 12);
  });

  it('drops a block entirely outside the window rather than showing a sliver', () => {
    // A squashed remnant would read as availability that is not there.
    expect(blockPosition(block(5 * 60, 7 * 60), window)).toBeNull();
    expect(blockPosition(block(21 * 60, 22 * 60), window)).toBeNull();
  });

  it('returns nothing for an inverted window', () => {
    expect(
      blockPosition(block(9 * 60, 10 * 60), { dayStartMinutes: 600, dayEndMinutes: 600 }),
    ).toBeNull();
  });
});

describe('snapMinutes', () => {
  it('rounds to the nearest step', () => {
    expect(snapMinutes(1_007, 30)).toBe(1_020);
    expect(snapMinutes(1_004, 30)).toBe(990);
  });

  it('leaves values alone when there is no step', () => {
    expect(snapMinutes(1_007, 0)).toBe(1_007);
  });
});

describe('minutesAtOffset', () => {
  it('maps a pointer position to a snapped time', () => {
    // Halfway down a 12-hour window from 8am is 2pm.
    expect(minutesAtOffset(300, 600, window, 30)).toBe(14 * 60);
  });

  it('clamps a drag that leaves the column', () => {
    expect(minutesAtOffset(-500, 600, window, 30)).toBe(window.dayStartMinutes);
    expect(minutesAtOffset(5_000, 600, window, 30)).toBe(window.dayEndMinutes);
  });

  it('survives a zero-height column', () => {
    expect(minutesAtOffset(10, 0, window, 30)).toBe(window.dayStartMinutes);
  });
});

describe('draggedRange', () => {
  it('treats an upward drag as the same range as a downward one', () => {
    const down = draggedRange(9 * 60, 11 * 60, window, 30);
    const up = draggedRange(11 * 60, 9 * 60, window, 30);
    expect(down).toEqual(up);
    expect(down.startMinutes).toBe(9 * 60);
    expect(down.endMinutes).toBe(11 * 60);
  });

  it('turns a click into one step, so a tap creates a block', () => {
    const range = draggedRange(9 * 60, 9 * 60, window, 30);
    expect(range.endMinutes - range.startMinutes).toBe(30);
  });

  it('never escapes the visible window', () => {
    const range = draggedRange(window.dayEndMinutes, window.dayEndMinutes, window, 30);
    expect(range.endMinutes).toBeLessThanOrEqual(window.dayEndMinutes);
  });
});

describe('hourMarks', () => {
  it('marks every whole hour inside the window', () => {
    const marks = hourMarks({ dayStartMinutes: 8 * 60, dayEndMinutes: 11 * 60 });
    expect(marks).toEqual([8 * 60, 9 * 60, 10 * 60, 11 * 60]);
  });

  it('starts at the first whole hour when the window begins mid-hour', () => {
    const marks = hourMarks({ dayStartMinutes: 8 * 60 + 30, dayEndMinutes: 10 * 60 });
    expect(marks[0]).toBe(9 * 60);
  });
});

describe('clockLabel', () => {
  it('reads as a person would say it', () => {
    expect(clockLabel(9 * 60)).toBe('9 am');
    expect(clockLabel(12 * 60)).toBe('12 pm');
    expect(clockLabel(16 * 60 + 30)).toBe('4:30 pm');
    expect(clockLabel(0)).toBe('12 am');
  });
});

describe('fittedWindow', () => {
  const fallback = { dayStartMinutes: 8 * 60, dayEndMinutes: 20 * 60 };

  it('fits the window to the data, padded to whole hours', () => {
    const fitted = fittedWindow([block(16 * 60, 19 * 60)], fallback);
    expect(fitted).toEqual({ dayStartMinutes: 15 * 60, dayEndMinutes: 20 * 60 });
  });

  it('falls back when there is nothing to fit', () => {
    expect(fittedWindow([], fallback)).toEqual(fallback);
  });

  it('never runs past the ends of the day', () => {
    const fitted = fittedWindow([block(10, 24 * 60 - 10)], fallback);
    expect(fitted.dayStartMinutes).toBeGreaterThanOrEqual(0);
    expect(fitted.dayEndMinutes).toBeLessThanOrEqual(24 * 60);
  });
});

describe('assertFamilySafe', () => {
  it('accepts derived bookable time and the family own choices', () => {
    expect(() => {
      assertFamilySafe([
        block(9 * 60, 10 * 60),
        block(11 * 60, 12 * 60, { role: 'selected' }),
        block(13 * 60, 14 * 60, { role: 'candidate' }),
      ]);
    }).not.toThrow();
  });

  it('refuses anything that would explain a gap', () => {
    // The whole risk of one shared calendar: it cannot tell a derived slot
    // from a raw rule by looking, so the boundary is asserted here instead.
    for (const role of ['blocked', 'hold', 'lesson'] as const) {
      expect(() => {
        assertFamilySafe([block(9 * 60, 10 * 60, { role })]);
      }).toThrow(/family-facing calendar/i);
    }
  });
});
