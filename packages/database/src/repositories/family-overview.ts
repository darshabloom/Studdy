import { and, desc, eq, inArray } from 'drizzle-orm';
import { createDatabaseClient } from '../client';
import {
  bookings,
  intendedLessonRequests,
  payments,
  refunds,
  studentProfiles,
  studentSubjectSections,
  subjects,
  tutorProfiles,
  tutorRequestTimeOptions,
  tutorRequests,
} from '../schema/index';

/**
 * What a family may read about its own bookings and its own money.
 *
 * SCOPED BY STUDENT, like the request projection beside it: the caller resolves
 * which student profiles the signed-in person may act for, and every read here
 * is filtered to those ids. Nothing is addressed by a bare reference alone.
 *
 * THE COLUMN LISTS ARE THE BOUNDARY. `bookings.bookings` and `payments.payments`
 * both carry Studdy's commission, the tutor's entitlement, the provider's cost
 * and provider identifiers. None of them is selected here, so no screen built
 * on these views can show a parent an internal figure by accident — there is no
 * field to reach for. A parent sees what they paid and what came back.
 *
 * NO OTHER FAMILY APPEARS. Every row is one of the caller's own students'
 * lessons; a tutor's wider calendar is never joined.
 */

export interface FamilyBookingView {
  readonly reference: string;
  /** pending_payment | confirmed | cancelled | completed */
  readonly statusCode: string;
  readonly scheduledStartAt: Date;
  readonly scheduledEndAt: Date;
  readonly durationMinutes: number;
  readonly timeZone: string;
  readonly lessonFormatCode: string;
  readonly studentProfileId: string;
  readonly studentReference: string;
  readonly studentPreferredName: string;
  readonly subjectDisplayName: string;
  readonly tutorFirstName: string;
  readonly tutorReference: string;
  readonly requestReference: string;
  readonly confirmedAt: Date | null;
  /** What the family paid for this lesson. */
  readonly totalChargedMinor: bigint;
  readonly currencyCode: string;
}

/** Every booking for the given student profiles, soonest lesson first. */
export async function listBookingsForStudents(
  studentProfileIds: readonly string[],
): Promise<readonly FamilyBookingView[]> {
  if (studentProfileIds.length === 0) return [];
  const { sql, db } = createDatabaseClient();
  try {
    return await db
      .select({
        reference: bookings.reference,
        statusCode: bookings.statusCode,
        scheduledStartAt: bookings.scheduledStartAt,
        scheduledEndAt: bookings.scheduledEndAt,
        durationMinutes: bookings.durationMinutes,
        timeZone: bookings.ianaTimeZone,
        lessonFormatCode: bookings.lessonFormatCode,
        studentProfileId: studentProfiles.id,
        studentReference: studentProfiles.reference,
        studentPreferredName: studentProfiles.preferredName,
        subjectDisplayName: subjects.displayName,
        tutorFirstName: tutorProfiles.publicFirstName,
        tutorReference: tutorProfiles.reference,
        requestReference: intendedLessonRequests.reference,
        confirmedAt: bookings.confirmedAt,
        totalChargedMinor: bookings.totalChargedMinor,
        currencyCode: bookings.currencyCode,
      })
      .from(bookings)
      .innerJoin(studentProfiles, eq(bookings.studentProfileId, studentProfiles.id))
      .innerJoin(subjects, eq(bookings.subjectId, subjects.id))
      .innerJoin(tutorProfiles, eq(bookings.tutorProfileId, tutorProfiles.id))
      .innerJoin(
        intendedLessonRequests,
        eq(bookings.intendedLessonRequestId, intendedLessonRequests.id),
      )
      .where(inArray(bookings.studentProfileId, [...studentProfileIds]))
      .orderBy(bookings.scheduledStartAt);
  } finally {
    await sql.end();
  }
}

/** One booking, scoped to student profiles the caller may act for. */
export async function findBookingForStudents(
  reference: string,
  studentProfileIds: readonly string[],
): Promise<FamilyBookingView | null> {
  const all = await listBookingsForStudents(studentProfileIds);
  return all.find((booking) => booking.reference === reference) ?? null;
}

export interface FamilyRefundView {
  readonly reference: string;
  /** requested | pending | succeeded | failed */
  readonly statusCode: string;
  readonly amountMinor: bigint;
  readonly currencyCode: string;
  readonly requestedAt: Date;
  readonly completedAt: Date | null;
}

export interface FamilyPaymentView {
  readonly reference: string;
  /** requires_payment | processing | succeeded | failed | cancelled | expired */
  readonly statusCode: string;
  /** The payment arrived but the lesson could not be booked; the money is owed back. */
  readonly refundRequired: boolean;
  readonly totalChargedMinor: bigint;
  readonly currencyCode: string;
  readonly createdAt: Date;
  readonly succeededAt: Date | null;
  readonly paymentDeadlineAt: Date;
  readonly requestReference: string;
  /** Null when the payment never became a booking. */
  readonly bookingReference: string | null;
  readonly studentProfileId: string;
  readonly studentPreferredName: string;
  readonly subjectDisplayName: string;
  readonly tutorFirstName: string;
  readonly tutorReference: string;
  /** The lesson this payment was for, when the chosen time is on record. */
  readonly lessonStartAt: Date | null;
  readonly timeZone: string;
  /** Oldest first. A failed attempt and its retry are both here. */
  readonly refunds: readonly FamilyRefundView[];
}

