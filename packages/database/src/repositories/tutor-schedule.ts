import { and, asc, eq, gt, isNull } from 'drizzle-orm';
import { createDatabaseClient } from '../client';
import { bookings, studentProfiles, subjects } from '../schema/index';

/** Minimal private schedule projection. No family identifiers or payment data. */
export interface TutorScheduledBooking {
  readonly reference: string;
  readonly scheduledStartAt: Date;
  readonly scheduledEndAt: Date;
  readonly timeZone: string;
  readonly lessonFormatCode: string;
  readonly studentPreferredName: string;
  readonly subjectDisplayName: string;
}

/**
 * The caller must resolve the active tutor profile from the authenticated session.
 * Only confirmed, non-archived bookings whose scheduled end is in the future
 * qualify. This includes an ongoing booking without implying attendance.
 */
export async function listUpcomingConfirmedBookingsForTutor(
  tutorProfileId: string,
  now: Date,
): Promise<readonly TutorScheduledBooking[]> {
  const { sql, db } = createDatabaseClient();
  try {
    return await db
      .select({
        reference: bookings.reference,
        scheduledStartAt: bookings.scheduledStartAt,
        scheduledEndAt: bookings.scheduledEndAt,
        timeZone: bookings.ianaTimeZone,
        lessonFormatCode: bookings.lessonFormatCode,
        studentPreferredName: studentProfiles.preferredName,
        subjectDisplayName: subjects.displayName,
      })
      .from(bookings)
      .innerJoin(studentProfiles, eq(bookings.studentProfileId, studentProfiles.id))
      .innerJoin(subjects, eq(bookings.subjectId, subjects.id))
      .where(
        and(
          eq(bookings.tutorProfileId, tutorProfileId),
          eq(bookings.statusCode, 'confirmed'),
          isNull(bookings.archivedAt),
          isNull(studentProfiles.archivedAt),
          gt(bookings.scheduledEndAt, now),
        ),
      )
      .orderBy(asc(bookings.scheduledStartAt), asc(bookings.reference))
      .limit(4);
  } finally {
    await sql.end();
  }
}
