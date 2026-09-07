import type { CalendarBlock } from '@studdy/design-system';
import type { WeekDay } from '@/lib/availability/calendar-time';
import { availabilityView, type AvailabilityView } from '@/lib/discovery/availability-view';
import { PLATFORM_TIME_ZONE } from '@/lib/time';
import {
  ACTIVE_STUDENTS,
  EXCEPTIONS,
  JACOB,
  REFERENCES,
  STACEY,
  STUDENTS,
  priceFor,
  serviceById,
  studentBySlug,
  type Cadence,
  type DemoStudent,
} from './fixtures';
import { HOUR, bandBlocks, instantAt, weekdayOf, type Weekday } from './timeline';

/**
 * THE STANDING ARRANGEMENTS, PROJECTED ONTO REAL DATES.
 *
 * `fixtures.ts` says Jacob's lesson is Tuesdays at four. This turns that into
 * actual instants in the week a reviewer is looking at, and it is the only
 * place that conversion happens — so the dashboard, the bookings list, the
 * calendar, the lessons history and the parent's own screens are all reading
 * one projection rather than four that might disagree.
 *
 * Nothing here touches a database, a clock service or an environment variable.
 * It takes `now` and the fixtures, and returns the week.
 */

const WEEK_MS = 7 * 86_400_000;

export type LessonStatus = 'scheduled' | 'completed';

export interface DemoLesson {
  readonly id: string;
  readonly student: DemoStudent;
  readonly at: Date;
  readonly endAt: Date;
  readonly durationMinutes: number;
  readonly format: 'online' | 'in_person';
  readonly priceMinor: bigint;
  readonly status: LessonStatus;
  readonly kind: Cadence;
  /** What the lesson covered, or will. Null for a trial nobody has taught yet. */
  readonly topic: string | null;
}

export interface DemoOfferedTime {
  readonly id: string;
  readonly at: Date;
  readonly durationMinutes: number;
}

export interface DemoRequest {
  readonly reference: string;
  readonly slug: string;
  /** An existing student, or null when the family is new to Stacey. */
  readonly student: DemoStudent | null;
  readonly studentFirstName: string;
  readonly studentInitials: string;
  readonly schoolYear: number;
  readonly parentName: string;
  readonly serviceId: string;
  readonly durationMinutes: number;
  readonly format: 'online' | 'in_person';
  readonly priceMinor: bigint;
  readonly note: string;
  readonly offered: readonly DemoOfferedTime[];
  readonly respondByAt: Date;
  /** True when the deadline is close enough to be the one urgent thing on screen. */
  readonly urgent: boolean;
  readonly isExistingStudent: boolean;
}

/* ------------------------------------------------------------------ *
 * Days
 * ------------------------------------------------------------------ */

/** The seven days every demo calendar shares, starting today. */
export function demoWeek(now: Date = new Date()): AvailabilityView {
  return availabilityView(1, now, PLATFORM_TIME_ZONE);
}

/** Fourteen days, for the bookings horizon. */
export function demoFortnight(now: Date = new Date()): readonly WeekDay[] {
  return [
    ...availabilityView(1, now, PLATFORM_TIME_ZONE).days,
    ...availabilityView(2, now, PLATFORM_TIME_ZONE).days,
  ];
}

/* ------------------------------------------------------------------ *
 * Lessons
 * ------------------------------------------------------------------ */

function lessonAt(student: DemoStudent, day: WeekDay, status: LessonStatus, topic: string | null): DemoLesson {
  const at = instantAt(day, student.startMinutes);
  return {
    id: `${student.slug}-${day.date}`,
    student,
    at,
    endAt: new Date(at.getTime() + student.durationMinutes * 60_000),
    durationMinutes: student.durationMinutes,
    format: student.format,
    priceMinor: priceFor(student.durationMinutes),
    status,
    kind: student.cadence,
    topic,
  };
}

/**
 * Every lesson Stacey has committed to across `days`, soonest first.
 *
 * A weekly relationship recurs on each matching day; a one-off and a trial
 * happen ONCE, on the first matching day, which is why they cannot simply be
 * projected the same way. A paused relationship produces nothing at all — that
 * is what paused means, and showing Ethan's Monday as booked would be the
 * demo lying about time Stacey actually has free.
 */
