import { describe, expect, it } from 'vitest';
import { COMMISSION_RATE, JACOB, money, priceFor, split } from './fixtures';
import {
  committedLessons,
  demoFortnight,
  demoWeek,
  extraSession,
  familyActions,
  familyLessons,
  heldRequests,
  inboxRequests,
  weekTotals,
} from './schedule';

/**
 * TWO THINGS THAT MUST NOT DRIFT.
 *
 * The commission is arithmetic in one place and the extra session is one
 * object; both were previously duplicated, and both are the kind of thing a
 * reviewer catches instantly — a lesson that costs $55 on one screen and $55.50
 * on another, or a payment demand that survives paying it.
 */

const NOW = new Date('2026-09-09T09:00:00+12:00');

describe('the commission, in one place', () => {
  it('takes Studdy s cut OUT OF the listed price', () => {
    // The two figures the demo actually advertises, spelled out rather than
    // recomputed — a test that repeats the implementation proves nothing.
    expect(money(split(5500n).grossMinor)).toBe('$55.00');
    expect(money(split(5500n).feeMinor)).toBe('$8.25');
    expect(money(split(5500n).netMinor)).toBe('$46.75');

    expect(money(split(8000n).feeMinor)).toBe('$12.00');
    expect(money(split(8000n).netMinor)).toBe('$68.00');
  });

  it('never loses or invents a cent', () => {
    for (const gross of [5500n, 8000n, 1n, 999n, 123_456n]) {
      const parts = split(gross);
      expect(parts.feeMinor + parts.netMinor).toBe(gross);
      expect(parts.feeMinor).toBeGreaterThanOrEqual(0n);
    }
  });

  it('keeps the rate card and the commission agreeing', () => {
    const rate = priceFor(60);
    expect(Number(split(rate).feeMinor) / Number(rate)).toBeCloseTo(COMMISSION_RATE, 4);
  });
});

describe('a week s earnings', () => {
  it('reports net as well as gross, and they reconcile', () => {
    const totals = weekTotals(demoWeek(NOW, { dayCount: 5 }).days, NOW);
    expect(totals.netMinor + totals.feeMinor).toBe(totals.grossMinor);
    expect(totals.netMinor).toBeLessThan(totals.grossMinor);
  });

  it('sums the fee per lesson rather than off the total', () => {
    // Rounding the whole week at once and rounding each lesson can differ by a
    // cent, and the payouts page itemises. They have to be computed the same
    // way or two screens disagree about the same week.
    const days = demoWeek(NOW, { dayCount: 5 }).days;
    const totals = weekTotals(days, NOW);
    // The whole week, taught and still to come — the same set `weekTotals`
    // counts, because the line it feeds describes a week rather than a to-do
    // list.
    const perLesson = committedLessons(days, NOW, true).reduce(
      (total, lesson) => total + split(lesson.priceMinor).feeMinor,
      0n,
    );
    expect(totals.feeMinor).toBe(perLesson);
  });
});

describe('the extra session, through its whole lifecycle', () => {
  it('has left the tutor s inbox because she accepted it', () => {
    expect(inboxRequests(NOW).map((request) => request.slug)).not.toContain('jacob-extra-session');
    expect(heldRequests(NOW).map((request) => request.slug)).toContain('jacob-extra-session');
  });

  it('is owed for until the demo s payment goes through', () => {
    const unpaid = extraSession(NOW);
    expect(unpaid?.payment).toBe('due');
    expect(unpaid?.payBy).not.toBeNull();

    const settled = extraSession(NOW, true);
    expect(settled?.payment).toBe('paid');
    expect(settled?.payBy).toBeNull();
  });

  it('asks the family for exactly one thing, and stops once it is paid', () => {
    const actions = familyActions(NOW, false);
    expect(actions).toHaveLength(1);
    expect(actions[0]?.amountMinor).toBe(priceFor(JACOB.durationMinutes));
    // The deadline is a real instant before the lesson, not a placeholder.
    expect(actions[0]?.payByAt.getTime()).toBeGreaterThan(NOW.getTime());

    expect(familyActions(NOW, true)).toHaveLength(0);
  });

  it('is ONE lesson, not a second one created by paying', () => {
    const before = familyLessons(demoFortnight(NOW), NOW, [JACOB.slug], { paid: false });
    const after = familyLessons(demoFortnight(NOW), NOW, [JACOB.slug], { paid: true });

    expect(after).toHaveLength(before.length);
    const unpaid = before.filter((lesson) => lesson.payment === 'due');
    expect(unpaid).toHaveLength(1);
    expect(after.every((lesson) => lesson.payment === 'paid')).toBe(true);
    // Same lesson, same hour — only its payment state moved.
    expect(after.map((lesson) => lesson.id)).toEqual(before.map((lesson) => lesson.id));
  });

  it('is held on the tutor s side, and so is not counted as income', () => {
    const days = demoFortnight(NOW);
    const extra = extraSession(NOW);
    expect(extra).not.toBeNull();
    expect(committedLessons(days, NOW).map((lesson) => lesson.id)).not.toContain(extra?.id);
  });
});
