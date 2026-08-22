import { describe, expect, it } from 'vitest';
import { assertFamilySafe, type CalendarBlock } from '@studdy/design-system';
import {
  AVAILABILITY_PAGE_COUNT,
  AVAILABILITY_PAGE_DAYS,
  availabilitySummary,
  availabilityView,
} from './availability-view';
import {
  bookableSlotBlocks,
  familyCalendarWindow,
  mergeContiguousBlocks,
  profileCalendarWindow,
} from '../availability/calendar-projection';
import { weekDays } from '../availability/calendar-time';

const ZONE = 'Pacific/Auckland';

describe('availabilityView', () => {
  /**
   * The reason this is not Monday-anchored. Opened on a Saturday, a Monday week
   * would spend five of its seven columns on days that have gone — and those
   * columns come back empty, because availability is only derived forwards.
   * An empty column on a family calendar reads as time the tutor is not free.
   */
  it('starts at today whatever weekday that is', () => {
    const saturday = new Date('2026-08-22T02:00:00Z'); // Saturday 22 Aug in NZ
    const view = availabilityView(1, saturday, ZONE);
    expect(view.days[0]?.date).toBe('2026-08-22');
    expect(view.days[6]?.date).toBe('2026-08-28');
  });

  it('derives from now rather than from the start of today', () => {
    const now = new Date('2026-08-22T02:00:00Z');
    const view = availabilityView(1, now, ZONE);
    expect(view.from.getTime()).toBe(now.getTime());
  });

  it('starts a later page at the start of its own first day', () => {
    const now = new Date('2026-08-22T02:00:00Z');
    const view = availabilityView(2, now, ZONE);
    expect(view.days[0]?.date).toBe('2026-08-29');
    expect(view.from.getTime()).toBe(view.days[0]?.startAt.getTime());
  });

  /**
   * `?week=` is user-editable. Walking past the published horizon would render
   * empty days that a parent would read as this tutor having no availability,
   * so the page is clamped rather than trusted.
   */
  it('clamps a page beyond the horizon back into it', () => {
    const now = new Date('2026-08-22T02:00:00Z');
    expect(availabilityView(99, now, ZONE).page).toBe(AVAILABILITY_PAGE_COUNT);
    expect(availabilityView(0, now, ZONE).page).toBe(1);
    expect(availabilityView(Number.NaN, now, ZONE).page).toBe(1);
  });

  it('offers navigation only where there is somewhere to go', () => {
    const now = new Date('2026-08-22T02:00:00Z');
    const first = availabilityView(1, now, ZONE);
    const last = availabilityView(AVAILABILITY_PAGE_COUNT, now, ZONE);
    expect(first.hasPrevious).toBe(false);
    expect(last.hasNext).toBe(false);
    expect(first.days).toHaveLength(AVAILABILITY_PAGE_DAYS);
  });

  /**
   * Today is MARKED, not relabelled. A card divides its width by seven, so a
   * 'Today' heading would truncate and cost the column its weekday anyway.
   */
  it('points at today on the first page and nowhere on a later one', () => {
    const now = new Date('2026-08-22T02:00:00Z');
    expect(availabilityView(1, now, ZONE).todayIndex).toBe(0);
    expect(availabilityView(2, now, ZONE).todayIndex).toBe(-1);
  });

  it('keeps compact headings short enough for a card column', () => {
    const now = new Date('2026-08-22T02:00:00Z');
    for (const label of availabilityView(1, now, ZONE).compactDayLabels) {
      expect(label.length).toBeLessThanOrEqual(3);
    }
  });

  /**
   * The card and the profile must show the same seven days, or stepping from
   * one to the other looks like the tutor's availability changed.
   */
  it('gives the same days to every caller asking for the same page', () => {
    const now = new Date('2026-08-22T02:00:00Z');
    expect(availabilityView(1, now, ZONE).days.map((day) => day.date)).toEqual(
      availabilityView(1, now, ZONE).days.map((day) => day.date),
    );
  });
});

describe('availabilitySummary', () => {
  const days = weekDays('2026-08-17', ZONE);
  const slots = [
    { startAt: new Date('2026-08-18T04:00:00Z'), endAt: new Date('2026-08-18T05:00:00Z') },
    { startAt: new Date('2026-08-18T06:00:00Z'), endAt: new Date('2026-08-18T07:00:00Z') },
  ];

  it('reads out the times the calendar draws', () => {
    const summary = availabilitySummary(days, bookableSlotBlocks(slots, days, ZONE));
    expect(summary).toHaveLength(1);
    expect(summary[0]).toContain('4 pm to 5 pm');
    expect(summary[0]).toContain('6 pm to 7 pm');
  });

  /**
   * A day with nothing bookable is simply not mentioned. Announcing it as
   * unavailable would give a screen-reader user a reason for a gap that the
   * visible calendar deliberately withholds.
   */
  it('says nothing at all about a day with no bookable time', () => {
    const summary = availabilitySummary(days, bookableSlotBlocks(slots, days, ZONE));
    expect(summary.join(' ')).not.toMatch(/unavailable|busy|booked|none/i);
    expect(summary.some((line) => line.startsWith('Mon'))).toBe(false);
  });
});

