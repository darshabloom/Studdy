import type { CalendarBlock } from '@studdy/design-system';
import type { WeekDay } from '@/lib/availability/calendar-time';
import { PLATFORM_TIME_ZONE } from '@/lib/time';
import {
  DISCOVERY_TUTOR_SLUG,
  JACOB,
  PAYMENT_WINDOW_MINUTES,
  PRIYA,
  REFERENCES,
  STACEY,
  money,
  physicsTutor,
  priceFor,
  serviceById,
  type DemoTutor,
} from './fixtures';
import {
  committedLessons,
  demoWeek,
  exceptionsIn,
  requestBySlug,
  type DemoLesson,
  type DemoRequest,
} from './schedule';
import { bookableStarts, instantAt, weekdayOf, type BookableStart } from './timeline';

/**
 * THE TWO PARENT JOURNEYS.
 *
 * They exist to argue one point together: what joining Studdy costs a family,
 * and what it is like once they are in. The discovery journey is long because a
 * stranger has to be chosen. The rebooking journey is short because everything
 * except *when* is already settled — and that contrast is the product.
 *
 * The rebooking story is NOT invented here. It reads the request that sits in
 * Stacey's inbox, so the lesson Priya asks for and the lesson Stacey is asked
 * about are one object. If they were built separately they would drift, and a
 * reviewer clicking between the two sides would catch it immediately.
 */