export function committedLessons(
  days: readonly WeekDay[],
  now: Date = new Date(),
  includePast = false,
): readonly DemoLesson[] {
  const lessons: DemoLesson[] = [];
  const usedOnce = new Set<string>();

  for (const day of days) {
    for (const student of ACTIVE_STUDENTS) {
      if (weekdayOf(day) !== student.weekday) continue;
      if (student.cadence !== 'weekly') {
        if (usedOnce.has(student.slug)) continue;
        usedOnce.add(student.slug);
      }
      const done = instantAt(day, student.startMinutes + student.durationMinutes) <= now;
      if (done && !includePast) continue;
      lessons.push(
        lessonAt(student, day, done ? 'completed' : 'scheduled', student.recentTopics[0] ?? null),
      );
    }
  }
  return lessons.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/**
 * Lessons already taught, most recent first.
 *
 * Walked backwards a week at a time from each weekly relationship's next
 * occurrence. Studdy's zone shifts its clocks in late September and early
 * April; the history this generates sits inside one offset, so stepping by a
 * flat seven days cannot land on the wrong hour here.
 */
export function pastLessons(now: Date = new Date(), limit = 8): readonly DemoLesson[] {
  const week = demoWeek(now);
  const lessons: DemoLesson[] = [];

  for (const student of STUDENTS) {
    if (student.recentTopics.length === 0) continue;
    const day = week.days.find((candidate) => weekdayOf(candidate) === student.weekday);
    if (day === undefined) continue;

    const anchor = instantAt(day, student.startMinutes);
    student.recentTopics.forEach((topic, index) => {
      const at = new Date(anchor.getTime() - (index + 1) * WEEK_MS);
      if (at >= now) return;
      lessons.push({
        id: `${student.slug}-past-${String(index)}`,
        student,
        at,
        endAt: new Date(at.getTime() + student.durationMinutes * 60_000),
        durationMinutes: student.durationMinutes,
        format: student.format,
        priceMinor: priceFor(student.durationMinutes),
        status: 'completed',
        kind: student.cadence,
        topic,
      });
    });
  }

  return lessons.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}

/** The next lesson Stacey teaches, or null if her fortnight is empty. */
export function nextLesson(now: Date = new Date()): DemoLesson | null {
  return committedLessons(demoFortnight(now), now)[0] ?? null;
}

/**
 * Everything on today, INCLUDING lessons already taught.
 *
 * A tutor opening her workspace at half past five has not had a day with
 * nothing in it just because the afternoon is over — she taught at three
 * thirty. Filtering the past out of "today" is right for a booking list and
 * wrong for the line at the top of the page, so this is the one projection that
 * keeps it.
 */
export function lessonsToday(now: Date = new Date()): readonly DemoLesson[] {
  const week = demoWeek(now);
  const today = week.days[0];
  if (today === undefined) return [];
  return committedLessons(week.days, now, true).filter(
    (lesson) => lesson.at >= today.startAt && lesson.at < today.endAt,
  );
}

/** One student's lessons, past and upcoming. */
export function lessonsForStudent(slug: string, now: Date = new Date()): {
  readonly upcoming: readonly DemoLesson[];
  readonly past: readonly DemoLesson[];
} {
  return {
    upcoming: committedLessons(demoFortnight(now), now).filter(
      (lesson) => lesson.student.slug === slug,
    ),
    past: pastLessons(now, 40).filter((lesson) => lesson.student.slug === slug),
  };
}

export function lessonById(id: string, now: Date = new Date()): DemoLesson | null {
  return (
    pastLessons(now, 40).find((lesson) => lesson.id === id) ??
    committedLessons(demoFortnight(now), now).find((lesson) => lesson.id === id) ??
    null
  );
}

/* ------------------------------------------------------------------ *
 * Requests waiting on Stacey
 * ------------------------------------------------------------------ */

/** A time on the next occurrence of `weekday` at least one day out. */
function slot(days: readonly WeekDay[], weekday: Weekday, hours: number, now: Date): Date {
  const candidates = days.filter((day) => weekdayOf(day) === weekday);
  const future = candidates.find((day) => instantAt(day, hours * HOUR) > now);
  const day = future ?? candidates[0] ?? days[0];
  // `days` is never empty — it is always a whole projected week — so this
  // fallback exists to satisfy the type rather than to be reached.
  if (day === undefined) throw new Error('schedule: no days to place a slot in');
  return instantAt(day, hours * HOUR);
}

function offered(at: Date, durationMinutes: number): DemoOfferedTime {
  return { id: at.toISOString(), at, durationMinutes };
}

/**
 * The three requests in Stacey's inbox — deliberately three different decisions.
 *
 * Leo's is the only one carrying a real deadline, so it is the only row on the
 * dashboard that gets clay. If all three shouted, none of them would.
 *
 * Jacob's is the request the parent's rebooking journey sends. It is the same
 * object seen from the other side, which is the reason both journeys are worth
 * showing together.
 */
export function inboxRequests(now: Date = new Date()): readonly DemoRequest[] {
  const days = demoFortnight(now);
  const noonTomorrow = new Date(now.getTime() + 86_400_000);
  noonTomorrow.setHours(12, 0, 0, 0);

  const leo = studentBySlug('leo');
  const mia = studentBySlug('mia');
  if (leo === null || mia === null) {
    throw new Error('schedule: a student the inbox depends on is missing from the fixtures');
  }

  return [
    {
      reference: REFERENCES.leo,
      slug: 'leo-second-session',
      student: leo,
      studentFirstName: leo.firstName,
      studentInitials: leo.initials,
      schoolYear: leo.schoolYear,
      parentName: leo.parentName,
      serviceId: 'calculus',
      durationMinutes: 90,
      format: 'online',
      priceMinor: priceFor(90),
      note: 'Leo wants one more session on integration before the external. Either of these would work for us.',
      offered: [
        offered(slot(days, 'Mon', 17, now), 90),
        offered(slot(days, 'Sat', 9, now), 90),
      ],
      respondByAt: new Date(now.getTime() + 3 * 60 * 60 * 1000),
      urgent: true,
      isExistingStudent: true,
    },
    {
      reference: REFERENCES.rebookTutor,
      slug: 'jacob-extra-session',
      student: JACOB,
      studentFirstName: JACOB.firstName,
      studentInitials: JACOB.initials,
      schoolYear: JACOB.schoolYear,
      parentName: JACOB.parentName,
      serviceId: JACOB.serviceId,
      durationMinutes: 60,
      format: 'online',
      priceMinor: priceFor(60),
      note: 'Jacob has his algebra assessment in three weeks and would like one extra session on top of his Tuesday lesson. Either of these suits us.',
      offered: [
        offered(slot(days, 'Thu', 18, now), 60),
        offered(slot(days, 'Sat', 10, now), 60),
      ],
      respondByAt: noonTomorrow,
      urgent: false,
      isExistingStudent: true,
    },
    {
      reference: REFERENCES.mia,
      slug: 'mia-follow-up',
      student: mia,
      studentFirstName: mia.firstName,
      studentInitials: mia.initials,
      schoolYear: mia.schoolYear,
      parentName: mia.parentName,
      serviceId: mia.serviceId,
      durationMinutes: 60,
      format: 'in_person',
      priceMinor: priceFor(60),
      note: 'Mia really enjoyed the trial and would like to carry on. Could we keep the same Monday time each week?',
      offered: [offered(slot(days, 'Mon', 15.5, now), 60)],
      respondByAt: new Date(now.getTime() + 3 * 86_400_000),
      urgent: false,
      isExistingStudent: true,
    },
    {
      reference: REFERENCES.chloe,
      slug: 'chloe-first-lesson',
      student: null,
      studentFirstName: 'Chloe',
      studentInitials: 'CD',
      schoolYear: 12,
      parentName: 'Wei Deng',
      serviceId: 'ncea2',
      durationMinutes: 60,
      format: 'in_person',
      priceMinor: priceFor(60),
      note: 'Chloe is in Year 12 and finding the algebra harder than last year. We have not used a tutor before, so we are not sure what to expect.',
      offered: [
        offered(slot(days, 'Tue', 17.5, now), 60),
        offered(slot(days, 'Wed', 16, now), 60),
        offered(slot(days, 'Mon', 18.5, now), 60),
      ],
      respondByAt: new Date(now.getTime() + 2 * 86_400_000),
      urgent: false,
      isExistingStudent: false,
    },
  ];
}

export function requestBySlug(slug: string, now: Date = new Date()): DemoRequest | null {
  return inboxRequests(now).find((request) => request.slug === slug) ?? null;
}


/* ------------------------------------------------------------------ *
 * WHO IS LOOKING — the privacy boundary, crossed once and in one place
 * ------------------------------------------------------------------ */

/**
 * A calendar always has an audience, and the audience decides what a block is
 * allowed to say.
 *
 * `tutor` is Stacey looking at her own week: she sees her students by name,
 * because they are hers. A `{ family }` audience is a parent looking at that
 * same week to find a free hour, and they may see only their OWN child. Every
 * other lesson is real, occupies real time, and is labelled `Booked` — the time
 * is honest, the person is not disclosed.
 *
 * ENFORCED HERE, NOT ON THE PAGES. A page that forgets is a page that shows a
 * stranger another family's child, and "remember to relabel it" is not a
 * boundary. A test asserts that no other student's name survives a family
 * audience.
 */
export type Audience = 'tutor' | { readonly family: string };

function labelFor(audience: Audience, student: DemoStudent, once: boolean): string {
  if (audience === 'tutor') return once ? student.firstName + ' \u00b7 1\u00d7' : student.firstName;
  if (student.slug === audience.family) return student.firstName;
  return 'Booked';
}

function columnOf(days: readonly WeekDay[], at: Date): number {
  return days.findIndex((day) => at >= day.startAt && at < day.endAt);
}

function minutesInto(day: WeekDay, at: Date): number {
  return Math.round((at.getTime() - day.startAt.getTime()) / 60_000);
}

/* ------------------------------------------------------------------ *
 * One-off availability changes
 * ------------------------------------------------------------------ */

export interface DemoExceptionOccurrence {
  readonly id: string;
  readonly at: Date;
  readonly endAt: Date;
  readonly opens: boolean;
  readonly reason: string;
  readonly day: WeekDay;
}

/** The one-off changes that actually fall inside `days`. */
export function exceptionsIn(
  days: readonly WeekDay[],
  now: Date = new Date(),
): readonly DemoExceptionOccurrence[] {
  return days.flatMap((day) =>
    EXCEPTIONS.filter((exception) => weekdayOf(day) === exception.weekday).flatMap((exception) => {
      const at = instantAt(day, exception.startMinutes);
      const endAt = instantAt(day, exception.endMinutes);
      if (endAt <= now) return [];
      return [
        {
          id: exception.id + '-' + day.date,
          at,
          endAt,
          opens: exception.opens,
          reason: exception.reason,
          day,
        },
      ];
    }),
  );
}

/* ------------------------------------------------------------------ *
 * The week, for a given audience
 * ------------------------------------------------------------------ */

export interface WeekOptions {
  readonly audience: Audience;
  /** Draw the time a pending request is holding, in clay. Tutor-side only. */
  readonly includeHolds?: boolean;
  /** Include one-off availability changes as bookable time. */
  readonly includeExceptions?: boolean;
  /** An extra confirmed lesson the story has just created. */
  readonly extraLesson?:
    | { readonly at: Date; readonly durationMinutes: number; readonly label: string }
    | null;
}

interface Claim {
  readonly at: Date;
  readonly endAt: Date;
  readonly label: string;
  readonly role: 'lesson' | 'hold';
}

/**
 * Stacey's week as a calendar draws it, for whoever is looking.
 *
 * A committed lesson does not sit ON TOP of the availability it consumed — it
 * REPLACES that hour, and the band around it is split. Drawing both would
 * overstate the time she has free and would render as a tinted smudge rather
 * than as a lesson.
 */
export function weekBlocks(
  days: readonly WeekDay[],
  now: Date,
  options: WeekOptions,
): readonly CalendarBlock[] {
  const { audience, includeHolds = false, includeExceptions = true, extraLesson = null } = options;

  const claims: Claim[] = committedLessons(days, now).map((lesson) => ({
    at: lesson.at,
    endAt: lesson.endAt,
    label: labelFor(audience, lesson.student, lesson.kind !== 'weekly'),
    role: 'lesson' as const,
  }));

  if (extraLesson !== null) {
    claims.push({
      at: extraLesson.at,
      endAt: new Date(extraLesson.at.getTime() + extraLesson.durationMinutes * 60_000),
      label: extraLesson.label,
      role: 'lesson',
    });
  }

  if (includeHolds) {
    for (const request of inboxRequests(now)) {
      const first = request.offered[0];
      if (first === undefined) continue;
      claims.push({
        at: first.at,
        endAt: new Date(first.at.getTime() + first.durationMinutes * 60_000),
        label: 'Requested',
        role: 'hold',
      });
    }
  }

  const openHours: CalendarBlock[] = [
    ...bandBlocks(STACEY.bands, days, now),
    ...(includeExceptions
      ? exceptionsIn(days, now)
          .filter((exception) => exception.opens)
          .flatMap((exception) => {
            const column = columnOf(days, exception.at);
            const day = days[column];
            if (column === -1 || day === undefined) return [];
            return [
              {
                id: 'exception-' + exception.id,
                dayIndex: column,
                startMinutes: minutesInto(day, exception.at),
                endMinutes: minutesInto(day, exception.endAt),
                role: 'available_once' as const,
              },
            ];
          })
      : []),
  ];

  // Availability, minus every hour that has been sold or is being held.
  const availability = openHours.flatMap((block) => {
    let pieces: CalendarBlock[] = [block];
    for (const claim of claims) {
      const column = columnOf(days, claim.at);
      const day = days[column];
      if (column === -1 || day === undefined) continue;
      const from = minutesInto(day, claim.at);
      const to = minutesInto(day, claim.endAt);
      pieces = pieces.flatMap((piece) => {
        if (piece.dayIndex !== column || piece.startMinutes >= to || piece.endMinutes <= from) {
          return [piece];
        }
        return [
          ...(piece.startMinutes < from
            ? [{ ...piece, id: piece.id + '-a' + String(from), endMinutes: from }]
            : []),
          ...(piece.endMinutes > to
            ? [{ ...piece, id: piece.id + '-b' + String(to), startMinutes: to }]
            : []),
        ];
      });
    }
    return pieces;
  });

  const claimBlocks: CalendarBlock[] = claims.flatMap((claim) => {
    const column = columnOf(days, claim.at);
    const day = days[column];
    if (column === -1 || day === undefined) return [];
    return [
      {
        id: claim.role + '-' + claim.at.toISOString(),
        dayIndex: column,
        startMinutes: minutesInto(day, claim.at),
        endMinutes: minutesInto(day, claim.endAt),
        role: claim.role,
        label: claim.label,
      },
    ];
  });

  return [...availability, ...claimBlocks];
}

/** Stacey's own view. A name, because it reads better at call sites. */
export function staceyWeekBlocks(
  days: readonly WeekDay[],
  now: Date = new Date(),
  options: Omit<WeekOptions, 'audience'> = {},
): readonly CalendarBlock[] {
  return weekBlocks(days, now, { ...options, audience: 'tutor' });
}

/** What a family sees of the same week: their own child, and `Booked` elsewhere. */
export function familyWeekBlocks(
  days: readonly WeekDay[],
  now: Date = new Date(),
  familySlug: string = JACOB.slug,
  options: Omit<WeekOptions, 'audience' | 'includeHolds'> = {},
): readonly CalendarBlock[] {
  return weekBlocks(days, now, { ...options, audience: { family: familySlug } });
}

/** What Stacey earns across `days`, after Studdy's cut comes out of the price. */
export function weekTotals(days: readonly WeekDay[], now: Date = new Date()): {
  readonly lessons: number;
  readonly minutes: number;
  readonly grossMinor: bigint;
} {
  const lessons = committedLessons(days, now);
  return {
    lessons: lessons.length,
    minutes: lessons.reduce((total, lesson) => total + lesson.durationMinutes, 0),
    grossMinor: lessons.reduce((total, lesson) => total + lesson.priceMinor, 0n),
  };
}

export function serviceNameFor(student: DemoStudent): string {
  return serviceById(student.serviceId)?.name ?? 'Maths';
}