describe('familyCalendarWindow', () => {
  const days = weekDays('2026-08-17', ZONE);

  it('shows the standard family window even for a tutor who teaches one hour', () => {
    const blocks = bookableSlotBlocks(
      [{ startAt: new Date('2026-08-18T04:00:00Z'), endAt: new Date('2026-08-18T05:00:00Z') }],
      days,
      ZONE,
    );
    expect(familyCalendarWindow(blocks)).toEqual({
      dayStartMinutes: 8 * 60,
      dayEndMinutes: 21 * 60,
    });
  });

  /**
   * Only ever widens. A dropped slot would read as time the tutor is not free.
   */
  it('widens to include a slot outside the standard hours', () => {
    const blocks = bookableSlotBlocks(
      [{ startAt: new Date('2026-08-17T18:30:00Z'), endAt: new Date('2026-08-17T19:30:00Z') }],
      days,
      ZONE,
    );
    expect(familyCalendarWindow(blocks).dayStartMinutes).toBeLessThan(8 * 60);
  });

  /**
   * The whole reason cards carry calendars is that they can be compared. One
   * window across every card is what makes the same height mean the same hour.
   */
  it('gives every tutor on a page one scale', () => {
    const early = bookableSlotBlocks(
      [{ startAt: new Date('2026-08-17T20:00:00Z'), endAt: new Date('2026-08-17T21:00:00Z') }],
      days,
      ZONE,
    );
    const late = bookableSlotBlocks(
      [{ startAt: new Date('2026-08-18T09:00:00Z'), endAt: new Date('2026-08-18T10:00:00Z') }],
      days,
      ZONE,
    );
    const shared = familyCalendarWindow([...early, ...late]);
    for (const block of [...early, ...late]) {
      expect(block.startMinutes).toBeGreaterThanOrEqual(shared.dayStartMinutes);
      expect(block.endMinutes).toBeLessThanOrEqual(shared.dayEndMinutes);
    }
  });

  /**
   * The boundary again, from the discovery side: whatever the view module does
   * with days and labels, what reaches a family calendar is positive slots.
   */
  it('produces blocks a family-facing calendar accepts', () => {
    const blocks: readonly CalendarBlock[] = bookableSlotBlocks(
      [{ startAt: new Date('2026-08-18T04:00:00Z'), endAt: new Date('2026-08-18T05:00:00Z') }],
      days,
      ZONE,
    );
    expect(() => {
      assertFamilySafe(blocks);
    }).not.toThrow();
  });
});

describe('mergeContiguousBlocks', () => {
  const days = weekDays('2026-08-17', ZONE);

  /**
   * Derived slots are START TIMES, so an hour-long lesson offered every half
   * hour from 4pm to 7pm arrives as five overlapping blocks. Drawn separately
   * they read as stripes — structure where there is none.
   */
  it('joins overlapping start times into one run', () => {
    const slots = [
      { startAt: new Date('2026-08-18T04:00:00Z'), endAt: new Date('2026-08-18T05:00:00Z') },
      { startAt: new Date('2026-08-18T04:30:00Z'), endAt: new Date('2026-08-18T05:30:00Z') },
      { startAt: new Date('2026-08-18T05:00:00Z'), endAt: new Date('2026-08-18T06:00:00Z') },
    ];
    const merged = mergeContiguousBlocks(bookableSlotBlocks(slots, days, ZONE));
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ dayIndex: 1, startMinutes: 960, endMinutes: 1080 });
  });

  it('joins runs that merely touch', () => {
    const slots = [
      { startAt: new Date('2026-08-18T04:00:00Z'), endAt: new Date('2026-08-18T05:00:00Z') },
      { startAt: new Date('2026-08-18T05:00:00Z'), endAt: new Date('2026-08-18T06:00:00Z') },
    ];
    expect(mergeContiguousBlocks(bookableSlotBlocks(slots, days, ZONE))).toHaveLength(1);
  });

  /**
   * A real break between two runs is information a parent acts on, so it
   * survives. Merging must tidy the drawing, never invent availability.
   */
  it('keeps a genuine gap as a gap', () => {
    const slots = [
      { startAt: new Date('2026-08-18T04:00:00Z'), endAt: new Date('2026-08-18T05:00:00Z') },
      { startAt: new Date('2026-08-18T07:00:00Z'), endAt: new Date('2026-08-18T08:00:00Z') },
    ];
    expect(mergeContiguousBlocks(bookableSlotBlocks(slots, days, ZONE))).toHaveLength(2);
  });

  it('never joins across days', () => {
    const slots = [
      { startAt: new Date('2026-08-18T11:30:00Z'), endAt: new Date('2026-08-18T12:00:00Z') },
      { startAt: new Date('2026-08-18T12:00:00Z'), endAt: new Date('2026-08-18T12:30:00Z') },
    ];
    const merged = mergeContiguousBlocks(bookableSlotBlocks(slots, days, ZONE));
    expect(new Set(merged.map((block) => block.dayIndex)).size).toBe(merged.length);
  });

  it('stays family-safe, because it only ever joins positive time', () => {
    const slots = [
      { startAt: new Date('2026-08-18T04:00:00Z'), endAt: new Date('2026-08-18T05:00:00Z') },
      { startAt: new Date('2026-08-18T04:30:00Z'), endAt: new Date('2026-08-18T05:30:00Z') },
    ];
    expect(() => {
      assertFamilySafe(mergeContiguousBlocks(bookableSlotBlocks(slots, days, ZONE)));
    }).not.toThrow();
  });
});

