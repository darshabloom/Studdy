import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabaseClient } from '../client';
import {
  listBookingsForStudents,
  listPaymentsForStudents,
  findBookingForStudents,
  updateDependentStudent,
} from '../repositories/family-overview';
import { listRequestsForStudents } from '../repositories/request-projections';
import { paymentFixtures, type PaymentFixture } from './helpers/payment-fixtures';

/**
 * WHAT A FAMILY MAY READ about its own bookings and money, against a real
 * Postgres.
 *
 * Three things are asserted, because they are what the Parent workspace rests
 * on: that a confirmed booking and its payment arrive through these views; that
 * the views are scoped to the student ids they are given and return nothing for
 * anyone else; and that no internal money figure is present on them at all —
 * not hidden by a screen, but absent from the row.
 *
 * Every booking here is produced by the REAL fulfilment command.
 */

async function databaseAvailable(): Promise<boolean> {
  try {
    const { sql } = createDatabaseClient();
    await sql`select 1`;
    await sql.end();
    return true;
  } catch {
    return false;
  }
}

const available = await databaseAvailable();

/** Columns that exist on the underlying rows and must never reach a family. */
const INTERNAL_FIELDS =
  /fee|entitlement|commission|provider|bps|ruleVersion|tax|failure|idempotency|payer|bookedBy/i;

