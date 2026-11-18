import type { TutorBookingView, TutorRequestView } from '@studdy/database';
import type { StatusFamily } from '@studdy/design-system';

/**
 * The Tutor workspace's view models.
 *
 * PURE, and free of `server-only`, so what a tutor is told about a lesson, a
 * student or their money can be tested without a database. Everything here is
 * derived from records the repositories already scoped to this one tutor.
 *
 * TWO RULES RUN THROUGH IT.
 *
 *  - A REQUEST IS NOT A LESSON. A lesson is a booking; a request, even an
 *    accepted one, is still a question until the family has paid.
 *  - NOTHING IS CALLED TAUGHT. A booking whose time has passed is "time has
 *    passed", not "completed": whether a lesson happened is the Lesson record's
 *    to say, and that record does not exist yet.
 */

// ---------------------------------------------------------------------------
// Lessons (bookings)
// ---------------------------------------------------------------------------

export function isUpcoming(booking: TutorBookingView, now: Date): boolean {
  return (
    (booking.statusCode === 'confirmed' || booking.statusCode === 'pending_payment') &&
    booking.scheduledEndAt.getTime() > now.getTime()
  );
}

export interface SplitLessons {
  /** Soonest first. */
  readonly upcoming: readonly TutorBookingView[];
  /** Most recent first. Includes cancelled lessons. */
  readonly past: readonly TutorBookingView[];
}

export function splitLessons(bookings: readonly TutorBookingView[], now: Date): SplitLessons {
  return {
    upcoming: bookings
      .filter((booking) => isUpcoming(booking, now))
      .sort((a, b) => a.scheduledStartAt.getTime() - b.scheduledStartAt.getTime()),
    past: bookings
      .filter((booking) => !isUpcoming(booking, now))
      .sort((a, b) => b.scheduledStartAt.getTime() - a.scheduledStartAt.getTime()),
  };
}

export interface StatusPresentation {
  readonly label: string;
  readonly family: StatusFamily;
}

export function lessonStatus(booking: TutorBookingView, now: Date): StatusPresentation {
  switch (booking.statusCode) {
    case 'cancelled':
      return { label: 'Cancelled', family: 'cancelled' };
    case 'completed':
      return { label: 'Completed', family: 'complete' };
    case 'pending_payment':
      return { label: 'Awaiting payment', family: 'pending' };
    default:
      return booking.scheduledEndAt.getTime() > now.getTime()
        ? { label: 'Confirmed', family: 'active' }
        : { label: 'Lesson time has passed', family: 'archived' };
  }
}