/** Every payment made for the given student profiles, newest first. */
export async function listPaymentsForStudents(
  studentProfileIds: readonly string[],
): Promise<readonly FamilyPaymentView[]> {
  if (studentProfileIds.length === 0) return [];
  const { sql, db } = createDatabaseClient();
  try {
    const rows = await db
      .select({
        id: payments.id,
        reference: payments.reference,
        statusCode: payments.statusCode,
        refundRequiredAt: payments.refundRequiredAt,
        totalChargedMinor: payments.totalChargedMinor,
        currencyCode: payments.currencyCode,
        createdAt: payments.createdAt,
        succeededAt: payments.succeededAt,
        paymentDeadlineAt: payments.paymentDeadlineAt,
        requestReference: intendedLessonRequests.reference,
        bookingReference: bookings.reference,
        studentProfileId: studentProfiles.id,
        studentPreferredName: studentProfiles.preferredName,
        subjectDisplayName: subjects.displayName,
        tutorFirstName: tutorProfiles.publicFirstName,
        tutorReference: tutorProfiles.reference,
        lessonStartAt: tutorRequestTimeOptions.startsAt,
        timeZone: intendedLessonRequests.timeZone,
      })
      .from(payments)
      .innerJoin(
        intendedLessonRequests,
        eq(payments.intendedLessonRequestId, intendedLessonRequests.id),
      )
      .innerJoin(
        studentSubjectSections,
        eq(intendedLessonRequests.studentSubjectSectionId, studentSubjectSections.id),
      )
      .innerJoin(studentProfiles, eq(studentSubjectSections.studentProfileId, studentProfiles.id))
      .innerJoin(subjects, eq(studentSubjectSections.subjectId, subjects.id))
      .innerJoin(tutorProfiles, eq(payments.tutorProfileId, tutorProfiles.id))
      .innerJoin(tutorRequests, eq(payments.tutorRequestId, tutorRequests.id))
      .leftJoin(
        tutorRequestTimeOptions,
        eq(tutorRequests.acceptedTimeOptionId, tutorRequestTimeOptions.id),
      )
      .leftJoin(bookings, eq(bookings.paymentId, payments.id))
      .where(inArray(studentSubjectSections.studentProfileId, [...studentProfileIds]))
      .orderBy(desc(payments.createdAt));

    if (rows.length === 0) return [];

    const refundRows = await db
      .select({
        paymentId: refunds.paymentId,
        reference: refunds.reference,
        statusCode: refunds.statusCode,
        amountMinor: refunds.amountMinor,
        currencyCode: refunds.currencyCode,
        requestedAt: refunds.requestedAt,
        completedAt: refunds.completedAt,
      })
      .from(refunds)
      .where(
        inArray(
          refunds.paymentId,
          rows.map((row) => row.id),
        ),
      )
      .orderBy(refunds.attempt);

    return rows.map(({ id, refundRequiredAt, ...row }) => ({
      ...row,
      refundRequired: refundRequiredAt !== null,
      refunds: refundRows
        .filter((refund) => refund.paymentId === id)
        .map(({ paymentId: _paymentId, ...refund }) => refund),
    }));
  } finally {
    await sql.end();
  }
}

export interface UpdateDependentStudentInput {
  readonly studentProfileId: string;
  /** The family the caller acts for. The update only lands inside it. */
  readonly familyAccountId: string;
  readonly actorUserId: string;
  readonly preferredName: string;
  readonly familyName: string | null;
  readonly schoolYearCode: string;
  readonly schoolOrProviderName: string | null;
}

/**
 * A guardian corrects a dependent student's details.
 *
 * The family and the dependent status are both in the WHERE clause, so a
 * student in another family, or an independent student who merely keeps a
 * family link (PD-007), is not updated whatever id is passed. Returns whether a
 * row changed.
 */
export async function updateDependentStudent(input: UpdateDependentStudentInput): Promise<boolean> {
  const { sql, db } = createDatabaseClient();
  try {
    const updated = await db
      .update(studentProfiles)
      .set({
        preferredName: input.preferredName,
        familyName: input.familyName,
        schoolYearCode: input.schoolYearCode,
        schoolOrProviderName: input.schoolOrProviderName,
        updatedByUserId: input.actorUserId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(studentProfiles.id, input.studentProfileId),
          eq(studentProfiles.defaultFamilyAccountId, input.familyAccountId),
          eq(studentProfiles.independenceStatusCode, 'dependent'),
          eq(studentProfiles.statusCode, 'active'),
        ),
      )
      .returning({ id: studentProfiles.id });
    return updated.length > 0;
  } finally {
    await sql.end();
  }
}
