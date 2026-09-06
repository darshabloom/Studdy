import type { CalendarBlock } from '@studdy/design-system';
import type { WeekDay } from '@/lib/availability/calendar-time';
import type { AvailabilityView } from '@/lib/discovery/availability-view';
import { PLATFORM_TIME_ZONE } from '@/lib/time';
import { formatLessonDateTime } from '@/components/requests/request-status';
import {
  DEMO_CURRENCY,
  DEMO_DURATION_MINUTES,
  DEMO_FAMILY,
  DEMO_FORMAT,
  DEMO_PAYMENT_WINDOW_MINUTES,
  DEMO_REFERENCES,
  STORY_TUTOR_SLUG,
  demoTutor,
  type DemoTutor,
} from './fixtures';
import {
  DEMO_CALENDAR_WINDOW,
  bandBlocks,
  demoWeek,
  instantAt,
  startId,
  weekdayOf,
  type DemoBand,
} from './timeline';

/**
 * THE SCRIPTED STORY, assembled from the cast and today's date.
 *
 * One lesson, seen from both sides. The parent's confirmed booking and the
 * tutor's confirmed calendar block are THE SAME OBJECT computed once here —
 * which is the whole reason the two demo journeys are worth showing together.
 * If they were composed separately they would drift, and a reviewer clicking
 * from one to the other would catch it immediately.
 *
 * Called fresh on every render. It reads `new Date()` and nothing else: no
 * database, no session, no environment, no store. Two people opening the demo
 * at once get the same story, and so does the same person tomorrow.
 */

export interface DemoTime {
  /** Stable across renders within a day — the date and clock of the start. */
  readonly id: string;
  readonly day: WeekDay;
  readonly startMinutes: number;
  readonly at: Date;
  /** 'Tuesday 9 September, 4:00 pm' */
  readonly label: string;
}

export interface DemoStory {
  readonly week: AvailabilityView;
  readonly tutor: DemoTutor;
  /** Both times the family offered, in the order they chose them. */
  readonly offered: readonly DemoTime[];
  /** The one the tutor accepted — always the first offered. */
  readonly accepted: DemoTime;
  readonly durationMinutes: number;
  readonly formatCode: 'online' | 'in_person';
  readonly priceAmountMinor: bigint;
  readonly currencyCode: string;
  readonly respondByAt: Date;
  readonly decisionDeadlineAt: Date;
  readonly paymentDeadlineAt: Date;
  readonly holdExpiresAt: Date;
  readonly reference: string;
  readonly tutorRequestReference: string;
  readonly timeZone: string;
}

export function demoStory(now: Date = new Date()): DemoStory {
  const week = demoWeek(now);
  const tutor = demoTutor(STORY_TUTOR_SLUG);
  // The story tutor is a constant in this module's own fixture file, so this
  // cannot fail at runtime; the check keeps the types honest rather than
  // inventing a stand-in tutor that would silently change the story.
  if (tutor === null) throw new Error(`demoStory: missing story tutor '${STORY_TUTOR_SLUG}'`);

  const offered = pickOfferedTimes(tutor.bands, week.days);
  const accepted = offered[0];
  if (accepted === undefined) throw new Error('demoStory: no bookable time in the demo week');

  // Deadlines land on ROUND LOCAL HOURS on the day before the lesson, rather
  // than on the lesson's own time minus an interval. Subtracting twelve hours
  // from a four o'clock lesson produces a "choose a tutor by 4:00 am" that no
  // real product would ever set, and a reviewer reads that as carelessness
  // before they read anything else on the screen.
  //
  // The day before always exists: offered times are picked at least two days
  // into the window.
  const acceptedColumn = week.days.findIndex((day) => day.date === accepted.day.date);
  const dayBefore = week.days[Math.max(acceptedColumn - 1, 0)] ?? accepted.day;
  const respondByAt = instantAt(dayBefore, 12 * 60);
  const decisionDeadlineAt = instantAt(dayBefore, 20 * 60);

  return {
    week,
    tutor,
    offered,
    accepted,
    durationMinutes: DEMO_DURATION_MINUTES,
    formatCode: DEMO_FORMAT,
    priceAmountMinor: tutor.startingPriceAmountMinor,
    currencyCode: DEMO_CURRENCY,
    // Anchored on the LESSON, not on now: a reply deadline that has already
    // passed is the fastest way to make a demo look broken.
    respondByAt,
    decisionDeadlineAt,
    paymentDeadlineAt: new Date(now.getTime() + DEMO_PAYMENT_WINDOW_MINUTES * 60_000),
    holdExpiresAt: decisionDeadlineAt,
    reference: DEMO_REFERENCES.request,
    tutorRequestReference: DEMO_REFERENCES.tutorRequest,
    timeZone: PLATFORM_TIME_ZONE,
  };
}