describe.skipIf(!available)('family overview (integration)', () => {
  const fixtures = paymentFixtures(1700);
  const createdStudentIds: string[] = [];
  const createdFamilyIds: string[] = [];

  afterEach(async () => {
    await fixtures.cleanup();
    const { sql } = createDatabaseClient();
    try {
      if (createdStudentIds.length > 0) {
        await sql`delete from students.student_profiles where id = any(${createdStudentIds}::uuid[])`;
        createdStudentIds.length = 0;
      }
      if (createdFamilyIds.length > 0) {
        await sql`delete from families.family_accounts where id = any(${createdFamilyIds}::uuid[])`;
        createdFamilyIds.length = 0;
      }
    } finally {
      await sql.end();
    }
  });

  /**
   * Whose request the fixture made, and its reference. Other integration files
   * use the same seeded student, so every assertion below picks ITS OWN rows
   * out by reference rather than taking the first one returned.
   */
  const ownerOf = async (
    fixture: PaymentFixture,
  ): Promise<{ studentId: string; requestReference: string }> => {
    const { sql } = createDatabaseClient();
    try {
      const [row] = await sql`
        select sss.student_profile_id::text as student_profile_id, ilr.reference
        from bookings.intended_lesson_requests ilr
        join students.student_subject_sections sss on sss.id = ilr.student_subject_section_id
        where ilr.id = ${fixture.ilrId}::uuid`;
      return {
        studentId: row!['student_profile_id'] as string,
        requestReference: row!['reference'] as string,
      };
    } finally {
      await sql.end();
    }
  };

  const familyWithStudent = async (): Promise<{ familyAccountId: string; studentId: string }> => {
    const { sql } = createDatabaseClient();
    try {
      const [family] = await sql`
        insert into families.family_accounts (display_name, primary_country_code, default_currency_code)
        values (${'Fixture family ' + randomUUID().slice(0, 8)}, 'NZ', 'NZD')
        returning id::text as id`;
      const familyAccountId = family!['id'] as string;
      createdFamilyIds.push(familyAccountId);
      const [student] = await sql`
        insert into students.student_profiles
          (default_family_account_id, preferred_name, school_year_code,
           independence_status_code, login_access_state_code)
        values (${familyAccountId}::uuid, 'Fixture', 'year_8', 'dependent', 'parent_managed')
        returning id::text as id`;
      const studentId = student!['id'] as string;
      createdStudentIds.push(studentId);
      return { familyAccountId, studentId };
    } finally {
      await sql.end();
    }
  };

  it('shows a confirmed booking and its payment to the student it belongs to', async () => {
    const fixture = await fixtures.confirmed({ lessonAmountMinor: 5500n });
    const { studentId, requestReference } = await ownerOf(fixture);

    const bookings = await listBookingsForStudents([studentId]);
    const booking = bookings.find((entry) => entry.requestReference === requestReference);
    expect(booking).toBeDefined();
    expect(booking!.statusCode).toBe('confirmed');
    expect(booking!.totalChargedMinor).toBe(5500n);
    expect(booking!.currencyCode).toBe('NZD');
    expect(booking!.durationMinutes).toBe(60);
    expect(booking!.studentProfileId).toBe(studentId);
    expect(booking!.tutorFirstName.length).toBeGreaterThan(0);
    expect(booking!.confirmedAt).toBeInstanceOf(Date);
    expect(await findBookingForStudents(booking!.reference, [studentId])).toEqual(booking);

    const payments = await listPaymentsForStudents([studentId]);
    const payment = payments.find((entry) => entry.reference === fixture.paymentReference);
    expect(payment).toBeDefined();
    expect(payment!.statusCode).toBe('succeeded');
    expect(payment!.refundRequired).toBe(false);
    expect(payment!.bookingReference).toBe(booking!.reference);
    expect(payment!.totalChargedMinor).toBe(5500n);
    expect(payment!.lessonStartAt?.getTime()).toBe(booking!.scheduledStartAt.getTime());
    expect(payment!.refunds).toEqual([]);

    // The request that became this booking is `fulfilled`, and carries the
    // timestamps the Recent Updates feed sorts on.
    const requests = await listRequestsForStudents([studentId]);
    const request = requests.find((entry) => entry.reference === booking!.requestReference);
    expect(request?.statusCode).toBe('fulfilled');
    expect(request?.createdAt).toBeInstanceOf(Date);
    expect(request?.studentProfileId).toBe(studentId);
  });

  it('carries no internal money figure on either view', async () => {
    const fixture = await fixtures.confirmed();
    const { studentId, requestReference } = await ownerOf(fixture);

    const booking = (await listBookingsForStudents([studentId])).find(
      (entry) => entry.requestReference === requestReference,
    );
    const payment = (await listPaymentsForStudents([studentId])).find(
      (entry) => entry.reference === fixture.paymentReference,
    );
    expect(booking).toBeDefined();
    expect(payment).toBeDefined();
    for (const key of [...Object.keys(booking!), ...Object.keys(payment!)]) {
      expect(key, key).not.toMatch(INTERNAL_FIELDS);
    }
  });

  it('returns nothing for a student the caller was not given', async () => {
    const fixture = await fixtures.confirmed();
    const { studentId, requestReference } = await ownerOf(fixture);
    const stranger = randomUUID();

    expect(await listBookingsForStudents([stranger])).toEqual([]);
    expect(await listPaymentsForStudents([stranger])).toEqual([]);
    expect(await listBookingsForStudents([])).toEqual([]);
    expect(await listPaymentsForStudents([])).toEqual([]);

    const booking = (await listBookingsForStudents([studentId])).find(
      (entry) => entry.requestReference === requestReference,
    );
    expect(await findBookingForStudents(booking!.reference, [stranger])).toBeNull();
  });

  it('shows a payment that arrived with no booking as owed back, with no booking', async () => {
    const fixture = await fixtures.flaggedForRefund();
    const { studentId, requestReference } = await ownerOf(fixture);

    const payments = await listPaymentsForStudents([studentId]);
    const payment = payments.find((entry) => entry.reference === fixture.paymentReference);
    expect(payment).toBeDefined();
    expect(payment!.statusCode).toBe('succeeded');
    expect(payment!.refundRequired).toBe(true);
    expect(payment!.bookingReference).toBeNull();

    const bookings = await listBookingsForStudents([studentId]);
    expect(payment!.requestReference).toBe(requestReference);
    expect(bookings.some((entry) => entry.requestReference === requestReference)).toBe(false);
  });

  it('lets a guardian correct a student in their own family, and only there', async () => {
    const mine = await familyWithStudent();
    const theirs = await familyWithStudent();
    const { sql } = createDatabaseClient();
    try {
      const [actor] = await sql`select id::text as id from identity.users limit 1`;
      const actorUserId = actor!['id'] as string;
      const change = {
        actorUserId,
        preferredName: 'Corrected',
        familyName: 'Name',
        schoolYearCode: 'year_9',
        schoolOrProviderName: 'A school',
      };

      // Another family's student, addressed with MY family: nothing changes.
      expect(
        await updateDependentStudent({
          ...change,
          studentProfileId: theirs.studentId,
          familyAccountId: mine.familyAccountId,
        }),
      ).toBe(false);
      const [untouched] = await sql`
        select preferred_name from students.student_profiles where id = ${theirs.studentId}::uuid`;
      expect(untouched!['preferred_name']).toBe('Fixture');

      expect(
        await updateDependentStudent({
          ...change,
          studentProfileId: mine.studentId,
          familyAccountId: mine.familyAccountId,
        }),
      ).toBe(true);
      const [changed] = await sql`
        select preferred_name, family_name, school_year_code, school_or_provider_name,
               updated_by_user_id::text as updated_by_user_id
        from students.student_profiles where id = ${mine.studentId}::uuid`;
      expect(changed).toMatchObject({
        preferred_name: 'Corrected',
        family_name: 'Name',
        school_year_code: 'year_9',
        school_or_provider_name: 'A school',
        updated_by_user_id: actorUserId,
      });

      // An independent student who keeps a family link is not a guardian's to edit.
      await sql`
        update students.student_profiles set independence_status_code = 'independent'
        where id = ${mine.studentId}::uuid`;
      expect(
        await updateDependentStudent({
          ...change,
          preferredName: 'Overwritten',
          studentProfileId: mine.studentId,
          familyAccountId: mine.familyAccountId,
        }),
      ).toBe(false);
    } finally {
      await sql.end();
    }
  });
});