const CLOCK = new Intl.DateTimeFormat('en-NZ', {
  timeZone: PLATFORM_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
});
const DATE = new Intl.DateTimeFormat('en-NZ', {
  timeZone: PLATFORM_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** 'Thu 10 Sept, 6:00 – 7:00 pm' — the span, not a bare start. */
export function intervalLabel(at: Date, durationMinutes: number): string {
  const end = new Date(at.getTime() + durationMinutes * 60_000);
  return `${DATE.format(at).replace(',', '')}, ${CLOCK.format(at)} – ${CLOCK.format(end)}`;
}

/* ------------------------------------------------------------------ *
 * Rebooking — the strong flow
 * ------------------------------------------------------------------ */

export interface RebookStory {
  readonly request: DemoRequest;
  readonly week: ReturnType<typeof demoWeek>;
  /** Jacob's standing lesson, the one the extra session sits alongside. */
  readonly standing: DemoLesson | null;
  readonly accepted: Date;
  readonly durationMinutes: number;
  readonly priceMinor: bigint;
  readonly paymentDeadlineAt: Date;
  readonly reference: string;
}

export function rebookStory(now: Date = new Date(), chosen: readonly string[] = []): RebookStory {
  const request = requestBySlug('jacob-extra-session', now);
  // The request is defined in this module's own sibling, so a miss is a fixture
  // bug rather than a runtime condition.
  if (request === null) throw new Error('stories: the rebooking request is missing');

  const week = demoWeek(now);

  /*
   * WHAT THE VIEWER ACTUALLY PICKED, when they picked anything.
   *
   * The times step writes its selection into the URL and every screen after it
   * reads it back through here, so review, payment and the confirmed booking
   * describe the lesson that was chosen rather than a scripted one. An empty or
   * unrecognised list falls back to the script, which is what keeps an
   * untouched walkthrough identical every time — and stops a hand-edited URL
   * from producing a broken screen mid-presentation.
   */
  const picked = chosen
    .map((iso) => new Date(iso))
    .filter((at) => !Number.isNaN(at.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  const offered =
    picked.length > 0
      ? picked.map((at) => ({ id: at.toISOString(), at, durationMinutes: request.durationMinutes }))
      : request.offered;

  const accepted = offered[0]?.at;
  if (accepted === undefined) throw new Error('stories: the rebooking request offers no times');

  return {
    request: { ...request, offered },
    week,
    standing:
      committedLessons(week.days, now).find((lesson) => lesson.student.slug === JACOB.slug) ?? null,
    accepted,
    durationMinutes: request.durationMinutes,
    priceMinor: request.priceMinor,
    paymentDeadlineAt: new Date(now.getTime() + PAYMENT_WINDOW_MINUTES * 60_000),
    reference: REFERENCES.rebook,
  };
}

/** `?time=` as a list, from a Next.js search-params object. */
export function chosenTimes(raw: string | readonly string[] | undefined): readonly string[] {
  if (raw === undefined) return [];
  return Array.isArray(raw) ? [...raw] : [raw as string];
}

/** Carry a selection onto the next link, so the journey keeps it. */
export function withTimes(href: string, times: readonly string[]): string {
  if (times.length === 0) return href;
  const query = new URLSearchParams();
  for (const iso of times) query.append('time', iso);
  return `${href}?${query.toString()}`;
}

/**
 * The starts Priya can actually choose from, with Stacey's committed lessons
 * removed.
 *
 * Jacob's own Tuesday lesson is one of the things removed, which is the detail
 * that makes this screen worth building: his usual slot is unavailable BECAUSE
 * IT IS ALREADY HIS. The times screen says so rather than silently omitting it.
 */
export function rebookStarts(now: Date = new Date()): readonly BookableStart[] {
  const week = demoWeek(now);
  const taken = committedLessons(week.days, now);
  const exceptionBands = exceptionsIn(week.days, now)
    .filter((exception) => exception.opens)
    .map((exception) => ({
      weekday: weekdayOf(exception.day),
      startMinutes: Math.round(
        (exception.at.getTime() - exception.day.startAt.getTime()) / 60_000,
      ),
      endMinutes: Math.round(
        (exception.endAt.getTime() - exception.day.startAt.getTime()) / 60_000,
      ),
    }));

  return bookableStarts(
    [...STACEY.bands, ...exceptionBands],
    week.days,
    JACOB.durationMinutes,
    now,
  ).filter(
    (start) =>
      !taken.some(
        (lesson) =>
          start.at < lesson.endAt &&
          lesson.at < new Date(start.at.getTime() + JACOB.durationMinutes * 60_000),
      ),
  );
}

/** Where Jacob's standing lesson sits this week, so the picker can name it. */
export function standingSlotLabel(now: Date = new Date()): string | null {
  const week = demoWeek(now);
  const day = week.days.find((candidate) => weekdayOf(candidate) === JACOB.weekday);
  if (day === undefined) return null;
  return intervalLabel(instantAt(day, JACOB.startMinutes), JACOB.durationMinutes);
}

/* ------------------------------------------------------------------ *
 * Discovery — Physics, which Stacey does not teach
 * ------------------------------------------------------------------ */

export interface DiscoveryStory {
  readonly tutor: DemoTutor;
  readonly week: ReturnType<typeof demoWeek>;
  readonly offered: readonly Date[];
  readonly accepted: Date;
  readonly durationMinutes: number;
  readonly priceMinor: bigint;
  readonly formatCode: 'online' | 'in_person';
  readonly respondByAt: Date;
  readonly paymentDeadlineAt: Date;
  readonly reference: string;
}

export function discoveryStory(
  now: Date = new Date(),
  chosen: readonly string[] = [],
): DiscoveryStory {
  const tutor = physicsTutor(DISCOVERY_TUTOR_SLUG);
  if (tutor === null) throw new Error('stories: the discovery tutor is missing');

  const week = demoWeek(now);
  const starts = bookableStarts(tutor.bands, week.days, 60, now);

  // Two clear days out where the week allows it. A lesson three hours away
  // cannot plausibly be "held while your tutor replies".
  const preferred = starts.filter((start) => start.block.dayIndex >= 2);
  const pool = preferred.length >= 2 ? preferred : starts;
  const first = pool[0];
  const second = pool.find((start) => start.day.date !== first?.day.date) ?? pool[1];
  if (first === undefined || second === undefined) {
    throw new Error('stories: not enough bookable time in the discovery week');
  }

  const picked = chosen
    .map((iso) => new Date(iso))
    .filter((at) => !Number.isNaN(at.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  const offeredTimes = picked.length > 0 ? picked : [first.at, second.at];
  const accepted = offeredTimes[0] ?? first.at;
  const dayBefore = new Date(accepted.getTime() - 86_400_000);

  return {
    tutor,
    week,
    offered: offeredTimes,
    accepted,
    durationMinutes: 60,
    priceMinor: tutor.hourlyMinor,
    formatCode: tutor.offersOnline ? 'online' : 'in_person',
    // A round local hour, not the lesson time minus an interval — subtracting
    // twelve hours from a four o'clock lesson produces a 4:00 am deadline that
    // no real product would ever set.
    respondByAt: new Date(
      Date.UTC(
        dayBefore.getUTCFullYear(),
        dayBefore.getUTCMonth(),
        dayBefore.getUTCDate(),
        dayBefore.getUTCHours(),
        0,
        0,
      ),
    ),
    paymentDeadlineAt: new Date(now.getTime() + PAYMENT_WINDOW_MINUTES * 60_000),
    reference: REFERENCES.discovery,
  };
}

/** A physics tutor's week as read-only bands, for cards and profiles. */
export function tutorBands(tutor: DemoTutor, days: readonly WeekDay[], now: Date): readonly CalendarBlock[] {
  return bookableStarts(tutor.bands, days, 60, now).map((start) => start.block);
}

/* ------------------------------------------------------------------ *
 * Shared copy
 * ------------------------------------------------------------------ */

export const FAMILY = {
  parent: PRIYA,
  student: JACOB,
  tutor: STACEY,
} as const;

export function serviceName(): string {
  return serviceById(JACOB.serviceId)?.name ?? 'Maths';
}

export function rebookPriceLabel(): string {
  return money(priceFor(JACOB.durationMinutes));
}