export function formatLabel(lessonFormatCode: string): string {
  return lessonFormatCode === 'in_person' ? 'In person' : 'Online';
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

export interface TutorStudent {
  readonly studentReference: string;
  readonly preferredName: string;
  readonly schoolYearCode: string | null;
  readonly subjects: readonly string[];
  /** A parent or guardian arranges this student's lessons. */
  readonly bookedByGuardian: boolean;
  readonly lessonCount: number;
  readonly nextLesson: TutorBookingView | null;
  readonly lastLesson: TutorBookingView | null;
}

/**
 * A tutor's students are the students they have a BOOKED lesson with.
 *
 * A request is not a relationship — the family may choose someone else — so a
 * student never appears here from a request alone, and a tutor never sees a
 * student they do not teach. Cancelled bookings do not count. Students with a
 * lesson coming up are listed first.
 */
export function tutorStudents(
  bookings: readonly TutorBookingView[],
  now: Date,
): readonly TutorStudent[] {
  const byStudent = new Map<string, TutorBookingView[]>();
  for (const booking of bookings) {
    if (booking.statusCode === 'cancelled') continue;
    byStudent.set(booking.studentReference, [
      ...(byStudent.get(booking.studentReference) ?? []),
      booking,
    ]);
  }

  return [...byStudent.values()]
    .map((list) => {
      const { upcoming, past } = splitLessons(list, now);
      const latest = list[list.length - 1]!;
      return {
        studentReference: latest.studentReference,
        preferredName: latest.studentPreferredName,
        schoolYearCode: latest.studentSchoolYearCode,
        subjects: [...new Set(list.map((booking) => booking.subjectDisplayName))],
        bookedByGuardian: list.some((booking) => booking.bookedByGuardian),
        lessonCount: list.length,
        nextLesson: upcoming[0] ?? null,
        lastLesson: past[0] ?? null,
      };
    })
    .sort((a, b) => {
      const aNext = a.nextLesson?.scheduledStartAt.getTime() ?? Number.POSITIVE_INFINITY;
      const bNext = b.nextLesson?.scheduledStartAt.getTime() ?? Number.POSITIVE_INFINITY;
      return aNext - bNext || a.preferredName.localeCompare(b.preferredName);
    });
}

// ---------------------------------------------------------------------------
// Earnings
// ---------------------------------------------------------------------------

export type EarningState = 'paid' | 'pending' | 'upcoming' | 'delayed' | 'none';

/**
 * Where the tutor's money for one lesson stands.
 *
 *  - `upcoming` — booked and paid for by the family, lesson still to come.
 *  - `pending`  — the lesson time has passed; the payout has not been sent yet.
 *  - `paid`     — the payout was sent.
 *  - `delayed`  — a payout attempt did not go through and is being looked at.
 *  - `none`     — cancelled, reversed, or never confirmed: nothing is owed.
 */
export function earningState(booking: TutorBookingView, now: Date): EarningState {
  if (booking.statusCode === 'cancelled' || booking.statusCode === 'pending_payment') return 'none';
  if (booking.payoutStatusCode === 'reversed') return 'none';
  if (booking.payoutStatusCode === 'sent') return 'paid';
  if (booking.scheduledEndAt.getTime() > now.getTime()) return 'upcoming';
  return booking.payoutStatusCode === 'failed' ? 'delayed' : 'pending';
}

export const EARNING_LABELS: Record<EarningState, StatusPresentation> = {
  paid: { label: 'Paid out', family: 'complete' },
  pending: { label: 'Payout pending', family: 'pending' },
  upcoming: { label: 'Expected', family: 'active' },
  delayed: { label: 'Payout delayed', family: 'awaiting_action' },
  none: { label: 'No payout', family: 'archived' },
};

export interface EarningsSummary {
  readonly currencyCode: string;
  /** Lessons whose time has passed: paid out, pending and delayed together. */
  readonly earnedMinor: bigint;
  readonly pendingMinor: bigint;
  readonly paidMinor: bigint;
  /** Booked lessons still to come. Expected, not yet earned. */
  readonly upcomingMinor: bigint;
}

/**
 * Totals of what the tutor EARNS — the lesson price less Studdy's fee — never
 * the gross price. One summary per currency; currencies are never added
 * together.
 */
export function earningsSummary(
  bookings: readonly TutorBookingView[],
  now: Date,
): readonly EarningsSummary[] {
  const totals = new Map<string, { paid: bigint; pending: bigint; upcoming: bigint }>();
  for (const booking of bookings) {
    const state = earningState(booking, now);
    if (state === 'none') continue;
    const total = totals.get(booking.currencyCode) ?? { paid: 0n, pending: 0n, upcoming: 0n };
    if (state === 'paid') total.paid += booking.earnsMinor;
    else if (state === 'upcoming') total.upcoming += booking.earnsMinor;
    else total.pending += booking.earnsMinor;
    totals.set(booking.currencyCode, total);
  }
  return [...totals.entries()].map(([currencyCode, total]) => ({
    currencyCode,
    earnedMinor: total.paid + total.pending,
    pendingMinor: total.pending,
    paidMinor: total.paid,
    upcomingMinor: total.upcoming,
  }));
}

// ---------------------------------------------------------------------------
// Needs action
// ---------------------------------------------------------------------------

export interface NeedsAction {
  readonly key: string;
  readonly title: string;
  readonly detail: string;
  readonly href: string;
  readonly actionLabel: string;
  /** When it stops being possible, for the items that have a deadline. */
  readonly dueAt: Date | null;
}

export interface NeedsActionInput {
  readonly requests: readonly TutorRequestView[];
  readonly bookings: readonly TutorBookingView[];
  readonly hasAvailability: boolean;
  readonly canReceivePayments: boolean;
  readonly now: Date;
}

/**
 * What is the tutor's to do, most urgent first.
 *
 * Only things a tutor can actually act on. A request waiting on the FAMILY is
 * not here, and neither is a payout that is merely pending — those are
 * somebody else's move.
 */
export function needsAction(input: NeedsActionInput): readonly NeedsAction[] {
  const items: NeedsAction[] = input.requests
    .filter((request) => request.statusCode === 'sent')
    .sort((a, b) => a.respondByAt.getTime() - b.respondByAt.getTime())
    .map((request) => ({
      key: request.reference,
      title: `Reply to a request for ${request.subjectDisplayName}`,
      detail: `${request.studentPreferredName} · ${String(request.offeredTimes.length)} ${
        request.offeredTimes.length === 1 ? 'time' : 'times'
      } offered`,
      href: `/tutor/requests/${request.reference}`,
      actionLabel: 'Respond',
      dueAt: request.respondByAt,
    }));

  if (!input.hasAvailability) {
    items.push({
      key: 'availability',
      title: 'Set your availability',
      detail: 'Families can only ask you for times you are free.',
      href: '/tutor/availability',
      actionLabel: 'Set hours',
      dueAt: null,
    });
  }
  if (!input.canReceivePayments) {
    items.push({
      key: 'payouts',
      title: 'Finish payout setup',
      detail: 'A family cannot pay for a lesson with you until you can be paid.',
      href: '/tutor/payments',
      actionLabel: 'Set up',
      dueAt: null,
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// The week
// ---------------------------------------------------------------------------

export interface WeekDaySummary {
  /** `YYYY-MM-DD` in the display zone. */
  readonly date: string;
  readonly lessons: readonly TutorBookingView[];
  /** Offered times of requests the tutor has not answered or is holding. */
  readonly requestCount: number;
  /** Minutes of regular availability on this weekday. */
  readonly availableMinutes: number;
}

export interface WeekSummaryInput {
  /** Seven days, Monday first, each with its own instant range. */
  readonly days: readonly { readonly date: string; readonly startAt: Date; readonly endAt: Date }[];
  readonly bookings: readonly TutorBookingView[];
  readonly requests: readonly TutorRequestView[];
  /** Minutes of regular hours per day index, Monday = 0. */
  readonly availableMinutesByDay: readonly number[];
}

const OPEN_TUTOR_REQUEST_STATUSES = new Set(['sent', 'accepted', 'selected']);

/** A request the tutor still has a stake in: unanswered, or accepted and held. */
export function isOpenTutorRequest(request: TutorRequestView): boolean {
  if (!OPEN_TUTOR_REQUEST_STATUSES.has(request.statusCode)) return false;
  // Once paid, the request has become a lesson and is counted as one.
  return request.holdTypeCode !== 'booking_confirmed';
}

export function weekSummary(input: WeekSummaryInput): readonly WeekDaySummary[] {
  const within = (at: Date, day: { startAt: Date; endAt: Date }): boolean =>
    at.getTime() >= day.startAt.getTime() && at.getTime() < day.endAt.getTime();

  return input.days.map((day, index) => ({
    date: day.date,
    lessons: input.bookings
      .filter(
        (booking) => booking.statusCode !== 'cancelled' && within(booking.scheduledStartAt, day),
      )
      .sort((a, b) => a.scheduledStartAt.getTime() - b.scheduledStartAt.getTime()),
    requestCount: input.requests
      .filter(isOpenTutorRequest)
      .reduce(
        (count, request) =>
          count +
          request.offeredTimes.filter(
            (time) =>
              (time.statusCode === 'offered' || time.statusCode === 'claimed') &&
              within(time.startAt, day),
          ).length,
        0,
      ),
    availableMinutes: input.availableMinutesByDay[index] ?? 0,
  }));
}
