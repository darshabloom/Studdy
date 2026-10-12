import { describe, expect, it } from 'vitest';
import type { TutorBookingView, TutorRequestView } from '@studdy/database';
import { isActiveNavItem } from '@/lib/parent/nav';
import { TUTOR_NAV } from './nav';
import {
  EARNING_LABELS,
  earningState,
  earningsSummary,
  isOpenTutorRequest,
  lessonStatus,
  needsAction,
  splitLessons,
  tutorStudents,
  weekSummary,
} from './overview';

const NOW = new Date('2026-10-12T00:00:00Z');
const hours = (count: number): Date => new Date(NOW.getTime() + count * 3_600_000);

function booking(overrides: Partial<TutorBookingView> = {}): TutorBookingView {
  return {
    reference: 'BK-1',
    statusCode: 'confirmed',
    scheduledStartAt: hours(24),
    scheduledEndAt: hours(25),
    durationMinutes: 60,
    timeZone: 'Pacific/Auckland',
    lessonFormatCode: 'online',
    studentReference: 'STUDENT-1',
    studentPreferredName: 'Mila',
    studentSchoolYearCode: 'year_9',
    subjectDisplayName: 'Mathematics',
    bookedByGuardian: true,
    confirmedAt: hours(-48),
    currencyCode: 'NZD',
    lessonAmountMinor: 4000n,
    platformFeeAmountMinor: 400n,
    earnsMinor: 3600n,
    payoutStatusCode: 'pending',
    payoutSentAt: null,
    ...overrides,
  };
}

const past = (overrides: Partial<TutorBookingView> = {}): TutorBookingView =>
  booking({ scheduledStartAt: hours(-50), scheduledEndAt: hours(-49), ...overrides });

function request(overrides: Partial<TutorRequestView> = {}): TutorRequestView {
  return {
    reference: 'TREQ-1',
    statusCode: 'sent',
    respondByAt: hours(6),
    sentAt: hours(-1),
    offeredTimes: [
      {
        tutorRequestTimeOptionId: 'opt-1',
        startAt: hours(30),
        endAt: hours(31),
        statusCode: 'offered',
      },
    ],
    durationMinutes: 60,
    formatCode: 'online',
    timeZone: 'Pacific/Auckland',
    notesForTutors: null,
    subjectDisplayName: 'Mathematics',
    studentPreferredName: 'Theo',
    studentSchoolYearCode: 'year_10',
    serviceDisplayName: 'Maths tutoring',
    priceAmountMinor: 4000n,
    currencyCode: 'NZD',
    holdExpiresAt: null,
    holdStatusCode: null,
    holdTypeCode: null,
    ...overrides,
  };
}

describe('lessons', () => {
  it('splits on whether the lesson has finished', () => {
    const { upcoming, past: gone } = splitLessons(
      [booking({ reference: 'BK-LATER' }), past({ reference: 'BK-GONE' })],
      NOW,
    );
    expect(upcoming.map((entry) => entry.reference)).toEqual(['BK-LATER']);
    expect(gone.map((entry) => entry.reference)).toEqual(['BK-GONE']);
  });

  it('never calls a lesson completed merely because its time has gone', () => {
    expect(lessonStatus(past(), NOW).label).toBe('Lesson time has passed');
    expect(lessonStatus(booking(), NOW).label).toBe('Confirmed');
    expect(lessonStatus(booking({ statusCode: 'completed' }), NOW).label).toBe('Completed');
  });
});

describe('students', () => {
  it('are the students with a booked lesson, one entry each, next lesson first', () => {
    const students = tutorStudents(
      [
        past({ reference: 'BK-A', studentReference: 'STUDENT-2', studentPreferredName: 'Ari' }),
        booking({ reference: 'BK-B' }),
        past({ reference: 'BK-C', subjectDisplayName: 'Calculus' }),
      ],
      NOW,
    );
    expect(students.map((entry) => entry.preferredName)).toEqual(['Mila', 'Ari']);
    expect(students[0]?.lessonCount).toBe(2);
    expect([...(students[0]?.subjects ?? [])].sort()).toEqual(['Calculus', 'Mathematics']);
    expect(students[0]?.nextLesson?.reference).toBe('BK-B');
    expect(students[1]?.nextLesson).toBeNull();
    expect(students[1]?.lastLesson?.reference).toBe('BK-A');
  });

  it('does not list a student whose only booking was cancelled', () => {
    expect(tutorStudents([booking({ statusCode: 'cancelled' })], NOW)).toEqual([]);
  });
});

