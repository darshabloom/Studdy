import type { CalendarBlock } from '@studdy/design-system';
import { mondayOf, shiftDate, weekDays, type WeekDay } from '@/lib/availability/calendar-time';
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
  split,
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

/**
 * Whether the family still owes for this lesson.
 *
 * Almost everything is `paid` — a lesson is only booked once the money has
 * cleared, so a settled state is the normal one. `due` is the single lesson the
 * demo holds in the gap between a tutor accepting and a family paying, and it
 * is what makes `Needs attention` render with something real in it.
 */
export type PaymentState = 'paid' | 'due';

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
  readonly payment: PaymentState;
  /** When the payment window closes. Null once there is nothing to pay. */
  readonly payBy: Date | null;
}

export interface DemoOfferedTime {
  readonly id: string;
  readonly at: Date;
  readonly durationMinutes: number;
}

/**
 * WHERE A REQUEST HAS GOT TO.
 *
 * `awaiting_tutor` is Stacey's inbox. `awaiting_family` is the stage after she
 * has accepted: the hour is held, the lesson is not booked, and the family owes
 * for it. Both are real states of the same object, and modelling the second one
 * is what lets a single extra session appear as an unpaid lesson on Priya's
 * dashboard and as a hold on Stacey's calendar without being two things.
 */
export type RequestStage = 'awaiting_tutor' | 'awaiting_family';

