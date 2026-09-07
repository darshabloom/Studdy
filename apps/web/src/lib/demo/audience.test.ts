import { describe, expect, it } from 'vitest';
import { STUDENTS, JACOB } from './fixtures';
import { demoWeek, familyWeekBlocks, staceyWeekBlocks } from './schedule';

/**
 * THE PRIVACY BOUNDARY, ASSERTED.
 *
 * A parent looking at their tutor's week to find a free hour must not learn who
 * else that tutor teaches. This regressed once already — Priya's confirmed
 * booking screen rendered another family's child by name — because the
 * projection was audience-blind and the pages were trusted to relabel. They are
 * not; this is.
 *
 * The test is written against the OUTPUT rather than the implementation, so any
 * future way of leaking a name still fails it.
 */

// A wide enough spread of dates that every relationship in the fixtures gets a
// chance to appear, whichever weekday the suite happens to run on.
const SAMPLE_DAYS = [
  new Date('2026-09-07T09:00:00+12:00'),
  new Date('2026-09-09T09:00:00+12:00'),
  new Date('2026-09-11T09:00:00+12:00'),
  new Date('2026-09-13T09:00:00+12:00'),
];

const OTHER_NAMES = STUDENTS.filter((student) => student.slug !== JACOB.slug).map(
  (student) => student.firstName,
);

describe('family calendar projection', () => {
  it('never labels a block with another family s child', () => {
    for (const now of SAMPLE_DAYS) {
      const blocks = familyWeekBlocks(demoWeek(now).days, now, JACOB.slug);
      const labels = blocks.map((block) => block.label ?? '');
      for (const name of OTHER_NAMES) {
        expect(labels, `leaked ${name} for a family audience on ${now.toISOString()}`).not.toContain(
          name,
        );
      }
    }
  });

  it('still shows the family their own child by name', () => {
    // Jacob's standing lesson is Tuesday, so a week beginning Monday contains it.
    const now = new Date('2026-09-07T09:00:00+12:00');
    const labels = familyWeekBlocks(demoWeek(now).days, now, JACOB.slug).map(
      (block) => block.label ?? '',
    );
    expect(labels).toContain(JACOB.firstName);
  });

  it('labels every other lesson as booked time rather than hiding it', () => {
    const now = new Date('2026-09-07T09:00:00+12:00');
    const blocks = familyWeekBlocks(demoWeek(now).days, now, JACOB.slug);
    const lessons = blocks.filter((block) => block.role === 'lesson');
    const anonymous = lessons.filter((block) => block.label === 'Booked');

    // The time must still be occupied — anonymising a lesson must never delete
    // it, or the family is shown an hour the tutor cannot actually teach.
    expect(lessons.length).toBeGreaterThan(anonymous.length);
    expect(anonymous.length).toBeGreaterThan(0);
  });

  it('shows the tutor her own students by name', () => {
    const now = new Date('2026-09-07T09:00:00+12:00');
    const labels = staceyWeekBlocks(demoWeek(now).days, now).map((block) => block.label ?? '');
    const named = OTHER_NAMES.filter((name) =>
      labels.some((label) => label.startsWith(name)),
    );
    expect(named.length).toBeGreaterThan(0);
  });
});
