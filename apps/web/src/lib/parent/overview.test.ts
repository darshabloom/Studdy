import { describe, expect, it } from 'vitest';
import type { FamilyBookingView, FamilyPaymentView, FamilyRequestView } from '@studdy/database';
import { isActiveNavItem, PARENT_NAV } from './nav';
import {
  bookingStatus,
  isOpenRequest,
  localDateKey,
  monthWeeks,
  parseMonth,
  paymentStatus,
  paymentsDue,
  recentUpdates,
  refundedPayments,
  shiftMonth,
  splitBookings,
  totalPaid,
  tutorRelationships,
} from './overview';

const NOW = new Date('2026-10-10T00:00:00Z');
const hours = (count: number): Date => new Date(NOW.getTime() + count * 3_600_000);

function booking(overrides: Partial<FamilyBookingView> = {}): FamilyBookingView {
  return {
    reference: 'BK-00000001',
    statusCode: 'confirmed',
    scheduledStartAt: hours(24),
    scheduledEndAt: hours(25),
    durationMinutes: 60,
    timeZone: 'Pacific/Auckland',
    lessonFormatCode: 'online',
    studentProfileId: 'student-1',
    studentReference: 'STUDENT-00000001',
    studentPreferredName: 'Mila',
    subjectDisplayName: 'Mathematics',
    tutorFirstName: 'Aroha',
    tutorReference: 'TUTOR-00000001',
    requestReference: 'LR-00000001',
    confirmedAt: hours(-48),
    totalChargedMinor: 4000n,
    currencyCode: 'NZD',
    ...overrides,
  };
}

function payment(overrides: Partial<FamilyPaymentView> = {}): FamilyPaymentView {
  return {
    reference: 'PAY-00000001',
    statusCode: 'succeeded',
    refundRequired: false,
    totalChargedMinor: 4000n,
    currencyCode: 'NZD',
    createdAt: hours(-49),
    succeededAt: hours(-48),
    paymentDeadlineAt: hours(-48),
    requestReference: 'LR-00000001',
    bookingReference: 'BK-00000001',
    studentProfileId: 'student-1',
    studentPreferredName: 'Mila',
    subjectDisplayName: 'Mathematics',
    tutorFirstName: 'Aroha',
    tutorReference: 'TUTOR-00000001',
    lessonStartAt: hours(24),
    timeZone: 'Pacific/Auckland',
    refunds: [],
    ...overrides,
  };
}

function request(overrides: Partial<FamilyRequestView> = {}): FamilyRequestView {
  return {
    intendedLessonRequestId: 'ilr-1',
    reference: 'LR-00000002',
    statusCode: 'awaiting_responses',
    timeOptions: [],
    durationMinutes: 60,
    formatCode: 'online',
    timeZone: 'Pacific/Auckland',
    notesForTutors: null,
    decisionDeadlineAt: hours(24),
    closeReasonCode: null,
    createdAt: hours(-2),
    closedAt: null,
    studentProfileId: 'student-1',
    studentPreferredName: 'Mila',
    subjectDisplayName: 'Mathematics',
    tutorRequests: [],
    ...overrides,
  };
}

const chosen = (paymentDeadlineAt: Date | null): FamilyRequestView['tutorRequests'][number] => ({
  tutorRequestId: 'treq-1',
  reference: 'TREQ-1',
  statusCode: 'selected',
  closeReasonCode: null,
  respondByAt: hours(-1),
  paymentDeadlineAt,
  paymentWindowMinutes: 60,
  tutorFirstName: 'Aroha',
  tutorReference: 'TUTOR-00000001',
  priceAmountMinor: 4000n,
  currencyCode: 'NZD',
  offeredTimes: [],
});

describe('bookings', () => {
  it('splits on whether the lesson has finished, soonest upcoming first', () => {
    const soon = booking({
      reference: 'BK-SOON',
      scheduledStartAt: hours(2),
      scheduledEndAt: hours(3),
    });
    const later = booking({ reference: 'BK-LATER' });
    const gone = booking({
      reference: 'BK-GONE',
      scheduledStartAt: hours(-5),
      scheduledEndAt: hours(-4),
    });
    const cancelled = booking({ reference: 'BK-CANCELLED', statusCode: 'cancelled' });

    const { upcoming, past } = splitBookings([later, gone, cancelled, soon], NOW);
    expect(upcoming.map((entry) => entry.reference)).toEqual(['BK-SOON', 'BK-LATER']);
    expect(past.map((entry) => entry.reference).sort()).toEqual(['BK-CANCELLED', 'BK-GONE']);
  });

  it('keeps a lesson that is under way in upcoming until it ends', () => {
    const underWay = booking({ scheduledStartAt: hours(-0.5), scheduledEndAt: hours(0.5) });
    expect(splitBookings([underWay], NOW).upcoming).toHaveLength(1);
  });

  it('never calls a lesson completed merely because its time has gone', () => {
    const gone = booking({ scheduledStartAt: hours(-5), scheduledEndAt: hours(-4) });
    expect(bookingStatus(gone, NOW).label).toBe('Lesson time has passed');
    expect(bookingStatus(booking({ statusCode: 'completed' }), NOW).label).toBe('Completed');
    expect(bookingStatus(booking(), NOW).label).toBe('Confirmed');
  });
});

