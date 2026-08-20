import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDatabaseClient } from '../client';
import {
  authIdentityLinks,
  availabilityExceptions,
  availabilityRules,
  tutorProfiles,
  tutorTimeReservations,
} from '../schema/index';
import {
  archiveAvailabilityRule,
  bookableSlotsForTutors,
  createAvailabilityException,
  createAvailabilityRule,
  listAvailabilityExceptions,
  listAvailabilityRules,
  updateAvailabilityException,
  updateAvailabilityRule,
} from '../repositories/availability';

/**
 * Availability integration tests.
 *
 * Two things are proven here that a unit test cannot: that the derived query
 * really does subtract live reservations written by another party, and that a
 * private block reason cannot reach a family-facing result no matter what the
 * caller does with it.
 */

/**
 * Skip cleanly when there is no database, matching every other integration
 * test in this directory.
 *
 * `pnpm test` uses vitest's default include, so these files are picked up by
 * the unit run as well as by `test:integration`. Without this the DB-less CI
 * job fails on connection errors rather than skipping, which is exactly what
 * it did.
 */
async function databaseAvailable(): Promise<boolean> {
  try {
    const { sql: probe } = createDatabaseClient();
    await probe`select 1`;
    await probe.end();
    return true;
  } catch {
    return false;
  }
}

const available = await databaseAvailable();

const { sql, db } = createDatabaseClient();

let tutorAId: string;
let tutorBId: string;
let userId: string;
const createdRuleIds: string[] = [];
const createdExceptionIds: string[] = [];
const createdReservationIds: string[] = [];

async function tutorIdFor(email: string): Promise<string> {
  const [row] = await db
    .select({ id: tutorProfiles.id, userId: tutorProfiles.userId })
    .from(tutorProfiles)
    .innerJoin(authIdentityLinks, eq(authIdentityLinks.userId, tutorProfiles.userId))
    .where(eq(authIdentityLinks.authenticationEmail, email));
  if (row === undefined) throw new Error(`seeded tutor not found: ${email}`);
  userId = row.userId;
  return row.id;
}

/** A date in the future that falls on the given weekday, as 'YYYY-MM-DD'. */
function nextWeekday(dayOfWeek: number, weeksAhead = 1): Date {
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);
  const result = new Date(base.getTime() + weeksAhead * 7 * 86_400_000);
  while (result.getUTCDay() !== dayOfWeek) {
    result.setUTCDate(result.getUTCDate() + 1);
  }
  return result;
}

