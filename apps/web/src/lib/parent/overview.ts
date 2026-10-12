import type { FamilyBookingView, FamilyPaymentView, FamilyRequestView } from '@studdy/database';
import type { StatusFamily } from '@studdy/design-system';

/**
 * The Parent workspace's view models.
 *
 * PURE, and deliberately free of `server-only`: everything a parent screen says
 * about a booking, a payment or a tutor is decided here from records the
 * repositories already scoped to this family, so the wording can be tested
 * without a database.
 *
 * TWO RULES RUN THROUGH ALL OF IT.
 *
 *  - A REQUEST IS NOT A BOOKING. Nothing here ever promotes a request, an
 *    acceptance or a choice into "booked"; a booking is a row in `bookings`,
 *    which exists only once payment has confirmed it.
 *  - PARENT-FACING WORDS ONLY. Payment and refund states are translated into
 *    what happened to the family's money. Internal vocabulary — commission,
 *    settlement, transfer, the provider's own status — has no label here
 *    because it has no field to arrive in.
 */

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export interface SplitBookings {
  /** Confirmed lessons that have not finished yet, soonest first. */
  readonly upcoming: readonly FamilyBookingView[];
  /** Everything else, most recent first. */
  readonly past: readonly FamilyBookingView[];
}

export function isUpcoming(booking: FamilyBookingView, now: Date): boolean {
  return (
    (booking.statusCode === 'confirmed' || booking.statusCode === 'pending_payment') &&
    booking.scheduledEndAt.getTime() > now.getTime()
  );
}

export function splitBookings(bookings: readonly FamilyBookingView[], now: Date): SplitBookings {
  const upcoming = bookings
    .filter((booking) => isUpcoming(booking, now))
    .sort((a, b) => a.scheduledStartAt.getTime() - b.scheduledStartAt.getTime());
  const past = bookings
    .filter((booking) => !isUpcoming(booking, now))
    .sort((a, b) => b.scheduledStartAt.getTime() - a.scheduledStartAt.getTime());
  return { upcoming, past };
}

export interface StatusPresentation {
  readonly label: string;
  readonly family: StatusFamily;
}

/**
 * A confirmed booking whose time has gone is NOT called "completed".
 *
 * Whether the lesson actually happened is the Lesson record's to say, and that
 * record does not exist yet. "Time has passed" is the most that is known.
 */
