import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabaseClient } from '../client';
import {
  listConfirmedBookingsForTutorWeek,
  listUpcomingConfirmedBookingsForTutor,
} from '../repositories/tutor-schedule';
import { paymentFixtures } from './helpers/payment-fixtures';

async function databaseAvailable(): Promise<boolean> {
  const { sql } = createDatabaseClient();
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await sql.end();
  }
}

describe.skipIf(!(await databaseAvailable()))('Tutor confirmed schedule (integration)', () => {
  const fixtures = paymentFixtures(2400);
  afterEach(async () => {
    await fixtures.cleanup();
  });

  it('returns only the tutor’s own upcoming confirmed bookings with minimal fields', async () => {
    const fixture = await fixtures.confirmed();
    const now = new Date();
    const own = await listUpcomingConfirmedBookingsForTutor(fixture.tutorProfileId, now);
    expect(own.length).toBeGreaterThan(0);
    expect(own[0]!.scheduledEndAt.getTime()).toBeGreaterThan(now.getTime());
    expect(Object.keys(own[0]!).sort()).toEqual([
      'lessonFormatCode',
      'reference',
      'scheduledEndAt',
      'scheduledStartAt',
      'studentPreferredName',
      'subjectDisplayName',
      'timeZone',
    ]);
    expect(await listUpcomingConfirmedBookingsForTutor(randomUUID(), now)).toEqual([]);
    const { sql } = createDatabaseClient();
    try {
      const [row] = await sql`
        select reference from bookings.bookings
        where intended_lesson_request_id = ${fixture.ilrId}::uuid`;
      const reference = row!['reference'] as string;
      expect(own.some((entry) => entry.reference === reference)).toBe(true);
      const booking = own.find((entry) => entry.reference === reference)!;
      const week = await listConfirmedBookingsForTutorWeek(
        fixture.tutorProfileId,
        booking.scheduledStartAt,
        booking.scheduledEndAt,
      );
      expect(week.some((entry) => entry.reference === reference)).toBe(true);
      expect(
        await listConfirmedBookingsForTutorWeek(
          randomUUID(),
          booking.scheduledStartAt,
          booking.scheduledEndAt,
        ),
      ).toEqual([]);
      const others = await sql`
        select id::text as id from tutors.tutor_profiles
        where id <> ${fixture.tutorProfileId}::uuid`;
      for (const other of others) {
        const schedule = await listUpcomingConfirmedBookingsForTutor(other['id'] as string, now);
        expect(schedule.some((entry) => entry.reference === reference)).toBe(false);
      }
      // PostgreSQL timestamps retain microseconds; JS Date retains milliseconds.
      // Align the fixture's end to milliseconds before testing the exact boundary.
      await sql`
        update bookings.bookings
        set scheduled_end_at = date_trunc('milliseconds', scheduled_end_at)
        where intended_lesson_request_id = ${fixture.ilrId}::uuid`;
      const future = own.find((entry) => entry.reference === reference)!.scheduledEndAt;
      const beforeEnd = new Date(future.getTime() - 1);
      const ongoing = await listUpcomingConfirmedBookingsForTutor(
        fixture.tutorProfileId,
        beforeEnd,
      );
      expect(ongoing.some((entry) => entry.reference === reference)).toBe(true);
      const elapsed = await listUpcomingConfirmedBookingsForTutor(fixture.tutorProfileId, future);
      expect(elapsed.some((entry) => entry.reference === reference)).toBe(false);
      await sql`
        update bookings.bookings set status_code = 'cancelled', cancelled_at = now()
        where intended_lesson_request_id = ${fixture.ilrId}::uuid`;
      const cancelled = await listUpcomingConfirmedBookingsForTutor(fixture.tutorProfileId, now);
      expect(cancelled.some((entry) => entry.reference === reference)).toBe(false);
      await sql`
        update bookings.bookings set status_code = 'pending_payment'
        where intended_lesson_request_id = ${fixture.ilrId}::uuid`;
      const unpaid = await listUpcomingConfirmedBookingsForTutor(fixture.tutorProfileId, now);
      expect(unpaid.some((entry) => entry.reference === reference)).toBe(false);
    } finally {
      await sql.end();
    }
  });
});
