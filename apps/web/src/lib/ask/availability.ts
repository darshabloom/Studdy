import 'server-only';
import { bookableSlotsForTutors } from '@studdy/database';
// Imported rather than restated, exactly as the single-tutor journey does: a
// marker is as tall as the distance to the next possible start, so a local
// copy that drifted would draw options overlapping or with false gaps.
import { SLOT_STEP_MINUTES, combineSlotsByStart } from '@studdy/domain/availability';
import { clockLabel, type CalendarBlock } from '@studdy/design-system';
import { bookableSlotBlocks, profileCalendarWindow } from '../availability/calendar-projection';
import { availabilitySummary, availabilityView } from '../discovery/availability-view';
import { PLATFORM_TIME_ZONE } from '../time';
import type { ResolvedAsk } from './resolve';

/**
 * The combined bookable time of the tutors this request will actually reach.
 *
 * THE SAME DERIVATION THE SINGLE-TUTOR JOURNEY USES, over several tutors. It
 * goes to `bookableSlotsForTutors` rather than to `bookableSlotsForSubjectSection`
 * for a reason that matters here more than it does in discovery: the section
 * query derives at each tutor's own CHEAPEST published length and takes no
 * format at all, because it exists to draw discovery cards. This journey has
 * already settled one shared length and one shared format, and drawing starts
 * derived for a different lesson would offer the family times the request
 * cannot deliver. Duration and format come from the RESOLVED answers, never
 * straight from the URL.
 *
 * DRAWN FROM THE INCLUDED TUTORS ONLY. A start only an excluded tutor could do
 * is not a time this request can ask about, and the exclusions are already
 * explained on their own terms elsewhere.
 *
 * The privacy boundary is unchanged and sits where it always has: only positive
 * derived slots come back from the repository, so a gap here is
 * indistinguishable between booked, blocked, held, on holiday and outside
 * working hours. What is said about a chosen time is scoped to the family's OWN
 * included tutors — never to the platform, and never to a tutor they have not
 * saved.
 */

export interface AskAvailability {
  readonly blocks: readonly CalendarBlock[];
  readonly window: ReturnType<typeof profileCalendarWindow>;
  readonly dayLabels: readonly string[];
  readonly rangeLabel: string;
  readonly summary: readonly string[];
  readonly todayIndex: number;
  readonly page: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
  /**
   * Which of the family's own included tutors can do each start, keyed by ISO.
   *
   * First names, because that is what the shortlist already showed them. A
   * tutor absent from a start is simply absent: there is no vocabulary here for
   * saying a time was taken, blocked or outside their hours.
   */
  readonly namesByStart: Readonly<Record<string, readonly string[]>>;
}

/**
 * One block per bookable start, each a single step tall.
 *
 * The same reasoning as `/book`: slots derived every fifteen minutes and drawn
 * at their full lesson length OVERLAP, and an absolutely positioned block
 * covers the one beneath it, so every start but the last becomes physically
 * unclickable. A marker occupies its own step instead, which is also the thing
 * being chosen; the length is stated once in the heading.
 *
 * A MARKER CARRIES ITS START TIME AND NOTHING ELSE, exactly as `/book` does.
 *
 * How many tutors can do a start was tried on the marker itself, as a ratio,
 * and it made the week unreadable — a second line on every one of a hundred and
 * eighty quarter-hour blocks, worst on a phone. The parent's job on this grid is
 * to find times that suit their family; which tutors a time reaches only becomes
 * a decision once a time is in hand. So the compatibility data is derived and
 * kept (`namesByStart`) but spent BELOW the calendar, against the times actually
 * chosen, where it is short enough to name the tutors instead of counting them.
 */
function startMarkerBlocks(
  blocks: readonly CalendarBlock[],
  stepMinutes: number,
): readonly CalendarBlock[] {
  return blocks.map((block) => ({
    ...block,
    // Never longer than the lesson itself.
    endMinutes: Math.min(block.endMinutes, block.startMinutes + stepMinutes),
    // Compact, because the heading has just said how long the lesson is and who
    // is being asked. It becomes the title and the accessible name too, which
    // is what a pointer and a screen reader read.
    label: clockLabel(block.startMinutes),
  }));
}

export async function askAvailability(
  ask: ResolvedAsk,
  now: Date = new Date(),
): Promise<AskAvailability | null> {
  const { eligibility, params } = ask;
  const { duration, format } = params;
  if (duration === null || format === null || eligibility === null) return null;

  const included = eligibility.included;
  // Nobody to ask means nothing to draw. `resolveAsk` already sends this family
  // to review, where the exclusions are explained; the guard keeps this
  // function honest rather than relying on that.
  if (included.length === 0) return null;

  const view = availabilityView(params.week, now, PLATFORM_TIME_ZONE);
  const byTutor = await bookableSlotsForTutors({
    tutorProfileIds: included.map((entry) => entry.tutorProfileId),
    from: view.from,
    to: view.to,
    durationMinutes: duration,
    formatCode: format,
    now,
  });

  /**
   * One entry per START, carrying who can do it.
   *
   * Matching on the start instant is the whole point: every included tutor
   * shares one length, so a start means exactly one interval for all of them,
   * which is why the length is asked first and why a chosen time can be written
   * as `4:15–5:15 pm` at all.
   */
  const combined = combineSlotsByStart(
    included.map((entry) => ({
      tutorReference: entry.tutorReference,
      slots: byTutor.get(entry.tutorProfileId) ?? [],
    })),
  );

  const nameByReference = new Map(included.map((entry) => [entry.tutorReference, entry.firstName]));
  const namesByStart: Record<string, readonly string[]> = {};
  for (const slot of combined) {
    namesByStart[slot.startAt.toISOString()] = slot.tutorReferences.map(
      (reference) => nameByReference.get(reference) ?? 'A tutor',
    );
  }

  const blocks = startMarkerBlocks(
    bookableSlotBlocks(
      // The union, as the two-instants shape every family-facing projection
      // takes. The end is the lesson's own end, shared by all of them.
      combined.map((slot) => ({
        startAt: slot.startAt,
        endAt: new Date(slot.startAt.getTime() + duration * 60_000),
      })),
      view.days,
      PLATFORM_TIME_ZONE,
    ),
    SLOT_STEP_MINUTES,
  );

  return {
    blocks,
    // Fitted to the tutors being asked, as the single-tutor journey fits to the
    // one tutor chosen: the family has already settled who this reaches, so
    // hours none of them teach are hours nobody needs to scan.
    window: profileCalendarWindow(blocks),
    dayLabels: view.dayLabels,
    rangeLabel: view.rangeLabel,
    summary: availabilitySummary(view.days, blocks),
    todayIndex: view.todayIndex,
    page: view.page,
    hasPrevious: view.hasPrevious,
    hasNext: view.hasNext,
    namesByStart,
  };
}

/**
 * 'Aroha', 'Aroha and James', 'Aroha, James and Mei'.
 *
 * The family's own included tutors, listed in full rather than counted, for the
 * moment a time has been CHOSEN — a chip leaves the calendar's context and gets
 * read on its own, so `2 of 3` there would be a number with nothing to attach
 * itself to.
 */
export function tutorNameList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${String(names[names.length - 1])}`;
}
