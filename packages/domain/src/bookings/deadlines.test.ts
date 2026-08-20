import { describe, expect, it } from 'vitest';
import { acceptanceHoldExpiry, calculateDeadlines, selectResponseTier } from './deadlines';
import { PROVISIONAL_REQUEST_RULES, type RequestRules } from './request-rules';

const rules: RequestRules = PROVISIONAL_REQUEST_RULES;
const now = new Date('2026-08-10T09:00:00.000Z');

function hoursFromNow(hours: number): Date {
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

describe('selectResponseTier', () => {
  it('gives the widest window to a distant lesson', () => {
    expect(selectResponseTier(rules, 200).responseWindowHours).toBe(24);
    expect(selectResponseTier(rules, 48).responseWindowHours).toBe(24);
  });

  it('tightens as the lesson approaches', () => {
    expect(selectResponseTier(rules, 47).responseWindowHours).toBe(12);
    expect(selectResponseTier(rules, 24).responseWindowHours).toBe(12);
    expect(selectResponseTier(rules, 23).responseWindowHours).toBe(4);
    expect(selectResponseTier(rules, 6).responseWindowHours).toBe(4);
    expect(selectResponseTier(rules, 5).responseWindowHours).toBe(1);
  });
});

describe('calculateDeadlines', () => {
  it('a distant lesson gets the full response window and a grace period', () => {
    const result = calculateDeadlines(rules, hoursFromNow(200), now);
    expect(result.respondByAt).toEqual(hoursFromNow(24));
    expect(result.decisionDeadlineAt).toEqual(hoursFromNow(48));
  });

  it('never sets a deadline past the point the lesson becomes unbookable', () => {
    // Lesson in 5 hours: 1-hour tier, but minimum notice is 2 hours, so the
    // last useful moment is 3 hours away — the grace period must not exceed it.
    const result = calculateDeadlines(rules, hoursFromNow(5), now);
    expect(result.respondByAt).toEqual(hoursFromNow(1));
    expect(result.decisionDeadlineAt).toEqual(hoursFromNow(3));
    expect(result.decisionDeadlineAt.getTime()).toBeLessThan(hoursFromNow(5).getTime());
  });

  it('clamps the response deadline for a very short-notice lesson', () => {
    // Lesson in 2.5 hours; minimum notice 2 hours leaves only 30 minutes.
    const result = calculateDeadlines(rules, hoursFromNow(2.5), now);
    expect(result.respondByAt).toEqual(hoursFromNow(0.5));
    expect(result.decisionDeadlineAt).toEqual(hoursFromNow(0.5));
  });

  it('never returns a deadline in the past', () => {
    const result = calculateDeadlines(rules, hoursFromNow(1), now);
    expect(result.respondByAt.getTime()).toBeGreaterThanOrEqual(now.getTime());
    expect(result.decisionDeadlineAt.getTime()).toBeGreaterThanOrEqual(now.getTime());
  });

  it('decision deadline is never before the response deadline', () => {
    for (const hours of [0.5, 1, 2.5, 5, 12, 30, 100]) {
      const result = calculateDeadlines(rules, hoursFromNow(hours), now);
      expect(result.decisionDeadlineAt.getTime()).toBeGreaterThanOrEqual(
        result.respondByAt.getTime(),
      );
    }
  });

  it('reports the tier it applied, for auditability', () => {
    expect(calculateDeadlines(rules, hoursFromNow(100), now).appliedTier.minHoursUntilLesson).toBe(
      48,
    );
  });
});

describe('acceptanceHoldExpiry', () => {
  it('holds for the configured window when the lesson is far off', () => {
    // Eight hours from acceptance, well before the lesson's own cutoff.
    const lesson = hoursFromNow(200);
    expect(acceptanceHoldExpiry(rules, now, lesson).toISOString()).toBe(
      hoursFromNow(8).toISOString(),
    );
  });

  it('ends before the lesson when that comes first', () => {
    // A lesson four hours away: the cutoff (two hours before it) binds, not
    // the eight-hour window.
    const lesson = hoursFromNow(4);
    expect(acceptanceHoldExpiry(rules, now, lesson).toISOString()).toBe(
      hoursFromNow(2).toISOString(),
    );
  });

  it('never outlives the point at which the lesson stops being bookable', () => {
    // Minimum notice and the hold cutoff are the same figure, so a hold that
    // survived past it would be protecting a slot nobody could book.
    for (const hoursAway of [3, 6, 12, 48, 500]) {
      const lesson = hoursFromNow(hoursAway);
      const expiry = acceptanceHoldExpiry(rules, now, lesson);
      const unbookableFrom = new Date(lesson.getTime() - rules.minimumNoticeHours * 60 * 60 * 1000);
      expect(expiry.getTime()).toBeLessThanOrEqual(unbookableFrom.getTime());
    }
  });
});
