import { describe, expect, it } from 'vitest';
import { bookingIntervalLabel, endOfLesson, lessonClockRange } from './time-labels';

/**
 * How a chosen time reads once it is chosen.
 *
 * The whole point is that a family choosing a start every fifteen minutes is
 * NOT choosing fifteen-minute lessons, so every case here pins the interval to
 * the lesson's own duration.
 *
 * All times are built as UTC instants and asserted in New Zealand time, which
 * is the one zone the platform schedules in. In September NZ is UTC+12.
 */

/** 2026-09-01 is a Tuesday. `at(4, 0)` is 4:00 pm NZ. */
function at(hour24: number, minute: number): Date {
  return new Date(Date.UTC(2026, 8, 1, hour24 - 12, minute));
}

describe('endOfLesson', () => {
  it('adds the lesson duration and nothing else', () => {
    expect(endOfLesson(at(16, 0), 60).toISOString()).toBe('2026-09-01T05:00:00.000Z');
  });

  /**
   * THE MINIMUM GAP IS NOT LESSON TIME. A tutor keeping fifteen minutes clear
   * after a lesson cannot take another until 5:15, but the family asked for an
   * hour and is shown an hour.
   */
  it('ignores any tutor gap — the family asked for the lesson, not the buffer', () => {
    expect(endOfLesson(at(16, 0), 60).getTime() - at(16, 0).getTime()).toBe(60 * 60_000);
  });
});

describe('lessonClockRange', () => {
  it('shows a 60-minute lesson from its quarter-hour starts', () => {
    expect(lessonClockRange(at(16, 0), 60)).toBe('4:00–5:00 pm');
    expect(lessonClockRange(at(16, 15), 60)).toBe('4:15–5:15 pm');
    expect(lessonClockRange(at(16, 30), 60)).toBe('4:30–5:30 pm');
    expect(lessonClockRange(at(16, 45), 60)).toBe('4:45–5:45 pm');
  });

  it('shows a 90-minute lesson running an hour and a half', () => {
    expect(lessonClockRange(at(16, 0), 90)).toBe('4:00–5:30 pm');
    expect(lessonClockRange(at(16, 15), 90)).toBe('4:15–5:45 pm');
  });

  /** Said once where both ends agree: repeating it reads as two times. */
  it('says the meridiem once when the lesson does not cross midday', () => {
    expect(lessonClockRange(at(9, 0), 60)).toBe('9:00–10:00 am');
  });

  it('says both when the lesson crosses midday', () => {
    expect(lessonClockRange(at(11, 30), 60)).toBe('11:30 am–12:30 pm');
  });

  it('handles a lesson that crosses noon exactly', () => {
    expect(lessonClockRange(at(11, 0), 60)).toBe('11:00 am–12:00 pm');
  });
});

describe('bookingIntervalLabel', () => {
  it('names the day, then the interval', () => {
    expect(bookingIntervalLabel(at(16, 0), 60)).toBe('Tue 1 Sept · 4:00–5:00 pm');
  });

  it('distinguishes starts a quarter of an hour apart', () => {
    const labels = [0, 15, 30].map((minute) => bookingIntervalLabel(at(16, minute), 60));

    expect(labels).toEqual([
      'Tue 1 Sept · 4:00–5:00 pm',
      'Tue 1 Sept · 4:15–5:15 pm',
      'Tue 1 Sept · 4:30–5:30 pm',
    ]);
    expect(new Set(labels).size).toBe(3);
  });

  it('reflects the lesson length rather than the gap between starts', () => {
    expect(bookingIntervalLabel(at(16, 0), 90)).toBe('Tue 1 Sept · 4:00–5:30 pm');
  });
});