export interface DemoRequest {
  readonly stage: RequestStage;
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

/**
 * A MONDAY-FIRST WEEK — which is not what production's `availabilityView`
 * gives, and deliberately so on both sides.
 *
 * Discovery anchors its week on TODAY, because a stranger arriving on a
 * Saturday should not spend five of seven columns on days that have gone. That
 * is right for a cold search and wrong for everything else in this demo: a week
 * that starts on Wednesday because it happens to be Wednesday reads as broken,
 * and a tutor arranging a repeating week thinks in Mondays.
 *
 * So the demo builds its own. Elapsed days keep their column and are drawn as
 * past rather than dropped — the honest answer to "why is Monday empty" is
 * "Monday has gone", and removing it would make the week lie about which day
 * each column is.
 */
export interface DemoWeek {
  readonly days: readonly WeekDay[];
  /** 'Mon 14 Sept' */
  readonly dayLabels: readonly string[];
  /** 'Mon 14 Sept – Sun 20 Sept' */
  readonly rangeLabel: string;
  /** Which column is today, or -1 when the week shown is not the current one. */
  readonly todayIndex: number;
  /** How many leading columns are already in the past. */
  readonly pastCount: number;
}

export interface DemoWeekOptions {
  /** 5 for a working week, 7 to reach the weekend. */
  readonly dayCount?: 5 | 7;
  /** 0 is this week, 1 the next. */
  readonly weekOffset?: number;
}

export function demoWeek(now: Date = new Date(), options: DemoWeekOptions = {}): DemoWeek {
  const { dayCount = 7, weekOffset = 0 } = options;
  const monday = shiftDate(mondayOf(now, PLATFORM_TIME_ZONE), weekOffset * 7);
  const days = weekDays(monday, PLATFORM_TIME_ZONE).slice(0, dayCount);

  const first = days[0];
  const last = days[days.length - 1];
  if (first === undefined || last === undefined) {
    throw new Error('schedule: could not build a demo week');
  }

  return {
    days,
    dayLabels: days.map((day) => day.label),
    rangeLabel: `${first.label} – ${last.label}`,
    todayIndex: days.findIndex((day) => day.startAt <= now && now < day.endAt),
    pastCount: days.filter((day) => day.endAt <= now).length,
  };
}

/** The discovery week, still anchored on today — a cold search is the one case that wants it. */
export function discoveryWeek(now: Date = new Date()): AvailabilityView {
  return availabilityView(1, now, PLATFORM_TIME_ZONE);
}

/** Fourteen days from this Monday, for the bookings horizon. */
export function demoFortnight(now: Date = new Date()): readonly WeekDay[] {
  return [
    ...demoWeek(now, { dayCount: 7 }).days,
    ...demoWeek(now, { dayCount: 7, weekOffset: 1 }).days,
  ];
}

/* ------------------------------------------------------------------ *
 * Lessons
 * ------------------------------------------------------------------ */

function lessonAt(
  student: DemoStudent,
  day: WeekDay,
  status: LessonStatus,
  topic: string | null,
): DemoLesson {
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
    // A standing lesson is on the books because it was paid for. The one
    // unsettled lesson in the demo is built in `extraSession`, not here.
    payment: 'paid',
    payBy: null,
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
  const week = demoWeek(now, { dayCount: 7 });
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
        payment: 'paid',
        payBy: null,
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
  const week = demoWeek(now, { dayCount: 7 });
  const today = week.days[week.todayIndex];
  if (today === undefined) return [];
  return committedLessons(week.days, now, true).filter(
    (lesson) => lesson.at >= today.startAt && lesson.at < today.endAt,
  );
}

/**
 * One student's lessons, past and upcoming.
 *
 * `family` decides whether the unsettled extra session is in the list. It is a
 * real obligation on the family's side and belongs on their screens; on the
 * tutor's it is a HOLD, not a booking, and is drawn on her calendar and listed
 * under held time rather than counted among the lessons she has sold.
 */
export function lessonsForStudent(
  slug: string,
  now: Date = new Date(),
  options: { readonly family?: boolean; readonly paid?: boolean } = {},
): {
  readonly upcoming: readonly DemoLesson[];
  readonly past: readonly DemoLesson[];
} {
  const days = demoFortnight(now);
  const upcoming =
    options.family === true
      ? familyLessons(days, now, [slug], { paid: options.paid ?? false })
      : committedLessons(days, now).filter((lesson) => lesson.student.slug === slug);
  return {
    upcoming,
    past: pastLessons(now, 40).filter((lesson) => lesson.student.slug === slug),
  };
}

export function lessonById(
  id: string,
  now: Date = new Date(),
  options: { readonly paid?: boolean } = {},
): DemoLesson | null {
  const extra = extraSession(now, options.paid ?? false);
  if (extra !== null && extra.id === id) return extra;
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
 * EVERY REQUEST IN PLAY, at whatever stage it has reached.
 *
 * Three are waiting on Stacey and are deliberately three different decisions —
 * Leo's is the only one carrying a real deadline, so it is the only row on the
 * dashboard that gets clay. If all three shouted, none of them would.
 *
 * Jacob's has moved on: Stacey has accepted it, so it has left her inbox and is
 * now waiting on his family to pay. It is the same object the parent's
 * rebooking journey sends, seen at a later stage, and that single shared object
 * is what keeps the unpaid lesson on Priya's dashboard, the payment screen and
 * the hold on Stacey's calendar describing one session rather than three.
 */
function allRequests(now: Date = new Date()): readonly DemoRequest[] {
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
      stage: 'awaiting_tutor',
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
      offered: [offered(slot(days, 'Mon', 17, now), 90), offered(slot(days, 'Sat', 9, now), 90)],
      respondByAt: new Date(now.getTime() + 3 * 60 * 60 * 1000),
      urgent: true,
      isExistingStudent: true,
    },
    {
      // ACCEPTED ALREADY. Stacey took the Thursday; the family owes for it.
      stage: 'awaiting_family',
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
      offered: [offered(slot(days, 'Thu', 18, now), 60), offered(slot(days, 'Sat', 10, now), 60)],
      respondByAt: noonTomorrow,
      urgent: false,
      isExistingStudent: true,
    },
    {
      stage: 'awaiting_tutor',
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
      stage: 'awaiting_tutor',
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

/** What is actually waiting on Stacey to answer. The inbox, and its badge. */
export function inboxRequests(now: Date = new Date()): readonly DemoRequest[] {
  return allRequests(now).filter((request) => request.stage === 'awaiting_tutor');
}

/** Accepted, held, and waiting on a family to pay. */
export function heldRequests(now: Date = new Date()): readonly DemoRequest[] {
  return allRequests(now).filter((request) => request.stage === 'awaiting_family');
}

export function requestBySlug(slug: string, now: Date = new Date()): DemoRequest | null {
  return allRequests(now).find((request) => request.slug === slug) ?? null;
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
  /**
   * Keep lessons that have already been taught.
   *
   * A Monday-first week opened on a Wednesday still has Monday and Tuesday in
   * it, and a tutor expects to see what she taught on them. Bookable time is a
   * different question and is always clamped to the future — nobody can sell
   * Monday afternoon on Wednesday.
   */
  readonly includePast?: boolean;
  /** An extra confirmed lesson the story has just created. */
  readonly extraLesson?: {
    readonly at: Date;
    readonly durationMinutes: number;
    readonly label: string;
  } | null;
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
  const {
    audience,
    includeHolds = false,
    includeExceptions = true,
    includePast = false,
    extraLesson = null,
  } = options;

  const claims: Claim[] = committedLessons(days, now, includePast).map((lesson) => ({
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
    for (const request of allRequests(now)) {
      const first = request.offered[0];
      if (first === undefined) continue;
      claims.push({
        at: first.at,
        endAt: new Date(first.at.getTime() + first.durationMinutes * 60_000),
        // Two different holds, and a tutor needs to tell them apart: one is a
        // decision she still owes somebody, the other is an hour she has
        // already promised and is waiting to be paid for. Neither names a
        // student to a family audience.
        label:
          audience !== 'tutor'
            ? 'Held'
            : request.stage === 'awaiting_family'
              ? `${request.studentFirstName} · unpaid`
              : 'Requested',
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

/**
 * What Stacey earns across `days`, after Studdy's cut comes out of the price.
 *
 * NET IS THE HEADLINE, and gross is kept beside it rather than dropped. A tutor
 * asking "what did this week make me" is asking what lands in her account; a
 * dashboard answering with the families' total spend overstates her income by
 * fifteen per cent every time she looks at it. The gross figure still matters —
 * it is what the families paid — so both travel together and the pages that
 * show one can always show the breakdown.
 */
export function weekTotals(
  days: readonly WeekDay[],
  now: Date = new Date(),
): {
  readonly lessons: number;
  readonly minutes: number;
  readonly grossMinor: bigint;
  readonly feeMinor: bigint;
  readonly netMinor: bigint;
} {
  /*
   * THE WHOLE WEEK, INCLUDING WHAT SHE HAS ALREADY TAUGHT.
   *
   * This line answers "what does this week make me", and a tutor opening it on
   * Thursday has not stopped earning from Monday. Counting only what is left
   * showed her one lesson and $46.75 on a week with four lessons in it — a
   * figure that shrank every afternoon and was never the number she wanted.
   */
  const lessons = committedLessons(days, now, true);
  const grossMinor = lessons.reduce((total, lesson) => total + lesson.priceMinor, 0n);
  // Summed per lesson, not taken off the total: the fee is rounded on each
  // lesson, so a week's fee is the sum of the roundings rather than a rounding
  // of the sum. The payout page and this line have to agree to the cent.
  const feeMinor = lessons.reduce((total, lesson) => total + split(lesson.priceMinor).feeMinor, 0n);
  return {
    lessons: lessons.length,
    minutes: lessons.reduce((total, lesson) => total + lesson.durationMinutes, 0),
    grossMinor,
    feeMinor,
    netMinor: grossMinor - feeMinor,
  };
}

export function serviceNameFor(student: DemoStudent): string {
  return serviceById(student.serviceId)?.name ?? 'Maths';
}

/* ------------------------------------------------------------------ *
 * The family's side of the relationships
 * ------------------------------------------------------------------ */

export interface FamilyRelationship {
  readonly id: string;
  readonly tutorFirstName: string;
  readonly tutorInitials: string;
  readonly subject: string;
  readonly student: DemoStudent;
  readonly cadence: Cadence;
  readonly standing: string;
  readonly lessonsSoFar: number;
  readonly rateMinor: bigint;
  readonly href: string;
  readonly bookHref: string;
}

/**
 * Every tutoring arrangement this family has, as a LIST.
 *
 * One entry today. It is a list because Priya could perfectly well have Stacey
 * for Maths and somebody else for Physics — the discovery journey in this very
 * demo ends with exactly that — and a dashboard built around the assumption of
 * a single tutor has to be rebuilt the day a second one appears. Rendering
 * `.map()` over one item costs nothing now and is the difference between the
 * structure being right and being lucky.
 */
export function familyRelationships(): readonly FamilyRelationship[] {
  return [
    {
      id: 'jacob-stacey-maths',
      tutorFirstName: STACEY.firstName,
      tutorInitials: STACEY.initials,
      subject: serviceById(JACOB.serviceId)?.name ?? 'Maths',
      student: JACOB,
      cadence: JACOB.cadence,
      standing: JACOB.standing,
      lessonsSoFar: JACOB.lessonsSoFar,
      rateMinor: priceFor(JACOB.durationMinutes),
      href: '/demo/parent/student',
      bookHref: '/demo/parent/rebook',
    },
  ];
}

/* ------------------------------------------------------------------ *
 * THE EXTRA SESSION — one lesson, four screens, one lifecycle
 * ------------------------------------------------------------------ */

const HOUR_MS = 3_600_000;

/**
 * When the family has to pay by.
 *
 * A ROUND HOUR SOMEBODY WOULD ACTUALLY BE AWAKE FOR. Deadlines here were
 * derived by adding an interval to `now`, which told a parent opening the demo
 * at ten at night to pay by one in the morning — the same failure that once
 * produced "choose a tutor by 4:00 am". So the candidates are written down as
 * civil times (nine, midday, eight in the evening), projected onto real days
 * through the same week machinery every calendar uses, and the first one at
 * least two hours out and still comfortably before the lesson wins.
 *
 * The fallback is an hour before the lesson: not round, but true, and only
 * reachable when the lesson itself is imminent.
 */
function payByFor(now: Date, lessonAt: Date): Date {
  const soonest = new Date(now.getTime() + 2 * HOUR_MS);
  const latest = new Date(lessonAt.getTime() - HOUR_MS);

  const candidates = demoWeek(now, { dayCount: 7 }).days.flatMap((day) =>
    [9, 12, 20].map((hour) => instantAt(day, hour * HOUR)),
  );
  return candidates.find((at) => at >= soonest && at <= latest) ?? latest;
}

/**
 * THE ONE LESSON THE DEMO HOLDS MID-LIFECYCLE.
 *
 * Stacey has accepted Jacob's extra session before his algebra assessment, so
 * the hour is hers to keep — but nobody has paid for it, and until they do it
 * is not a booking. That single unsettled state is what the parent's
 * `Needs attention` card, the payment screen and the confirmed screen are all
 * describing, which is why it is projected once, here, from the request rather
 * than written down three times.
 *
 * `paid` is the demo's simulated payment, carried in the URL. It does not
 * create a second lesson; it settles this one.
 */
export function extraSession(now: Date = new Date(), paid = false): DemoLesson | null {
  const request = requestBySlug('jacob-extra-session', now);
  if (request === null) return null;
  const accepted = request.offered[0];
  if (accepted === undefined || accepted.at <= now) return null;

  return {
    id: 'jacob-extra-session',
    student: JACOB,
    at: accepted.at,
    endAt: new Date(accepted.at.getTime() + accepted.durationMinutes * 60_000),
    durationMinutes: accepted.durationMinutes,
    format: request.format,
    priceMinor: request.priceMinor,
    status: 'scheduled',
    kind: 'one_off',
    topic: 'Algebra assessment preparation',
    payment: paid ? 'paid' : 'due',
    payBy: paid ? null : payByFor(now, accepted.at),
  };
}

/** 'Thu 10 Sept, 6:00 – 7:00 pm'. Local to this module, to stay off `stories`. */
export function spanLabel(at: Date, durationMinutes: number): string {
  const date = new Intl.DateTimeFormat('en-NZ', {
    timeZone: PLATFORM_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const clock = new Intl.DateTimeFormat('en-NZ', {
    timeZone: PLATFORM_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  });
  const end = new Date(at.getTime() + durationMinutes * 60_000);
  return `${date.format(at).replace(',', '')}, ${clock.format(at)} – ${clock.format(end)}`;
}

/**
 * Anything genuinely waiting on the family.
 *
 * STILL NOT PADDED. There is exactly one item and it is a real obligation with
 * a real deadline: a tutor has held an hour and it is not booked until somebody
 * pays for it. The moment the demo's payment succeeds this returns nothing
 * again, the card disappears, and the dashboard is quiet — which is the honest
 * behaviour and the reason the slot was built empty in the first place.
 */
export interface FamilyAction {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly whenLabel: string;
  readonly amountMinor: bigint;
  readonly payByAt: Date;
  readonly href: string;
  readonly actionLabel: string;
  readonly urgent: boolean;
}

export function familyActions(now: Date = new Date(), paid = false): readonly FamilyAction[] {
  const extra = extraSession(now, paid);
  if (extra === null || extra.payment === 'paid' || extra.payBy === null) return [];

  return [
    {
      id: extra.id,
      title: 'Payment required',
      detail: `${serviceNameFor(JACOB)} with ${STACEY.firstName} for ${JACOB.firstName} — an extra session before his assessment. ${STACEY.firstName} has accepted and is holding the time.`,
      whenLabel: spanLabel(extra.at, extra.durationMinutes),
      amountMinor: extra.priceMinor,
      payByAt: extra.payBy,
      href: '/demo/parent/rebook/pay',
      actionLabel: 'Pay now',
      urgent: true,
    },
  ];
}

/**
 * The lessons a FAMILY may see: their own children's, and nobody else's.
 *
 * The sibling of `familyWeekBlocks`, and it exists for the same reason. The
 * parent dashboard listed `committedLessons` directly for one build and put
 * another family's child in Priya's upcoming lessons — the calendar was
 * projected and the list was not, so the boundary held in one place and leaked
 * in the other. Anything family-facing that enumerates lessons goes through
 * here.
 */
export function familyLessons(
  days: readonly WeekDay[],
  now: Date = new Date(),
  familySlugs: readonly string[] = [JACOB.slug],
  options: { readonly paid?: boolean } = {},
): readonly DemoLesson[] {
  const standing = committedLessons(days, now).filter((lesson) =>
    familySlugs.includes(lesson.student.slug),
  );

  /*
   * The extra session is not a standing arrangement, so `committedLessons`
   * cannot produce it — it comes from a request Stacey accepted. It is merged
   * in HERE rather than on each page so that every family-facing list of
   * lessons carries it with the same payment state, in the right place in the
   * order.
   */
  const extra = extraSession(now, options.paid ?? false);
  if (extra === null || !familySlugs.includes(extra.student.slug)) return standing;
  const first = days[0];
  const last = days[days.length - 1];
  if (first === undefined || last === undefined) return standing;
  if (extra.at < first.startAt || extra.at >= last.endAt) return standing;

  return [...standing, extra].sort((a, b) => a.at.getTime() - b.at.getTime());
}

/* ------------------------------------------------------------------ *
 * THE PAID FLAG — the demo's only carried state
 * ------------------------------------------------------------------ */

/**
 * Whether the viewer has been through the demo's payment screen.
 *
 * IN THE URL, AND NOWHERE ELSE. There is no store, no cookie and no database
 * row: the confirmed screen sends the family home with `?paid=1` and the
 * family's own navigation keeps carrying it, so the extra session shows as
 * settled from then on. Open the demo fresh and it is unpaid again, which is
 * exactly what a walkthrough needs.
 */
export function isPaid(raw: string | readonly string[] | undefined): boolean {
  const value = Array.isArray(raw) ? raw[0] : (raw as string | undefined);
  return value === '1';
}

/** Carry the flag onto a link, whatever query it already has. */
export function withPaid(href: string, paid: boolean): string {
  if (!paid) return href;
  return href.includes('?') ? `${href}&paid=1` : `${href}?paid=1`;
}

/**
 * 'Wed 5:33 pm' — a deadline short enough to sit in a chip.
 *
 * The full form ("Wednesday, 9 September 2026 at 5:33 pm") is right in a
 * sentence and 275 pixels wide inside a pill, which is wider than a phone. It
 * took the whole page sideways before this existed.
 */
export function shortDeadline(at: Date): string {
  return new Intl.DateTimeFormat('en-NZ', {
    timeZone: PLATFORM_TIME_ZONE,
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
    .format(at)
    .replace(',', '');
}