describe('profileCalendarWindow', () => {
  const days = weekDays('2026-08-17', ZONE);
  const blocksFor = (spans: readonly [string, string][]) =>
    mergeContiguousBlocks(
      bookableSlotBlocks(
        spans.map(([startAt, endAt]) => ({ startAt: new Date(startAt), endAt: new Date(endAt) })),
        days,
        ZONE,
      ),
    );

  /**
   * A profile shows ONE tutor a parent has already picked out. The editor's
   * broad fixed day exists so a tutor has somewhere new to draw; here nobody is
   * drawing, so eight empty morning hours only cost the legibility of the hours
   * that are not empty.
   */
  it('fits an evenings-only tutor rather than showing the whole teaching day', () => {
    const window = profileCalendarWindow(
      blocksFor([['2026-08-18T04:00:00Z', '2026-08-18T07:00:00Z']]),
    );
    expect(window.dayStartMinutes).toBeGreaterThan(8 * 60);
    expect(window.dayEndMinutes - window.dayStartMinutes).toBeLessThan(13 * 60);
  });

  it('keeps context either side rather than hugging the blocks', () => {
    const blocks = blocksFor([['2026-08-18T04:00:00Z', '2026-08-18T07:00:00Z']]);
    const window = profileCalendarWindow(blocks);
    const earliest = Math.min(...blocks.map((block) => block.startMinutes));
    const latest = Math.max(...blocks.map((block) => block.endMinutes));
    expect(window.dayStartMinutes).toBeLessThan(earliest);
    expect(window.dayEndMinutes).toBeGreaterThan(latest);
  });

  /**
   * Fitted, but never tightly. One hour plus padding would be a fragment of a
   * day, giving a parent nothing to place "after school" against.
   */
  it('never shrinks below a readable slice of the day', () => {
    const window = profileCalendarWindow(
      blocksFor([['2026-08-18T04:00:00Z', '2026-08-18T05:00:00Z']]),
    );
    expect(window.dayEndMinutes - window.dayStartMinutes).toBeGreaterThanOrEqual(6 * 60);
  });

  it('still contains every block it was fitted to', () => {
    const blocks = blocksFor([
      ['2026-08-17T19:00:00Z', '2026-08-17T20:00:00Z'],
      ['2026-08-18T08:00:00Z', '2026-08-18T09:00:00Z'],
    ]);
    const window = profileCalendarWindow(blocks);
    for (const block of blocks) {
      expect(block.startMinutes).toBeGreaterThanOrEqual(window.dayStartMinutes);
      expect(block.endMinutes).toBeLessThanOrEqual(window.dayEndMinutes);
    }
  });

  /**
   * A window that ran past midnight would be clipped short, so the minimum has
   * to come out of the other end of the day instead.
   */
  it('takes the minimum from the other end when a tutor teaches at the edge of the day', () => {
    const window = profileCalendarWindow(
      blocksFor([['2026-08-17T11:00:00Z', '2026-08-17T12:00:00Z']]),
    );
    expect(window.dayEndMinutes).toBeLessThanOrEqual(24 * 60);
    expect(window.dayStartMinutes).toBeGreaterThanOrEqual(0);
    expect(window.dayEndMinutes - window.dayStartMinutes).toBeGreaterThanOrEqual(6 * 60);
  });

  /**
   * Nothing to fit to is not the same as a tutor who teaches at midnight.
   */
  it('falls back to the standard family window when there is nothing to show', () => {
    expect(profileCalendarWindow([])).toEqual({
      dayStartMinutes: 8 * 60,
      dayEndMinutes: 21 * 60,
    });
  });

  /**
   * Discovery must NOT adopt this. Cards are read against each other, and a
   * per-tutor window would make the same height mean a different hour on each.
   */
  it('is deliberately different from the shared discovery window', () => {
    const blocks = blocksFor([['2026-08-18T04:00:00Z', '2026-08-18T07:00:00Z']]);
    expect(profileCalendarWindow(blocks)).not.toEqual(familyCalendarWindow(blocks));
  });
});