describe('requests are not bookings', () => {
  it('counts only requests still in play as open', () => {
    expect(isOpenRequest(request())).toBe(true);
    expect(isOpenRequest(request({ statusCode: 'awaiting_payment' }))).toBe(true);
    expect(isOpenRequest(request({ statusCode: 'fulfilled' }))).toBe(false);
    expect(isOpenRequest(request({ statusCode: 'closed' }))).toBe(false);
  });

  it('owes payment from the request, soonest deadline first, and not once the window has gone', () => {
    const due = paymentsDue(
      [
        request({
          reference: 'LR-LATER',
          statusCode: 'awaiting_payment',
          tutorRequests: [chosen(hours(1))],
        }),
        request({
          reference: 'LR-SOON',
          statusCode: 'awaiting_payment',
          tutorRequests: [chosen(hours(0.25))],
        }),
        request({
          reference: 'LR-LAPSED',
          statusCode: 'awaiting_payment',
          tutorRequests: [chosen(hours(-0.1))],
        }),
        // Accepted but not chosen: nothing is owed for it.
        request({ reference: 'LR-OPEN', statusCode: 'ready_for_selection' }),
      ],
      NOW,
    );
    expect(due.map((entry) => entry.requestReference)).toEqual(['LR-SOON', 'LR-LATER']);
    expect(due[0]?.amountMinor).toBe(4000n);
  });
});

describe('payments, in the family’s terms', () => {
  const refund = (statusCode: string): FamilyPaymentView['refunds'][number] => ({
    reference: 'RF-1',
    statusCode,
    amountMinor: 4000n,
    currencyCode: 'NZD',
    requestedAt: hours(-3),
    completedAt: statusCode === 'succeeded' || statusCode === 'failed' ? hours(-2) : null,
  });

  it('labels each state by where the money is', () => {
    expect(paymentStatus(payment()).label).toBe('Paid');
    expect(paymentStatus(payment({ statusCode: 'requires_payment' })).label).toBe('Payment due');
    expect(paymentStatus(payment({ statusCode: 'processing' })).label).toBe('Processing');
    expect(paymentStatus(payment({ statusCode: 'expired' })).label).toBe('Not paid in time');
    expect(paymentStatus(payment({ statusCode: 'failed' })).label).toBe('Payment failed');
    expect(paymentStatus(payment({ statusCode: 'cancelled' })).label).toBe('Cancelled');
  });

  it('says a refund is on its way from the moment it is owed until it lands', () => {
    expect(paymentStatus(payment({ refundRequired: true })).label).toBe('Refund on its way');
    for (const state of ['requested', 'pending', 'failed']) {
      expect(
        paymentStatus(payment({ refundRequired: true, refunds: [refund(state)] })).label,
        state,
      ).toBe('Refund on its way');
    }
    expect(
      paymentStatus(
        payment({ refundRequired: true, refunds: [refund('failed'), refund('succeeded')] }),
      ).label,
    ).toBe('Refunded');
  });

  it('uses no internal money vocabulary in any label or sentence', () => {
    const everything = [
      payment(),
      payment({ refundRequired: true }),
      payment({ refundRequired: true, refunds: [refund('succeeded')] }),
      ...['requires_payment', 'processing', 'failed', 'cancelled', 'expired'].map((statusCode) =>
        payment({ statusCode }),
      ),
    ].map((entry) => {
      const status = paymentStatus(entry);
      return `${status.label} ${status.detail}`;
    });
    for (const text of everything) {
      expect(text).not.toMatch(/commission|platform fee|payout|settlement|transfer|entitlement/i);
    }
  });

  it('totals only money the family paid and kept paying for', () => {
    const totals = totalPaid([
      payment(),
      payment({ reference: 'PAY-2', totalChargedMinor: 5500n }),
      payment({ reference: 'PAY-REFUNDED', refundRequired: true }),
      payment({ reference: 'PAY-OPEN', statusCode: 'requires_payment' }),
    ]);
    expect(totals).toEqual([{ currencyCode: 'NZD', amountMinor: 9500n }]);
  });

  it('lists a payment under refunds once money is owed back', () => {
    const owed = payment({ reference: 'PAY-OWED', refundRequired: true });
    expect(refundedPayments([payment(), owed]).map((entry) => entry.reference)).toEqual([
      'PAY-OWED',
    ]);
  });
});