export function bookingStatus(booking: FamilyBookingView, now: Date): StatusPresentation {
  switch (booking.statusCode) {
    case 'cancelled':
      return { label: 'Cancelled', family: 'cancelled' };
    case 'completed':
      return { label: 'Completed', family: 'complete' };
    case 'pending_payment':
      return { label: 'Awaiting payment', family: 'awaiting_action' };
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
// Requests
// ---------------------------------------------------------------------------

const OPEN_REQUEST_STATUSES = new Set([
  'draft',
  'awaiting_responses',
  'ready_for_selection',
  'awaiting_payment',
]);

/** Still in play: waiting on a tutor, on the family's choice, or on payment. */
export function isOpenRequest(request: FamilyRequestView): boolean {
  return OPEN_REQUEST_STATUSES.has(request.statusCode);
}

export interface PaymentDue {
  readonly requestReference: string;
  readonly studentPreferredName: string;
  readonly subjectDisplayName: string;
  readonly tutorFirstName: string;
  readonly amountMinor: bigint;
  readonly currencyCode: string;
  readonly dueAt: Date;
  readonly timeZone: string;
}

/**
 * What the family has to pay now.
 *
 * Read from the REQUEST, not from `payments`: the payment row is only written
 * when the pay screen is first opened, so a family who chose a tutor and closed
 * the tab owes money that no payment row records yet. The request at
 * `awaiting_payment` is the fact; soonest deadline first.
 */
export function paymentsDue(
  requests: readonly FamilyRequestView[],
  now: Date,
): readonly PaymentDue[] {
  return requests
    .flatMap((request) => {
      if (request.statusCode !== 'awaiting_payment') return [];
      const chosen = request.tutorRequests.find((entry) => entry.statusCode === 'selected');
      if (chosen === undefined || chosen.paymentDeadlineAt === null) return [];
      if (chosen.paymentDeadlineAt.getTime() <= now.getTime()) return [];
      return [
        {
          requestReference: request.reference,
          studentPreferredName: request.studentPreferredName,
          subjectDisplayName: request.subjectDisplayName,
          tutorFirstName: chosen.tutorFirstName,
          amountMinor: chosen.priceAmountMinor,
          currencyCode: chosen.currencyCode,
          dueAt: chosen.paymentDeadlineAt,
          timeZone: request.timeZone,
        },
      ];
    })
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}

// ---------------------------------------------------------------------------
// Payments and refunds
// ---------------------------------------------------------------------------

export interface PaymentPresentation extends StatusPresentation {
  /** One plain sentence about where the money is. */
  readonly detail: string;
}

/** The refund that currently speaks for a payment: the latest attempt. */
function latestRefund(payment: FamilyPaymentView): FamilyPaymentView['refunds'][number] | null {
  return payment.refunds[payment.refunds.length - 1] ?? null;
}

export function paymentStatus(payment: FamilyPaymentView): PaymentPresentation {
  const refund = latestRefund(payment);

  if (payment.statusCode === 'succeeded') {
    if (refund?.statusCode === 'succeeded') {
      return {
        label: 'Refunded',
        family: 'complete',
        detail: 'Returned to the card you paid with. Banks can take a few days to show it.',
      };
    }
    if (payment.refundRequired || refund !== null) {
      // Requested, pending, or an attempt that failed and is being retried by a
      // person. All three read the same to the family: it is coming back.
      return {
        label: 'Refund on its way',
        family: 'pending',
        detail:
          'This payment arrived but the lesson could not be booked, so Studdy is returning it in full.',
      };
    }
    return { label: 'Paid', family: 'complete', detail: 'Paid in full.' };
  }

  switch (payment.statusCode) {
    case 'requires_payment':
      return {
        label: 'Payment due',
        family: 'awaiting_action',
        detail: 'Not paid yet. Nothing has been taken.',
      };
    case 'processing':
      return {
        label: 'Processing',
        family: 'pending',
        detail: 'Your bank is confirming this payment.',
      };
    case 'failed':
      return { label: 'Payment failed', family: 'failed', detail: 'Nothing was taken.' };
    case 'expired':
      return {
        label: 'Not paid in time',
        family: 'overdue',
        detail: 'The payment window passed. Nothing was taken.',
      };
    default:
      return { label: 'Cancelled', family: 'cancelled', detail: 'Nothing was taken.' };
  }
}

/** A payment the family's money actually left on. */
export function isSettledPayment(payment: FamilyPaymentView): boolean {
  return payment.statusCode === 'succeeded';
}

/** Payments with a refund story: owed back, on its way, or returned. */
export function refundedPayments(
  payments: readonly FamilyPaymentView[],
): readonly FamilyPaymentView[] {
  return payments.filter(
    (payment) =>
      payment.statusCode === 'succeeded' && (payment.refundRequired || payment.refunds.length > 0),
  );
}

export interface MoneyTotal {
  readonly currencyCode: string;
  readonly amountMinor: bigint;
}

/**
 * What the family has paid and kept paying for: successful payments that are
 * not being, and have not been, refunded. One total per currency, never summed
 * across currencies.
 */
export function totalPaid(payments: readonly FamilyPaymentView[]): readonly MoneyTotal[] {
  const totals = new Map<string, bigint>();
  for (const payment of payments) {
    if (payment.statusCode !== 'succeeded') continue;
    if (payment.refundRequired || payment.refunds.length > 0) continue;
    totals.set(
      payment.currencyCode,
      (totals.get(payment.currencyCode) ?? 0n) + payment.totalChargedMinor,
    );
  }
  return [...totals.entries()].map(([currencyCode, amountMinor]) => ({
    currencyCode,
    amountMinor,
  }));
}

// ---------------------------------------------------------------------------
// Tutors
// ---------------------------------------------------------------------------

export interface TutorRelationship {
  readonly tutorReference: string;
  readonly tutorFirstName: string;
  /** Who this tutor teaches in this family, and what. */
  readonly teaching: readonly {
    readonly studentProfileId: string;
    readonly studentReference: string;
    readonly studentPreferredName: string;
    readonly subjectDisplayName: string;
  }[];
  readonly lessonCount: number;
  readonly nextLesson: FamilyBookingView | null;
  readonly lastLesson: FamilyBookingView | null;
}

/**
 * A family's tutors are the tutors it has BOOKED.
 *
 * A request sent, or even accepted, is not a relationship — the tutor may
 * decline, and the family may choose someone else. Cancelled bookings do not
 * count either. Tutors with a lesson coming up are listed first.
 */
export function tutorRelationships(
  bookings: readonly FamilyBookingView[],
  now: Date,
): readonly TutorRelationship[] {
  const byTutor = new Map<string, FamilyBookingView[]>();
  for (const booking of bookings) {
    if (booking.statusCode === 'cancelled') continue;
    const list = byTutor.get(booking.tutorReference) ?? [];
    list.push(booking);
    byTutor.set(booking.tutorReference, list);
  }

  return [...byTutor.values()]
    .map((list) => {
      const { upcoming, past } = splitBookings(list, now);
      const teaching = new Map<string, TutorRelationship['teaching'][number]>();
      for (const booking of list) {
        teaching.set(`${booking.studentProfileId}:${booking.subjectDisplayName}`, {
          studentProfileId: booking.studentProfileId,
          studentReference: booking.studentReference,
          studentPreferredName: booking.studentPreferredName,
          subjectDisplayName: booking.subjectDisplayName,
        });
      }
      return {
        tutorReference: list[0]!.tutorReference,
        tutorFirstName: list[0]!.tutorFirstName,
        teaching: [...teaching.values()],
        lessonCount: list.length,
        nextLesson: upcoming[0] ?? null,
        lastLesson: past[0] ?? null,
      };
    })
    .sort((a, b) => {
      const aNext = a.nextLesson?.scheduledStartAt.getTime() ?? Number.POSITIVE_INFINITY;
      const bNext = b.nextLesson?.scheduledStartAt.getTime() ?? Number.POSITIVE_INFINITY;
      return aNext - bNext || a.tutorFirstName.localeCompare(b.tutorFirstName);
    });
}

// ---------------------------------------------------------------------------
// Recent updates
// ---------------------------------------------------------------------------

export interface RecentUpdate {
  readonly key: string;
  readonly at: Date;
  readonly title: string;
  readonly detail: string;
  readonly href: string;
}

const CLOSED_REQUEST_TITLES: Record<string, string> = {
  requester_withdrew: 'You withdrew a request',
  request_expired: 'A request expired',
  all_tutors_declined: 'A request closed without a tutor',
  selection_window_lapsed: 'A request closed before a tutor was chosen',
  payment_window_lapsed: 'A request closed because it was not paid in time',
};

/**
 * What has happened lately, built only from things that are on record.
 *
 * There is no notification feed to read, so this is derived: each entry is a
 * timestamp a real record carries. Nothing is invented to fill the list, and a
 * family with no history sees an empty one.
 */
export function recentUpdates(
  input: {
    readonly requests: readonly FamilyRequestView[];
    readonly bookings: readonly FamilyBookingView[];
    readonly payments: readonly FamilyPaymentView[];
  },
  limit = 6,
): readonly RecentUpdate[] {
  const updates: RecentUpdate[] = [];

  for (const request of input.requests) {
    const who = `${request.subjectDisplayName} for ${request.studentPreferredName}`;
    const href = `/requests/${request.reference}`;
    updates.push({
      key: `${request.reference}:sent`,
      at: request.createdAt,
      title: 'Request sent',
      detail: who,
      href,
    });
    if (request.statusCode === 'ready_for_selection') {
      const accepted = request.tutorRequests.filter((entry) => entry.statusCode === 'accepted');
      if (accepted.length > 0) {
        updates.push({
          key: `${request.reference}:ready`,
          // No acceptance timestamp reaches the family view; the request was
          // last known to be open at its creation, so this sorts just after it.
          at: new Date(request.createdAt.getTime() + 1),
          title:
            accepted.length === 1
              ? `${accepted[0]!.tutorFirstName} can take this lesson`
              : `${String(accepted.length)} tutors can take this lesson`,
          detail: `${who}. Choose a tutor to continue.`,
          href,
        });
      }
    }
    if (request.statusCode === 'closed' && request.closedAt !== null) {
      const title = CLOSED_REQUEST_TITLES[request.closeReasonCode ?? ''];
      if (title !== undefined) {
        updates.push({
          key: `${request.reference}:closed`,
          at: request.closedAt,
          title,
          detail: who,
          href,
        });
      }
    }
  }

  for (const booking of input.bookings) {
    if (booking.confirmedAt === null) continue;
    updates.push({
      key: `${booking.reference}:confirmed`,
      at: booking.confirmedAt,
      title: 'Booking confirmed',
      detail: `${booking.subjectDisplayName} with ${booking.tutorFirstName} for ${booking.studentPreferredName}`,
      href: `/parent/bookings/${booking.reference}`,
    });
  }

  for (const payment of input.payments) {
    for (const refund of payment.refunds) {
      if (refund.statusCode !== 'succeeded' || refund.completedAt === null) continue;
      updates.push({
        key: `${refund.reference}:refunded`,
        at: refund.completedAt,
        title: 'Payment refunded',
        detail: `${payment.subjectDisplayName} for ${payment.studentPreferredName}`,
        href: '/parent/payments?view=refunds',
      });
    }
  }

  return updates.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

/** `YYYY-MM-DD` for an instant, in a zone. */
export function localDateKey(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const part = (type: string): string => parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** A `YYYY-MM` the calendar will accept, or null. */
export function parseMonth(value: string | undefined): { year: number; month: number } | null {
  if (value === undefined) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || year < 2020 || year > 2100) return null;
  return { year, month };
}

export function monthKey(year: number, month: number): string {
  return `${String(year)}-${String(month).padStart(2, '0')}`;
}

export function shiftMonth(
  year: number,
  month: number,
  by: number,
): { year: number; month: number } {
  const index = year * 12 + (month - 1) + by;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export interface CalendarDay {
  /** `YYYY-MM-DD`, or null for the blanks before the 1st and after the last. */
  readonly dateKey: string | null;
  readonly dayOfMonth: number | null;
}

/**
 * A month as Monday-first weeks.
 *
 * Calendar dates only — no instants — so there is no zone arithmetic to get
 * wrong: a lesson is placed on a day by `localDateKey` in the lesson's own
 * zone, and this grid just lays the days out.
 */
export function monthWeeks(year: number, month: number): readonly (readonly CalendarDay[])[] {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // getUTCDay: 0 Sunday … 6 Saturday. Monday-first offset.
  const leading = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const cells: CalendarDay[] = [];
  for (let blank = 0; blank < leading; blank += 1) cells.push({ dateKey: null, dayOfMonth: null });
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      dateKey: `${monthKey(year, month)}-${String(day).padStart(2, '0')}`,
      dayOfMonth: day,
    });
  }
  while (cells.length % 7 !== 0) cells.push({ dateKey: null, dayOfMonth: null });

  const weeks: CalendarDay[][] = [];
  for (let start = 0; start < cells.length; start += 7) weeks.push(cells.slice(start, start + 7));
  return weeks;
}
