import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabaseClient } from '../client';
import { listBookingsForTutor } from '../repositories/tutor-workspace';
import { paymentFixtures, type PaymentFixture } from './helpers/payment-fixtures';

/**
 * WHAT A TUTOR MAY READ about the lessons they are booked for, against a real
 * Postgres.
 *
 * Asserted: a confirmed booking reaches its own tutor with the tutor's side of
 * the money and the state of their payout; another tutor is given nothing; and
 * the view carries no family identity and nothing of the parent's payment — not
 * hidden by a screen, absent from the row.
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

/** Things that exist on the underlying rows and must never reach a tutor. */
const NOT_FOR_TUTORS =
  /family|payer|bookedByUser|provider|charge|intent|failure|idempotency|familyName|school(?!Year)|totalCharged|userId/i;

describe.skipIf(!available)('tutor workspace (integration)', () => {
  const fixtures = paymentFixtures(2100);
  afterEach(async () => {
    await fixtures.cleanup();
  });

  const bookingReferenceFor = async (fixture: PaymentFixture): Promise<string> => {
    const { sql } = createDatabaseClient();
    try {
      const [row] = await sql`
        select reference from bookings.bookings
        where intended_lesson_request_id = ${fixture.ilrId}::uuid`;
      return row!['reference'] as string;
    } finally {
      await sql.end();
    }
  };

  it('shows a confirmed booking to its own tutor, with their side of the money', async () => {
    const fixture = await fixtures.confirmed({ lessonAmountMinor: 5500n });
    const reference = await bookingReferenceFor(fixture);

    const booking = (await listBookingsForTutor(fixture.tutorProfileId)).find(
      (entry) => entry.reference === reference,
    );
    expect(booking).toBeDefined();
    expect(booking!.statusCode).toBe('confirmed');
    expect(booking!.lessonAmountMinor).toBe(5500n);
    expect(booking!.platformFeeAmountMinor).toBe(550n);
    expect(booking!.earnsMinor).toBe(4950n);
    expect(booking!.currencyCode).toBe('NZD');
    expect(booking!.studentPreferredName.length).toBeGreaterThan(0);
    expect(booking!.studentReference).toMatch(/^STUDENT-/);
    expect(typeof booking!.bookedByGuardian).toBe('boolean');
    // Fulfilment records the obligation; nothing has been sent yet.
    expect(booking!.payoutStatusCode).toBe('pending');
    expect(booking!.payoutSentAt).toBeNull();
  });

  it('reports a payout once it has been sent', async () => {
    const fixture = await fixtures.confirmed();
    const reference = await bookingReferenceFor(fixture);
    const { sql } = createDatabaseClient();
    try {
      await sql`
        update payments.tutor_transfers
        set status_code = 'sent', sent_at = now(), provider_transfer_id = ${'tr_fix_' + randomUUID().slice(0, 8)}
        where payment_id = ${fixture.paymentId}::uuid`;
    } finally {
      await sql.end();
    }

    const booking = (await listBookingsForTutor(fixture.tutorProfileId)).find(
      (entry) => entry.reference === reference,
    );
    expect(booking!.payoutStatusCode).toBe('sent');
    expect(booking!.payoutSentAt).toBeInstanceOf(Date);
  });

  it('gives another tutor nothing', async () => {
    const fixture = await fixtures.confirmed();
    const reference = await bookingReferenceFor(fixture);

    expect(await listBookingsForTutor(randomUUID())).toEqual([]);

    const { sql } = createDatabaseClient();
    try {
      const others = await sql`
        select id::text as id from tutors.tutor_profiles
        where id <> ${fixture.tutorProfileId}::uuid`;
      for (const other of others) {
        const theirs = await listBookingsForTutor(other['id'] as string);
        expect(theirs.some((entry) => entry.reference === reference)).toBe(false);
      }
    } finally {
      await sql.end();
    }
  });

  it('carries no family identity and nothing of the parent’s payment', async () => {
    const fixture = await fixtures.confirmed();
    const reference = await bookingReferenceFor(fixture);
    const booking = (await listBookingsForTutor(fixture.tutorProfileId)).find(
      (entry) => entry.reference === reference,
    );
    expect(booking).toBeDefined();
    for (const key of Object.keys(booking!)) {
      expect(key, key).not.toMatch(NOT_FOR_TUTORS);
    }
  });
});
