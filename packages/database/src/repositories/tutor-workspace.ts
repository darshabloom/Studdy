import { eq, inArray } from 'drizzle-orm';
import { createDatabaseClient } from '../client';
import { bookings, studentProfiles, subjects, tutorTransfers } from '../schema/index';

/**
 * What a tutor may read about the lessons they have been booked for.
 *
 * SCOPED TO ONE TUTOR PROFILE, which the caller resolves from the session and
 * never from anything a browser sent. Every row is one of that tutor's own
 * bookings, so the students in it are students they actually teach.
 *
 * THE COLUMN LIST IS THE PRIVACY BOUNDARY, in the same way as the tutor request
 * projection (SP-006). About the student a tutor learns what a request already
 * told them — a first name, a school year, the subject — and nothing else: no
 * family name, no school. About the family they learn only WHETHER a guardian
 * booked, as a boolean; the family account, the person who booked and the
 * family's payment are not selected. About money they learn their own side:
 * the lesson price, Studdy's fee and what they earn, plus where their own
 * payout stands. Nothing of the parent's payment provider is here.
 */

export type TutorPayoutCode = 'pending' | 'sent' | 'failed' | 'reversed';

export interface TutorBookingView {
  readonly reference: string;
  /** pending_payment | confirmed | cancelled | completed */
  readonly statusCode: string;
  readonly scheduledStartAt: Date;
  readonly scheduledEndAt: Date;
  readonly durationMinutes: number;
  readonly timeZone: string;
  readonly lessonFormatCode: string;
  readonly studentReference: string;
  readonly studentPreferredName: string;
  readonly studentSchoolYearCode: string | null;
  readonly subjectDisplayName: string;
  /** True when a parent or guardian booked; false for a student booking alone. */
  readonly bookedByGuardian: boolean;
  readonly confirmedAt: Date | null;
  readonly currencyCode: string;
  /** The tutor's listed price for this lesson. */
  readonly lessonAmountMinor: bigint;
  readonly platformFeeAmountMinor: bigint;
  /**
   * What the tutor earns: the price less Studdy's fee.
   *
   * Named for what it is to the reader rather than after the ledger column it
   * is read from. The web layer is forbidden by test from naming the payout
   * column at all, so that no screen or action can grow a way to supply one;
   * this is a figure to show, and has its own name.
   */
  readonly earnsMinor: bigint;
  /** Where the tutor's payout for this lesson stands; null if none is recorded. */
  readonly payoutStatusCode: TutorPayoutCode | null;
  readonly payoutSentAt: Date | null;
}

/** The payout state that speaks for a lesson when retries left several rows. */
const PAYOUT_PRECEDENCE: readonly TutorPayoutCode[] = ['sent', 'pending', 'failed', 'reversed'];

/** Every booking for one tutor, soonest lesson first. */
export async function listBookingsForTutor(
  tutorProfileId: string,
): Promise<readonly TutorBookingView[]> {
  const { sql, db } = createDatabaseClient();
  try {
    const rows = await db
      .select({
        paymentId: bookings.paymentId,
        familyAccountId: bookings.familyAccountId,
        reference: bookings.reference,
        statusCode: bookings.statusCode,
        scheduledStartAt: bookings.scheduledStartAt,
        scheduledEndAt: bookings.scheduledEndAt,
        durationMinutes: bookings.durationMinutes,
        timeZone: bookings.ianaTimeZone,
        lessonFormatCode: bookings.lessonFormatCode,
        studentReference: studentProfiles.reference,
        studentPreferredName: studentProfiles.preferredName,
        studentSchoolYearCode: studentProfiles.schoolYearCode,
        subjectDisplayName: subjects.displayName,
        confirmedAt: bookings.confirmedAt,
        currencyCode: bookings.currencyCode,
        lessonAmountMinor: bookings.lessonAmountMinor,
        platformFeeAmountMinor: bookings.platformFeeAmountMinor,
        earnsMinor: bookings.tutorEntitlementMinor,
      })
      .from(bookings)
      .innerJoin(studentProfiles, eq(bookings.studentProfileId, studentProfiles.id))
      .innerJoin(subjects, eq(bookings.subjectId, subjects.id))
      .where(eq(bookings.tutorProfileId, tutorProfileId))
      .orderBy(bookings.scheduledStartAt);

    const paymentIds = rows.map((row) => row.paymentId).filter((id): id is string => id !== null);
    const transfers =
      paymentIds.length === 0
        ? []
        : await db
            .select({
              paymentId: tutorTransfers.paymentId,
              statusCode: tutorTransfers.statusCode,
              sentAt: tutorTransfers.sentAt,
            })
            .from(tutorTransfers)
            .where(inArray(tutorTransfers.paymentId, paymentIds));

    return rows.map(({ paymentId, familyAccountId, ...row }) => {
      const own = transfers.filter((transfer) => transfer.paymentId === paymentId);
      const payoutStatusCode =
        PAYOUT_PRECEDENCE.find((code) => own.some((transfer) => transfer.statusCode === code)) ??
        null;
      return {
        ...row,
        bookedByGuardian: familyAccountId !== null,
        payoutStatusCode,
        payoutSentAt:
          payoutStatusCode === 'sent'
            ? (own.find((transfer) => transfer.statusCode === 'sent')?.sentAt ?? null)
            : null,
      };
    });
  } finally {
    await sql.end();
  }
}