describe('earnings', () => {
  it('places each lesson by where its money is', () => {
    expect(earningState(booking(), NOW)).toBe('upcoming');
    expect(earningState(past(), NOW)).toBe('pending');
    expect(earningState(past({ payoutStatusCode: null }), NOW)).toBe('pending');
    expect(earningState(past({ payoutStatusCode: 'sent' }), NOW)).toBe('paid');
    expect(earningState(past({ payoutStatusCode: 'failed' }), NOW)).toBe('delayed');
    expect(earningState(past({ payoutStatusCode: 'reversed' }), NOW)).toBe('none');
    expect(earningState(booking({ statusCode: 'cancelled' }), NOW)).toBe('none');
  });

  it('totals what the tutor earns, never the gross price', () => {
    const [summary] = earningsSummary(
      [
        booking(),
        past({ reference: 'BK-PENDING' }),
        past({ reference: 'BK-DELAYED', payoutStatusCode: 'failed' }),
        past({ reference: 'BK-PAID', payoutStatusCode: 'sent', earnsMinor: 4950n }),
        booking({ reference: 'BK-CANCELLED', statusCode: 'cancelled' }),
      ],
      NOW,
    );
    expect(summary).toEqual({
      currencyCode: 'NZD',
      upcomingMinor: 3600n,
      pendingMinor: 7200n,
      paidMinor: 4950n,
      earnedMinor: 12150n,
    });
  });

  it('is empty with no bookings, and keeps currencies apart', () => {
    expect(earningsSummary([], NOW)).toEqual([]);
    expect(
      earningsSummary([past(), past({ currencyCode: 'AUD' })], NOW).map(
        (entry) => entry.currencyCode,
      ),
    ).toEqual(['NZD', 'AUD']);
  });

  it('labels nothing in the family’s payment vocabulary', () => {
    for (const { label } of Object.values(EARNING_LABELS)) {
      expect(label).not.toMatch(/card|declin|stripe|payment intent|refund/i);
    }
  });
});

describe('needs action', () => {
  const base = { bookings: [], hasAvailability: true, canReceivePayments: true, now: NOW };

  it('lists unanswered requests soonest deadline first, and nothing that is the family’s move', () => {
    const items = needsAction({
      ...base,
      requests: [
        request({ reference: 'TREQ-LATER', respondByAt: hours(20) }),
        request({ reference: 'TREQ-SOON', respondByAt: hours(2) }),
        request({ reference: 'TREQ-ACCEPTED', statusCode: 'accepted' }),
        request({ reference: 'TREQ-CLOSED', statusCode: 'closed' }),
      ],
    });
    expect(items.map((entry) => entry.key)).toEqual(['TREQ-SOON', 'TREQ-LATER']);
    expect(items[0]?.href).toBe('/tutor/requests/TREQ-SOON');
  });

  it('asks for availability and payout setup only when they are missing', () => {
    expect(needsAction({ ...base, requests: [] })).toEqual([]);
    expect(
      needsAction({ ...base, requests: [], hasAvailability: false, canReceivePayments: false }).map(
        (entry) => entry.key,
      ),
    ).toEqual(['availability', 'payouts']);
  });
});

describe('the week', () => {
  const days = [0, 1, 2, 3, 4, 5, 6].map((index) => ({
    date: `2026-10-${String(12 + index)}`,
    startAt: hours(index * 24),
    endAt: hours((index + 1) * 24),
  }));

  it('places lessons and requested times on their day, beside the regular hours', () => {
    const week = weekSummary({
      days,
      bookings: [booking(), booking({ reference: 'BK-X', statusCode: 'cancelled' })],
      requests: [request(), request({ reference: 'TREQ-CLOSED', statusCode: 'closed' })],
      availableMinutesByDay: [0, 180, 0, 0, 0, 0, 0],
    });
    expect(week[1]?.lessons.map((entry) => entry.reference)).toEqual(['BK-1']);
    expect(week[1]?.requestCount).toBe(1);
    expect(week[1]?.availableMinutes).toBe(180);
    expect(week[0]?.lessons).toEqual([]);
    expect(week.reduce((count, day) => count + day.requestCount, 0)).toBe(1);
  });

  it('stops counting a request once it has become a paid lesson', () => {
    expect(isOpenTutorRequest(request())).toBe(true);
    expect(isOpenTutorRequest(request({ statusCode: 'accepted' }))).toBe(true);
    expect(
      isOpenTutorRequest(request({ statusCode: 'selected', holdTypeCode: 'booking_confirmed' })),
    ).toBe(false);
    expect(isOpenTutorRequest(request({ statusCode: 'declined' }))).toBe(false);
  });
});

describe('navigation', () => {
  const active = (pathname: string): string[] =>
    TUTOR_NAV.filter((item) => isActiveNavItem(item, pathname)).map((item) => item.label);

  it('has the six destinations, and marks exactly one', () => {
    expect(TUTOR_NAV.map((item) => item.label)).toEqual([
      'Home',
      'Calendar',
      'Students',
      'Lessons',
      'Earnings',
      'Resources',
    ]);
    expect(active('/tutor')).toEqual(['Home']);
    expect(active('/tutor/calendar')).toEqual(['Calendar']);
    expect(active('/tutor/requests/TREQ-1')).toEqual(['Calendar']);
    expect(active('/tutor/availability')).toEqual(['Calendar']);
    expect(active('/tutor/students/STUDENT-1')).toEqual(['Students']);
    expect(active('/tutor/lessons/BK-1')).toEqual(['Lessons']);
    expect(active('/tutor/payments')).toEqual(['Earnings']);
    expect(active('/tutor/resources')).toEqual(['Resources']);
    expect(active('/tutor/profile')).toEqual([]);
  });
});
