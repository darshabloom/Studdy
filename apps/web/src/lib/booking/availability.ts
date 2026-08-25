import 'server-only';
import { bookableSlotsForTutors, type BookableSlot } from '@studdy/database';
// Imported rather than restated: a marker is exactly as tall as the distance to
// the next possible start, so a local copy that drifted would draw options
// overlapping or with false gaps between them.
import { SLOT_STEP_MINUTES } from '@studdy/domain/availability';
import { clockLabel, type CalendarBlock } from '@studdy/design-system';
import { bookableSlotBlocks, profileCalendarWindow } from '../availability/calendar-projection';
import { availabilitySummary, availabilityView } from '../discovery/availability-view';
import { PLATFORM_TIME_ZONE } from '../time';
import type { ResolvedBooking } from './resolve';

/**
 * The tutor's bookable time, for the family choosing when to ask about.
 *
 * WHY NOT `bookableSlotsForSubjectSection`. That is the discovery surface, and
 * it is scoped by a `student_subject_section` id — the one thing this journey
 * must not create until a request is actually sent. So this goes to the
 * underlying derivation instead and carries the same scope in a different form:
 * the caller has already resolved a child this user may act for, a subject, a
 * tutor who publishes it, and one of that tutor's own priced versions. The §7
 * boundary is unchanged; only where the context is held has moved.
 *
 * Duration and format come from the RESOLVED VERSION, never from the URL. A
 * family cannot widen their own availability by asking for a longer lesson than
 * the tutor sells, or a format the tutor does not deliver.
 */

/**
 * One block per bookable start, each a single step tall.
 *
 * Keeps the block id — and so the instant it stands for — completely intact:
 * only the drawn extent changes.
 */
function startMarkerBlocks(
  blocks: readonly CalendarBlock[],
  stepMinutes: number,
): readonly CalendarBlock[] {
  return blocks.map((block) => ({
    ...block,
    // Never longer than the lesson itself: a fifteen-minute lesson should not
    // be drawn as half an hour just because the grid is half-hourly.
    endMinutes: Math.min(block.endMinutes, block.startMinutes + stepMinutes),
    // The start, written on the marker. A block this small often has no room
    // for it, but it becomes the title attribute and the accessible name,
    // which is what a pointer and a screen reader read.
    label: clockLabel(block.startMinutes),
  }));
}

export interface BookingAvailability {
  readonly blocks: readonly CalendarBlock[];
  readonly window: ReturnType<typeof profileCalendarWindow>;
  readonly dayLabels: readonly string[];
  readonly rangeLabel: string;
  readonly summary: readonly string[];
  readonly todayIndex: number;
  readonly page: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
  /** Every slot on screen, so a chosen time can be checked against them. */
  readonly slots: readonly BookableSlot[];
}

export async function bookingAvailability(
  booking: ResolvedBooking,
  now: Date = new Date(),
): Promise<BookingAvailability | null> {
  const { tutor, version, format } = booking;
  if (tutor === null || version === null || format === null) return null;

  const view = availabilityView(booking.params.week, now, PLATFORM_TIME_ZONE);
  const byTutor = await bookableSlotsForTutors({
    tutorProfileIds: [tutor.tutorProfileId],
    from: view.from,
    to: view.to,
    durationMinutes: version.durationMinutes,
    formatCode: format,
    now,
  });
  const slots = byTutor.get(tutor.tutorProfileId) ?? [];

  /**
   * NOT MERGED, and drawn as START MARKERS rather than as whole lessons.
   *
   * `mergeContiguousBlocks` exists so a read-only calendar reads as "free from
   * four until seven" instead of as stripes. It must not be used here: the
   * family is picking a start, and four o'clock is a different choice from half
   * past four.
   *
   * But drawing each slot at its full length does not work either, and not only
   * because it looks like stripes. Slots are derived every half hour, so an
   * hour-long lesson at four overlaps the one at half past — and absolutely
   * positioned blocks that overlap COVER ONE ANOTHER, so every start but the
   * last became physically unclickable. A calendar nobody can click is worse
   * than an ugly one.
   *
   * So each block occupies its own step: it marks where a lesson would begin,
   * which is the thing being chosen, and the length is stated once in the
   * heading instead of redrawn behind every other option. Starts sit on a grid,
   * so markers tile instead of colliding.
   */
  const blocks = startMarkerBlocks(
    bookableSlotBlocks(slots, view.days, PLATFORM_TIME_ZONE),
    SLOT_STEP_MINUTES,
  );

  return {
    blocks,
    // Fitted to this tutor, exactly as their profile is: the family has already
    // chosen them, so hours nobody teaches are hours nobody needs to scan.
    window: profileCalendarWindow(blocks),
    dayLabels: view.dayLabels,
    rangeLabel: view.rangeLabel,
    summary: availabilitySummary(view.days, blocks),
    todayIndex: view.todayIndex,
    page: view.page,
    hasPrevious: view.hasPrevious,
    hasNext: view.hasNext,
    slots,
  };
}

/**
 * Which of the family's chosen times are still genuinely on offer.
 *
 * The review screen shows this so a family learns a time has gone BEFORE they
 * press send, rather than from an error afterwards. It is not the guarantee —
 * `createIntendedLessonRequest` re-derives availability inside its own
 * transaction and the exclusion constraint settles any race. This is courtesy;
 * that is correctness.
 */
export function stillBookable(
  times: readonly Date[],
  slots: readonly BookableSlot[],
): readonly Date[] {
  const starts = new Set(slots.map((slot) => slot.startAt.getTime()));
  return times.filter((at) => starts.has(at.getTime()));
}