/**
 * The two times the family offered.
 *
 * Chosen by COLUMN rather than by weekday name. A fixed 'Tuesday and Thursday'
 * would land on today whenever the demo was opened on a Tuesday, and a lesson
 * three hours away cannot plausibly be "held while your tutor replies". Taking
 * the first two teaching days at least two columns out keeps the lesson a few
 * days off whatever day the reviewer arrives, which is what the copy assumes.
 */
function pickOfferedTimes(
  bands: readonly DemoBand[],
  days: readonly WeekDay[],
): readonly DemoTime[] {
  const teaching = days
    .map((day, columnIndex) => ({
      day,
      columnIndex,
      band: bands.find((candidate) => candidate.weekday === weekdayOf(day)) ?? null,
    }))
    .filter((entry): entry is { day: WeekDay; columnIndex: number; band: DemoBand } =>
      entry.band !== null,
    );

  // Two clear days out where the week allows it, and never fewer than two
  // times — offering alternatives is the point of the request model.
  const preferred = teaching.filter((entry) => entry.columnIndex >= 2);
  const chosen = (preferred.length >= 2 ? preferred : teaching).slice(0, 2);

  // A half hour into the band, then an hour into the next — two ordinary
  // after-school starts rather than the edge of the tutor's day.
  return chosen.map((entry, index) => {
    const startMinutes = entry.band.startMinutes + (index === 0 ? 30 : 60);
    return demoTime(entry.day, startMinutes);
  });
}

export function demoTime(day: WeekDay, startMinutes: number): DemoTime {
  const at = instantAt(day, startMinutes);
  return {
    id: startId(day, startMinutes),
    day,
    startMinutes,
    at,
    label: formatLessonDateTime(at, PLATFORM_TIME_ZONE),
  };
}

/** A tutor's teaching week as read-only bands, for the profile and cards. */
export function availabilityBlocks(
  tutor: DemoTutor,
  days: readonly WeekDay[],
): readonly CalendarBlock[] {
  return bandBlocks(tutor.bands, days);
}

/**
 * The tutor's own week once the lesson is confirmed.
 *
 * The lesson does not sit ON TOP of the availability it consumed — it REPLACES
 * that hour, and the band around it is split. Drawing the two overlapping is
 * both wrong and unreadable: wrong because a booked hour is no longer bookable
 * and a calendar that shows it as both is claiming time the tutor has already
 * sold, and unreadable because a green block over a lavender one is a green
 * tint rather than a lesson.
 *
 * Uses the same `lesson` role the production tutor calendar uses, so the green
 * block a reviewer sees here is the treatment they would see in the product.
 */
export function tutorWeekWithLesson(
  story: DemoStory,
  accepted: DemoTime = story.accepted,
): readonly CalendarBlock[] {
  const columnIndex = story.week.days.findIndex((day) => day.date === accepted.day.date);
  const lessonStart = accepted.startMinutes;
  const lessonEnd = lessonStart + story.durationMinutes;

  const availability = availabilityBlocks(story.tutor, story.week.days).flatMap((block) => {
    const overlaps =
      block.dayIndex === columnIndex &&
      block.startMinutes < lessonEnd &&
      block.endMinutes > lessonStart;
    if (!overlaps) return [block];

    // Whatever is left of the band before and after the lesson. Either piece
    // can be empty — a lesson at the very start of a band leaves nothing above
    // it — and a zero-length block is dropped rather than drawn as a hairline.
    return [
      ...(block.startMinutes < lessonStart
        ? [{ ...block, id: `${block.id}-before`, endMinutes: lessonStart }]
        : []),
      ...(block.endMinutes > lessonEnd
        ? [{ ...block, id: `${block.id}-after`, startMinutes: lessonEnd }]
        : []),
    ];
  });

  const lesson: CalendarBlock = {
    id: `lesson-${accepted.id}`,
    dayIndex: columnIndex,
    startMinutes: lessonStart,
    endMinutes: lessonEnd,
    role: 'lesson',
    label: DEMO_FAMILY.studentPreferredName,
  };
  return [...availability, lesson];
}

/**
 * Which offered time the tutor accepted, from an optional `?time=` parameter.
 *
 * The tutor screens let a reviewer accept either time the family offered, and
 * carry the choice in the URL so the accepted state and the confirmed calendar
 * agree with what was actually clicked. Anything unrecognised falls back to the
 * scripted time rather than erroring — a hand-edited URL should not be able to
 * produce a broken screen in a demo someone is presenting from.
 */
export function acceptedTime(story: DemoStory, iso: string | undefined): DemoTime {
  if (iso === undefined) return story.accepted;
  return story.offered.find((time) => time.at.toISOString() === iso) ?? story.accepted;
}

export { DEMO_CALENDAR_WINDOW };