describe('tutor relationships', () => {
  it('come from bookings, grouped by tutor, with a lesson coming up listed first', () => {
    const relationships = tutorRelationships(
      [
        booking({
          reference: 'BK-PAST',
          tutorReference: 'TUTOR-B',
          tutorFirstName: 'James',
          scheduledStartAt: hours(-50),
          scheduledEndAt: hours(-49),
        }),
        booking({ reference: 'BK-1' }),
        booking({
          reference: 'BK-2',
          studentProfileId: 'student-2',
          studentPreferredName: 'Theo',
          scheduledStartAt: hours(48),
          scheduledEndAt: hours(49),
        }),
      ],
      NOW,
    );
    expect(relationships.map((entry) => entry.tutorFirstName)).toEqual(['Aroha', 'James']);
    expect(relationships[0]?.lessonCount).toBe(2);
    expect(relationships[0]?.nextLesson?.reference).toBe('BK-1');
    expect(relationships[0]?.teaching.map((entry) => entry.studentPreferredName)).toEqual([
      'Mila',
      'Theo',
    ]);
    expect(relationships[1]?.nextLesson).toBeNull();
    expect(relationships[1]?.lastLesson?.reference).toBe('BK-PAST');
  });

  it('does not count a cancelled booking as a relationship', () => {
    expect(tutorRelationships([booking({ statusCode: 'cancelled' })], NOW)).toEqual([]);
  });
});

describe('recent updates', () => {
  it('are built only from records, newest first', () => {
    const updates = recentUpdates({
      requests: [
        request(),
        request({
          reference: 'LR-EXPIRED',
          statusCode: 'closed',
          closeReasonCode: 'request_expired',
          createdAt: hours(-30),
          closedAt: hours(-1),
        }),
      ],
      bookings: [booking()],
      payments: [
        payment({
          refunds: [
            {
              reference: 'RF-1',
              statusCode: 'succeeded',
              amountMinor: 4000n,
              currencyCode: 'NZD',
              requestedAt: hours(-4),
              completedAt: hours(-3),
            },
          ],
        }),
      ],
    });
    expect(updates.map((entry) => entry.title)).toEqual([
      'A request expired',
      'Request sent',
      'Payment refunded',
      'Request sent',
      'Booking confirmed',
    ]);
  });

  it('are empty for a family with no history', () => {
    expect(recentUpdates({ requests: [], bookings: [], payments: [] })).toEqual([]);
  });

  it('do not announce why a request closed when another tutor was simply chosen', () => {
    const updates = recentUpdates({
      requests: [
        request({
          statusCode: 'closed',
          closeReasonCode: 'another_tutor_selected',
          closedAt: hours(-1),
        }),
      ],
      bookings: [],
      payments: [],
    });
    expect(updates.map((entry) => entry.title)).toEqual(['Request sent']);
  });
});

describe('calendar', () => {
  it('places an instant on its day in the lesson’s own zone', () => {
    // 11:30 UTC on the 10th is already the 11th in Auckland.
    expect(localDateKey(new Date('2026-10-10T11:30:00Z'), 'Pacific/Auckland')).toBe('2026-10-11');
    expect(localDateKey(new Date('2026-10-10T11:30:00Z'), 'UTC')).toBe('2026-10-10');
  });

  it('lays a month out in Monday-first weeks', () => {
    // 1 October 2026 is a Thursday.
    const weeks = monthWeeks(2026, 10);
    expect(weeks[0]?.map((day) => day.dayOfMonth)).toEqual([null, null, null, 1, 2, 3, 4]);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks.flat().filter((day) => day.dateKey !== null)).toHaveLength(31);
    expect(weeks.flat().find((day) => day.dayOfMonth === 9)?.dateKey).toBe('2026-10-09');
  });

  it('accepts only a real month, and steps across a year end', () => {
    expect(parseMonth('2026-10')).toEqual({ year: 2026, month: 10 });
    expect(parseMonth('2026-13')).toBeNull();
    expect(parseMonth('nonsense')).toBeNull();
    expect(parseMonth(undefined)).toBeNull();
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });
});

describe('navigation', () => {
  const active = (pathname: string): string[] =>
    PARENT_NAV.filter((item) => isActiveNavItem(item, pathname)).map((item) => item.label);

  it('marks exactly one destination, including on the shared routes', () => {
    expect(active('/parent')).toEqual(['Home']);
    expect(active('/parent/students/STUDENT-1')).toEqual(['Students']);
    expect(active('/parent/subjects/new')).toEqual(['Students']);
    expect(active('/parent/bookings')).toEqual(['Bookings']);
    expect(active('/requests/LR-1/pay')).toEqual(['Bookings']);
    expect(active('/parent/payments')).toEqual(['Payments']);
    expect(active('/tutors/TUTOR-1')).toEqual(['Tutors']);
    expect(active('/shortlist/abc')).toEqual(['Tutors']);
    expect(active('/parent/book')).toEqual(['Bookings']);
  });
});