describe.skipIf(!available)('availability repository', () => {
  beforeAll(async () => {
    tutorAId = await tutorIdFor('tutor.a@local.studdy.test');
    tutorBId = await tutorIdFor('tutor.b@local.studdy.test');
  });

  afterAll(async () => {
    if (createdReservationIds.length > 0) {
      for (const id of createdReservationIds) {
        await sql`delete from availability.tutor_time_reservations where id = ${id}`;
      }
    }
    for (const id of createdExceptionIds) {
      await sql`delete from availability.availability_exceptions where id = ${id}`;
    }
    for (const id of createdRuleIds) {
      await sql`delete from availability.availability_rules where id = ${id}`;
    }
    await sql.end();
  });

  it('lists the seeded recurring rules for a tutor', async () => {
    const rules = await listAvailabilityRules(tutorAId);
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule.ianaTimeZone).toBe('Pacific/Auckland');
      expect(rule.dayOfWeek).toBeGreaterThanOrEqual(0);
      expect(rule.dayOfWeek).toBeLessThanOrEqual(6);
    }
  });

  it('derives bookable slots from the seeded rules', async () => {
    const now = new Date();
    const slots = await bookableSlotsForTutors({
      tutorProfileIds: [tutorAId],
      from: now,
      to: new Date(now.getTime() + 14 * 86_400_000),
      durationMinutes: 60,
      now,
    });
    const forTutor = slots.get(tutorAId) ?? [];
    expect(forTutor.length).toBeGreaterThan(0);
  });

  it('subtracts an active reservation from the derived slots', async () => {
    const now = new Date();
    const to = new Date(now.getTime() + 14 * 86_400_000);

    const before = (
      await bookableSlotsForTutors({
        tutorProfileIds: [tutorAId],
        from: now,
        to,
        durationMinutes: 60,
        now,
      })
    ).get(tutorAId);
    expect(before).toBeDefined();
    const target = before?.[0];
    expect(target).toBeDefined();
    if (target === undefined) return;

    // Occupy exactly that slot, the way an accepted request will.
    const [reservation] = await db
      .insert(tutorTimeReservations)
      .values({
        tutorProfileId: tutorAId,
        startAt: target.startAt,
        endAt: target.endAt,
        statusCode: 'active',
        reservationTypeCode: 'request_hold',
      })
      .returning({ id: tutorTimeReservations.id });
    if (reservation !== undefined) createdReservationIds.push(reservation.id);

    const after = (
      await bookableSlotsForTutors({
        tutorProfileIds: [tutorAId],
        from: now,
        to,
        durationMinutes: 60,
        now,
      })
    ).get(tutorAId);

    const stillOffered = (after ?? []).some(
      (slot) => slot.startAt.getTime() === target.startAt.getTime(),
    );
    expect(stillOffered).toBe(false);
  });

  it('subtracts a blocked period the tutor entered', async () => {
    const now = new Date();
    const to = new Date(now.getTime() + 21 * 86_400_000);

    const before = (
      await bookableSlotsForTutors({
        tutorProfileIds: [tutorBId],
        from: now,
        to,
        durationMinutes: 60,
        now,
      })
    ).get(tutorBId);
    const countBefore = (before ?? []).length;
    expect(countBefore).toBeGreaterThan(0);

    // Block the whole window.
    const exceptionId = await createAvailabilityException({
      tutorProfileId: tutorBId,
      createdByUserId: userId,
      startsAt: now,
      endsAt: to,
      effectCode: 'removes',
      reasonCode: 'medical_appointment',
      privateNote: 'Integration fixture: must never reach a family.',
    });
    createdExceptionIds.push(exceptionId);

    const after = (
      await bookableSlotsForTutors({
        tutorProfileIds: [tutorBId],
        from: now,
        to,
        durationMinutes: 60,
        now,
      })
    ).get(tutorBId);
    expect(after).toEqual([]);
  });

  it('never returns a reason, note or any field beyond the two instants', async () => {
    // THE PRIVACY ASSERTION. A blocked period with a real-looking private
    // reason exists for this tutor; the derived result must carry no trace of
    // it — not the reason, not the note, not even a marker that a gap is a
    // block rather than ordinary non-working time.
    const now = new Date();
    const slots = await bookableSlotsForTutors({
      tutorProfileIds: [tutorAId, tutorBId],
      from: now,
      to: new Date(now.getTime() + 14 * 86_400_000),
      durationMinutes: 60,
      now,
    });

    const serialised = JSON.stringify([...slots.entries()]);
    expect(serialised).not.toContain('medical_appointment');
    expect(serialised).not.toContain('personal_commitment');
    expect(serialised).not.toContain('Integration fixture');
    expect(serialised).not.toContain('reason');
    expect(serialised).not.toContain('privateNote');

    for (const [, tutorSlots] of slots) {
      for (const slot of tutorSlots) {
        expect(Object.keys(slot).sort()).toEqual(['endAt', 'startAt']);
      }
    }
  });

  it('keeps one tutor out of another tutor archive path', async () => {
    // Ownership is part of the WHERE clause, so tutor B cannot archive tutor
    // A's rule — it matches zero rows rather than being found and refused.
    const rules = await listAvailabilityRules(tutorAId);
    const victim = rules[0];
    expect(victim).toBeDefined();
    if (victim === undefined) return;

    const archived = await archiveAvailabilityRule(victim.id, tutorBId, userId);
    expect(archived).toBe(false);

    const stillThere = await listAvailabilityRules(tutorAId);
    expect(stillThere.some((rule) => rule.id === victim.id)).toBe(true);
  });

  it('creates a rule and returns it in the tutor own listing', async () => {
    const ruleId = await createAvailabilityRule({
      tutorProfileId: tutorBId,
      createdByUserId: userId,
      dayOfWeek: 6,
      localStartTime: '09:00',
      localEndTime: '11:00',
      ianaTimeZone: 'Pacific/Auckland',
      effectiveFrom: new Date().toISOString().slice(0, 10),
    });
    createdRuleIds.push(ruleId);

    const rules = await listAvailabilityRules(tutorBId);
    expect(rules.some((rule) => rule.id === ruleId)).toBe(true);
  });

  /**
   * The reason `updateAvailabilityRule` exists at all.
   *
   * A calendar resize is an edit of one rule, not a replacement of it. Were the
   * screen to archive and recreate instead, the id would change on every drag,
   * so this asserts the id survives — which is the whole point of the function.
   */
  it('updates a rule in place, keeping its identity', async () => {
    const ruleId = await createAvailabilityRule({
      tutorProfileId: tutorBId,
      createdByUserId: userId,
      dayOfWeek: 5,
      localStartTime: '09:00',
      localEndTime: '10:00',
      ianaTimeZone: 'Pacific/Auckland',
      effectiveFrom: new Date().toISOString().slice(0, 10),
    });
    createdRuleIds.push(ruleId);

    const updated = await updateAvailabilityRule(ruleId, tutorBId, userId, {
      dayOfWeek: 5,
      localStartTime: '09:00',
      localEndTime: '11:30',
    });
    expect(updated).toBe(true);

    const rules = await listAvailabilityRules(tutorBId);
    const found = rules.find((rule) => rule.id === ruleId);
    expect(found).toBeDefined();
    expect(found?.localEndTime).toBe('11:30:00');
    // The same row, not a replacement: exactly one rule still carries this id.
    expect(rules.filter((rule) => rule.id === ruleId)).toHaveLength(1);
  });

  it('keeps one tutor out of another tutor update path', async () => {
    const rules = await listAvailabilityRules(tutorAId);
    const victim = rules[0];
    expect(victim).toBeDefined();
    if (victim === undefined) return;

    const updated = await updateAvailabilityRule(victim.id, tutorBId, userId, {
      dayOfWeek: 0,
      localStartTime: '01:00',
      localEndTime: '02:00',
    });
    expect(updated).toBe(false);

    // Genuinely unchanged, not merely reported as refused.
    const after = await listAvailabilityRules(tutorAId);
    const stillThere = after.find((rule) => rule.id === victim.id);
    expect(stillThere?.localStartTime).toBe(victim.localStartTime);
    expect(stillThere?.dayOfWeek).toBe(victim.dayOfWeek);
  });

  it('refuses to update a rule that has been archived', async () => {
    const ruleId = await createAvailabilityRule({
      tutorProfileId: tutorBId,
      createdByUserId: userId,
      dayOfWeek: 4,
      localStartTime: '08:00',
      localEndTime: '09:00',
      ianaTimeZone: 'Pacific/Auckland',
      effectiveFrom: new Date().toISOString().slice(0, 10),
    });
    createdRuleIds.push(ruleId);
    expect(await archiveAvailabilityRule(ruleId, tutorBId, userId)).toBe(true);

    // An archived rule is history. Reviving it through an update would restore
    // availability the tutor believes they took down.
    const updated = await updateAvailabilityRule(ruleId, tutorBId, userId, {
      dayOfWeek: 4,
      localStartTime: '08:00',
      localEndTime: '12:00',
    });
    expect(updated).toBe(false);
  });

  it('moves an exception in place and leaves its private reason alone', async () => {
    const start = new Date(Date.now() + 10 * 86_400_000);
    start.setUTCMinutes(0, 0, 0);
    const exceptionId = await createAvailabilityException({
      tutorProfileId: tutorBId,
      createdByUserId: userId,
      startsAt: start,
      endsAt: new Date(start.getTime() + 3_600_000),
      effectCode: 'removes',
      reasonCode: 'personal_commitment',
      privateNote: 'Synthetic: moved, not rewritten.',
    });
    createdExceptionIds.push(exceptionId);

    const movedStart = new Date(start.getTime() + 7_200_000);
    const updated = await updateAvailabilityException(exceptionId, tutorBId, userId, {
      startsAt: movedStart,
      endsAt: new Date(movedStart.getTime() + 3_600_000),
    });
    expect(updated).toBe(true);

    const exceptions = await listAvailabilityExceptions(tutorBId, new Date());
    const found = exceptions.find((exception) => exception.id === exceptionId);
    expect(found?.startsAt.getTime()).toBe(movedStart.getTime());
    // Dragging a block to a different hour says nothing about why it is blocked.
    expect(found?.reasonCode).toBe('personal_commitment');
    expect(found?.privateNote).toBe('Synthetic: moved, not rewritten.');
  });

  it('keeps one tutor out of another tutor exception update path', async () => {
    const exceptions = await listAvailabilityExceptions(tutorBId, new Date());
    const victim = exceptions[0];
    expect(victim).toBeDefined();
    if (victim === undefined) return;

    const updated = await updateAvailabilityException(victim.id, tutorAId, userId, {
      startsAt: new Date(Date.now() + 400 * 86_400_000),
      endsAt: new Date(Date.now() + 401 * 86_400_000),
    });
    expect(updated).toBe(false);
  });

  /**
   * Format scoping proven against the real derivation, not just the pure
   * function: the column, the query and `bookableSlots` have to agree, and this
   * is the only place that can show they do.
   */
  it('offers format-scoped availability only to a matching request', async () => {
    // Four weeks out, deliberately: an earlier test in this file blocks tutor
    // B's next 21 days, and a rule inside that window would be removed before
    // format scoping ever got a say.
    const day = nextWeekday(3, 4);
    const date = day.toISOString().slice(0, 10);
    const ruleId = await createAvailabilityRule({
      tutorProfileId: tutorBId,
      createdByUserId: userId,
      dayOfWeek: 3,
      localStartTime: '09:00',
      localEndTime: '12:00',
      ianaTimeZone: 'Pacific/Auckland',
      effectiveFrom: date,
      lessonFormatCode: 'online',
    });
    createdRuleIds.push(ruleId);

    const from = new Date(day.getTime() - 86_400_000);
    const to = new Date(day.getTime() + 2 * 86_400_000);
    const forFormat = async (formatCode: 'online' | 'in_person' | undefined) =>
      (
        await bookableSlotsForTutors({
          tutorProfileIds: [tutorBId],
          from,
          to,
          durationMinutes: 60,
          now: from,
          ...(formatCode === undefined ? {} : { formatCode }),
        })
      ).get(tutorBId) ?? [];

    const online = await forFormat('online');
    const inPerson = await forFormat('in_person');
    const unscoped = await forFormat(undefined);

    // Counted rather than sliced by calendar day: 09:00 in Auckland is the
    // previous day in UTC, and filtering on a UTC date silently drops exactly
    // the slots under test.
    //
    // Every seeded rule is unscoped, so the difference between the two is
    // precisely this rule: three hours on a 30-minute grid, each an hour long,
    // is five starts (09:00 through 11:00).
    expect(inPerson.length).toBeGreaterThan(0);
    expect(online.length - inPerson.length).toBe(5);

    // Asking without a format must behave exactly as it always did: everything
    // contributes, including the scoped rule.
    expect(unscoped.length).toBe(online.length);
  });

  it('shows the tutor their own private note, unlike any family path', async () => {
    // Owns its fixture: the seed carries private notes of its own, so matching
    // on "first exception with a note" would assert against whichever row
    // happened to sort first rather than against a known one.
    const startsAt = nextWeekday(3, 3);
    const note = 'Integration fixture: must never reach a family.';
    const exceptionId = await createAvailabilityException({
      tutorProfileId: tutorBId,
      createdByUserId: userId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 3_600_000),
      effectCode: 'removes',
      reasonCode: 'medical_appointment',
      privateNote: note,
    });
    createdExceptionIds.push(exceptionId);

    const exceptions = await listAvailabilityExceptions(tutorBId, new Date(0));
    const mine = exceptions.find((exception) => exception.id === exceptionId);
    // The tutor's own workspace is the one place this is legitimately visible.
    expect(mine?.privateNote).toBe(note);
  });

  it('refuses a rule whose end time precedes its start', async () => {
    await expect(
      db.insert(availabilityRules).values({
        tutorProfileId: tutorBId,
        dayOfWeek: 3,
        localStartTime: '18:00',
        localEndTime: '16:00',
        ianaTimeZone: 'Pacific/Auckland',
        effectiveFrom: '2026-01-01',
      }),
    ).rejects.toThrow();
  });

  it('refuses an exception whose end precedes its start', async () => {
    const start = nextWeekday(2);
    await expect(
      db.insert(availabilityExceptions).values({
        tutorProfileId: tutorBId,
        startsAt: start,
        endsAt: new Date(start.getTime() - 3_600_000),
        effectCode: 'removes',
      }),
    ).rejects.toThrow();
  });

  it('refuses an unknown effect code', async () => {
    const start = nextWeekday(2);
    await expect(
      db.insert(availabilityExceptions).values({
        tutorProfileId: tutorBId,
        startsAt: start,
        endsAt: new Date(start.getTime() + 3_600_000),
        effectCode: 'maybe',
      }),
    ).rejects.toThrow();
  });

  it('has no browser-facing grant on either availability table', async () => {
    const grants = await sql`
      select grantee, table_name, privilege_type
      from information_schema.role_table_grants
      where table_schema = 'availability'
        and grantee in ('anon', 'authenticated')
    `;
    expect(grants).toEqual([]);
  });

  it('has row level security enabled with no policies on both tables', async () => {
    const rows = await sql`
      select c.relname, c.relrowsecurity,
             (select count(*) from pg_policy p where p.polrelid = c.oid)::int as policy_count
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'availability'
        and c.relname in ('availability_rules', 'availability_exceptions')
    `;
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row['relrowsecurity']).toBe(true);
      // RLS on with no policies is deny-all for non-owners: the fail-closed
      // third layer beneath the absent grants and the server-side projection.
      expect(row['policy_count']).toBe(0);
    }
  });

  it('leaves the browser roles without usage on the availability schema', async () => {
    const [row] = await sql`
      select
        has_schema_privilege('anon', 'availability', 'USAGE') as anon_usage,
        has_schema_privilege('authenticated', 'availability', 'USAGE') as authenticated_usage
    `;
    expect(row?.['anon_usage']).toBe(false);
    expect(row?.['authenticated_usage']).toBe(false);
  });
});
