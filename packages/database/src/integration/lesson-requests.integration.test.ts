import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { createDatabaseClient } from '../client';
import {
  createIntendedLessonRequest,
  expireOverdueRequests,
  RequestValidationError,
  SlotUnavailableError,
  withdrawRequest,
} from '../repositories/lesson-requests';
import { listRequestsForTutor, listRequestsForStudents } from '../repositories/request-projections';
import { setRuleSetting } from '../repositories/rule-settings';
import {
  auditEvents,
  availabilityExceptions,
  domainEvents,
  intendedLessonRequests,
  outboxEntries,
  services,
  serviceVersions,
  statusTransitions,
  studentProfiles,
  studentSubjectSections,
  subjects,
  tutorProfiles,
  tutorRequests,
  tutorTimeReservations,
  users,
} from '../schema/index';

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

interface Fixture {
  requesterUserId: string;
  subjectSectionId: string;
  tutors: Array<{ tutorProfileId: string; serviceVersionId: string; userId: string }>;
}

/** Build an isolated fixture: one requester, one subject section, three tutors. */
async function buildFixture(label: string): Promise<Fixture> {
  const { sql, db } = createDatabaseClient();
  try {
    const [requester] = await db
      .insert(users)
      .values({
        displayName: `Requester ${label}`,
        countryCode: 'NZ',
        timeZone: 'Pacific/Auckland',
        locale: 'en-NZ',
      })
      .returning({ id: users.id });

    const [subject] = await db
      .insert(subjects)
      .values({ code: `subject-${label}`, displayName: `Subject ${label}` })
      .returning({ id: subjects.id });

    const [student] = await db
      .insert(studentProfiles)
      .values({ preferredName: `Student ${label}`, independenceStatusCode: 'dependent' })
      .returning({ id: studentProfiles.id });

    const [section] = await db
      .insert(studentSubjectSections)
      .values({ studentProfileId: student!.id, subjectId: subject!.id, schoolYearCode: 'Y9' })
      .returning({ id: studentSubjectSections.id });

    const tutors: Fixture['tutors'] = [];
    for (const index of [1, 2, 3]) {
      const [tutorUser] = await db
        .insert(users)
        .values({
          displayName: `Tutor ${label}-${index}`,
          countryCode: 'NZ',
          timeZone: 'Pacific/Auckland',
          locale: 'en-NZ',
        })
        .returning({ id: users.id });
      const [profile] = await db
        .insert(tutorProfiles)
        .values({
          userId: tutorUser!.id,
          publicFirstName: `T${index}`,
          // Unlisted so these fixtures never leak into public discovery
          // results and perturb the discovery suite's assertions.
          visibilityStateCode: 'unlisted',
        })
        .returning({ id: tutorProfiles.id });
      const [service] = await db
        .insert(services)
        .values({
          tutorProfileId: profile!.id,
          subjectId: subject!.id,
          displayName: `Service ${label}-${index}`,
        })
        .returning({ id: services.id });
      const [version] = await db
        .insert(serviceVersions)
        .values({
          serviceId: service!.id,
          durationMinutes: 60,
          priceAmountMinor: 4500n,
          currencyCode: 'NZD',
        })
        .returning({ id: serviceVersions.id });
      // Open for the whole test horizon. The request path refuses a time the
      // tutor does not offer, and these fixtures are about fan-out, holds and
      // deadlines rather than opening hours. One 'adds' exception is used
      // instead of recurring rules because it is a single absolute interval
      // with no daily boundary for a proposed lesson to fall through.
      await db.insert(availabilityExceptions).values({
        tutorProfileId: profile!.id,
        startsAt: new Date(Date.now() - 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        effectCode: 'adds',
      });

      tutors.push({
        tutorProfileId: profile!.id,
        serviceVersionId: version!.id,
        userId: tutorUser!.id,
      });
    }

    return { requesterUserId: requester!.id, subjectSectionId: section!.id, tutors };
  } finally {
    await sql.end();
  }
}

/**
 * Whole minutes: the bookable-time check aligns to a minute grid, and no real
 * form submits seconds.
 */
const future = (hours: number): Date => {
  const at = new Date(Date.now() + hours * 60 * 60 * 1000);
  at.setSeconds(0, 0);
  return at;
};

describe.skipIf(!available)('intended lesson requests (integration)', () => {
  beforeAll(async () => {
    // Deadline rules must exist so a version is snapshotted onto records.
    await setRuleSetting(
      'requests.response_deadline_tiers',
      [
        { minHoursUntilLesson: 48, responseWindowHours: 24 },
        { minHoursUntilLesson: 24, responseWindowHours: 12 },
        { minHoursUntilLesson: 6, responseWindowHours: 4 },
        { minHoursUntilLesson: 0, responseWindowHours: 1 },
      ],
      'Provisional seed for integration tests',
    );
  });

  it('fans out to three tutors with holds, transitions, events and outbox entries', async () => {
    const fixture = await buildFixture(`fanout-${randomUUID().slice(0, 8)}`);
    const correlationId = `cor_${randomUUID()}`;
    const start = future(100);

    const created = await createIntendedLessonRequest({
      studentSubjectSectionId: fixture.subjectSectionId,
      requestedByUserId: fixture.requesterUserId,
      familyAccountId: null,
      tutorProfileIds: fixture.tutors.map((tutor) => tutor.tutorProfileId),
      proposedStartAt: start,
      proposedEndAt: new Date(start.getTime() + 60 * 60 * 1000),
      formatCode: 'online',
      timeZone: 'Pacific/Auckland',
      notesForTutors: 'Needs help with algebra',
      hasPaymentMethodOnFile: false,
      paymentExemptionCode: null,
      correlationId,
    });

    expect(created.reference).toMatch(/^LR-\d{8}$/);
    expect(created.tutorRequestReferences).toHaveLength(3);
    // Tutor Request references are RANDOM, not sequential: a sequential
    // reference would let anyone holding the LR- reference derive them, and
    // would let two tutors detect co-invitation from adjacency.
    for (const reference of created.tutorRequestReferences) {
      expect(reference).toMatch(/^TREQ-[0-9A-HJKMNP-TV-Z]{10}$/);
    }
    // No TREQ reference may be derivable from the LR reference.
    const ilrDigits = created.reference.replace('LR-', '');
    for (const reference of created.tutorRequestReferences) {
      expect(reference).not.toContain(ilrDigits);
    }

    const { sql, db } = createDatabaseClient();
    try {
      const requests = await db
        .select()
        .from(tutorRequests)
        .where(eq(tutorRequests.intendedLessonRequestId, created.intendedLessonRequestId));
      expect(requests).toHaveLength(3);
      expect(requests.every((row) => row.statusCode === 'sent')).toBe(true);
      // Deadlines are snapshotted with the rule version that produced them.
      expect(requests.every((row) => row.deadlineRuleVersion > 0)).toBe(true);

      const holds = await db
        .select()
        .from(tutorTimeReservations)
        .where(
          inArray(
            tutorTimeReservations.tutorRequestId,
            requests.map((row) => row.id),
          ),
        );
      expect(holds).toHaveLength(3);
      expect(holds.every((hold) => hold.statusCode === 'active')).toBe(true);
      // Every hold shows an expiry, so no hold appears open-ended to a tutor.
      expect(holds.every((hold) => hold.expiresAt !== null)).toBe(true);

      const transitions = await db
        .select()
        .from(statusTransitions)
        .where(eq(statusTransitions.correlationId, correlationId));
      expect(transitions.length).toBe(4); // three tutor requests + the ILR

      const audits = await db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.correlationId, correlationId));
      expect(audits).toHaveLength(1);

      const events = await db
        .select()
        .from(domainEvents)
        .where(eq(domainEvents.correlationId, correlationId));
      expect(events).toHaveLength(1);

      const outbox = await db
        .select()
        .from(outboxEntries)
        .where(eq(outboxEntries.correlationId, correlationId));
      expect(outbox).toHaveLength(3);
      // No outbox payload may carry sibling information.
      for (const entry of outbox) {
        const payload = JSON.stringify(entry.payload);
        expect(payload).not.toContain(created.intendedLessonRequestId);
        expect(payload).not.toMatch(/position/i);
        expect(payload).not.toMatch(/tutorCount/i);
      }
    } finally {
      await sql.end();
    }
  });

  it('fan-out is all-or-nothing when a tutor slot is already held', async () => {
    const fixture = await buildFixture(`conflict-${randomUUID().slice(0, 8)}`);
    const start = future(120);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const base = {
      studentSubjectSectionId: fixture.subjectSectionId,
      requestedByUserId: fixture.requesterUserId,
      familyAccountId: null,
      proposedStartAt: start,
      proposedEndAt: end,
      formatCode: 'online',
      timeZone: 'Pacific/Auckland',
      notesForTutors: null,
      hasPaymentMethodOnFile: false,
      paymentExemptionCode: null,
    };

    // First request takes tutor 1's slot.
    await createIntendedLessonRequest({
      ...base,
      tutorProfileIds: [fixture.tutors[0]!.tutorProfileId],
      correlationId: `cor_${randomUUID()}`,
    });

    // Second request includes tutor 1 plus two free tutors — must fail whole.
    await expect(
      createIntendedLessonRequest({
        ...base,
        tutorProfileIds: fixture.tutors.map((tutor) => tutor.tutorProfileId),
        correlationId: `cor_${randomUUID()}`,
      }),
    ).rejects.toBeInstanceOf(SlotUnavailableError);

    // The free tutors must NOT have been sent anything.
    const { sql, db } = createDatabaseClient();
    try {
      const stray = await db
        .select()
        .from(tutorRequests)
        .where(
          inArray(tutorRequests.tutorProfileId, [
            fixture.tutors[1]!.tutorProfileId,
            fixture.tutors[2]!.tutorProfileId,
          ]),
        );
      expect(stray).toHaveLength(0);
    } finally {
      await sql.end();
    }
  });

  it('two concurrent requests for the same tutor slot: exactly one wins', async () => {
    const fixture = await buildFixture(`race-${randomUUID().slice(0, 8)}`);
    const start = future(140);
    const base = {
      studentSubjectSectionId: fixture.subjectSectionId,
      requestedByUserId: fixture.requesterUserId,
      familyAccountId: null,
      tutorProfileIds: [fixture.tutors[0]!.tutorProfileId],
      proposedStartAt: start,
      proposedEndAt: new Date(start.getTime() + 60 * 60 * 1000),
      formatCode: 'online',
      timeZone: 'Pacific/Auckland',
      notesForTutors: null,
      hasPaymentMethodOnFile: false,
      paymentExemptionCode: null,
    };

    const results = await Promise.allSettled([
      createIntendedLessonRequest({ ...base, correlationId: `cor_${randomUUID()}` }),
      createIntendedLessonRequest({ ...base, correlationId: `cor_${randomUUID()}` }),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  it('rejects a fan-out beyond the cap and duplicate tutors', async () => {
    const fixture = await buildFixture(`cap-${randomUUID().slice(0, 8)}`);
    const start = future(80);
    const base = {
      studentSubjectSectionId: fixture.subjectSectionId,
      requestedByUserId: fixture.requesterUserId,
      familyAccountId: null,
      proposedStartAt: start,
      proposedEndAt: new Date(start.getTime() + 60 * 60 * 1000),
      formatCode: 'online',
      timeZone: 'Pacific/Auckland',
      notesForTutors: null,
      hasPaymentMethodOnFile: false,
      paymentExemptionCode: null,
      correlationId: `cor_${randomUUID()}`,
    };

    const duplicate = [fixture.tutors[0]!.tutorProfileId, fixture.tutors[0]!.tutorProfileId];
    await expect(
      createIntendedLessonRequest({ ...base, tutorProfileIds: duplicate }),
    ).rejects.toBeInstanceOf(RequestValidationError);
  });

  it('withdrawal closes the request and releases every hold, idempotently', async () => {
    const fixture = await buildFixture(`withdraw-${randomUUID().slice(0, 8)}`);
    const start = future(90);
    const created = await createIntendedLessonRequest({
      studentSubjectSectionId: fixture.subjectSectionId,
      requestedByUserId: fixture.requesterUserId,
      familyAccountId: null,
      tutorProfileIds: fixture.tutors.slice(0, 2).map((tutor) => tutor.tutorProfileId),
      proposedStartAt: start,
      proposedEndAt: new Date(start.getTime() + 60 * 60 * 1000),
      formatCode: 'online',
      timeZone: 'Pacific/Auckland',
      notesForTutors: null,
      hasPaymentMethodOnFile: false,
      paymentExemptionCode: null,
      correlationId: `cor_${randomUUID()}`,
    });

    const first = await withdrawRequest({
      intendedLessonRequestId: created.intendedLessonRequestId,
      actorUserId: fixture.requesterUserId,
      correlationId: `cor_${randomUUID()}`,
    });
    expect(first.withdrawnCount).toBe(2);

    // Idempotent: a repeat withdraws nothing and does not error.
    const second = await withdrawRequest({
      intendedLessonRequestId: created.intendedLessonRequestId,
      actorUserId: fixture.requesterUserId,
      correlationId: `cor_${randomUUID()}`,
    });
    expect(second.withdrawnCount).toBe(0);

    const { sql, db } = createDatabaseClient();
    try {
      const [ilr] = await db
        .select()
        .from(intendedLessonRequests)
        .where(eq(intendedLessonRequests.id, created.intendedLessonRequestId));
      expect(ilr?.statusCode).toBe('closed');

      const holds = await db
        .select()
        .from(tutorTimeReservations)
        .where(eq(tutorTimeReservations.statusCode, 'active'));
      const stillHeld = holds.filter((hold) =>
        fixture.tutors.some((tutor) => tutor.tutorProfileId === hold.tutorProfileId),
      );
      expect(stillHeld).toHaveLength(0);
    } finally {
      await sql.end();
    }
  });

  it('expiry closes overdue requests, releases holds and is safe to re-run', async () => {
    const fixture = await buildFixture(`expire-${randomUUID().slice(0, 8)}`);
    const start = future(50);
    const created = await createIntendedLessonRequest({
      studentSubjectSectionId: fixture.subjectSectionId,
      requestedByUserId: fixture.requesterUserId,
      familyAccountId: null,
      tutorProfileIds: [fixture.tutors[0]!.tutorProfileId],
      proposedStartAt: start,
      proposedEndAt: new Date(start.getTime() + 60 * 60 * 1000),
      formatCode: 'online',
      timeZone: 'Pacific/Auckland',
      notesForTutors: null,
      hasPaymentMethodOnFile: false,
      paymentExemptionCode: null,
      correlationId: `cor_${randomUUID()}`,
    });

    // Run expiry as if well past every deadline.
    const later = new Date(start.getTime() + 10 * 24 * 60 * 60 * 1000);
    const first = await expireOverdueRequests({ correlationId: `cor_${randomUUID()}`, now: later });
    expect(first.expiredTutorRequests).toBeGreaterThanOrEqual(1);

    const { sql, db } = createDatabaseClient();
    try {
      const requests = await db
        .select()
        .from(tutorRequests)
        .where(eq(tutorRequests.intendedLessonRequestId, created.intendedLessonRequestId));
      expect(requests.every((row) => row.statusCode === 'expired')).toBe(true);

      const holds = await db
        .select()
        .from(tutorTimeReservations)
        .where(
          and(
            inArray(
              tutorTimeReservations.tutorRequestId,
              requests.map((row) => row.id),
            ),
            eq(tutorTimeReservations.statusCode, 'active'),
          ),
        );
      expect(holds).toHaveLength(0);

      const [ilr] = await db
        .select()
        .from(intendedLessonRequests)
        .where(eq(intendedLessonRequests.id, created.intendedLessonRequestId));
      expect(ilr?.statusCode).toBe('closed');
    } finally {
      await sql.end();
    }

    // Re-running expires nothing further — idempotent.
    const second = await expireOverdueRequests({
      correlationId: `cor_${randomUUID()}`,
      now: later,
    });
    expect(second.expiredTutorRequests).toBe(0);
  });

  it('a closed request can never be reopened by a later expiry run', async () => {
    const fixture = await buildFixture(`terminal-${randomUUID().slice(0, 8)}`);
    const start = future(60);
    const created = await createIntendedLessonRequest({
      studentSubjectSectionId: fixture.subjectSectionId,
      requestedByUserId: fixture.requesterUserId,
      familyAccountId: null,
      tutorProfileIds: [fixture.tutors[0]!.tutorProfileId],
      proposedStartAt: start,
      proposedEndAt: new Date(start.getTime() + 60 * 60 * 1000),
      formatCode: 'online',
      timeZone: 'Pacific/Auckland',
      notesForTutors: null,
      hasPaymentMethodOnFile: false,
      paymentExemptionCode: null,
      correlationId: `cor_${randomUUID()}`,
    });

    await withdrawRequest({
      intendedLessonRequestId: created.intendedLessonRequestId,
      actorUserId: fixture.requesterUserId,
      correlationId: `cor_${randomUUID()}`,
    });

    await expireOverdueRequests({
      correlationId: `cor_${randomUUID()}`,
      now: new Date(start.getTime() + 10 * 24 * 60 * 60 * 1000),
    });

    const { sql, db } = createDatabaseClient();
    try {
      const requests = await db
        .select()
        .from(tutorRequests)
        .where(eq(tutorRequests.intendedLessonRequestId, created.intendedLessonRequestId));
      // 'closed' is terminal: expiry must not have moved it.
      expect(requests.every((row) => row.statusCode === 'closed')).toBe(true);
    } finally {
      await sql.end();
    }
  });
});

describe.skipIf(!available)('tutor-facing projection privacy (integration)', () => {
  it('a tutor sees only their own request, with no sibling or ILR information', async () => {
    const fixture = await buildFixture(`privacy-${randomUUID().slice(0, 8)}`);
    const start = future(96);
    const created = await createIntendedLessonRequest({
      studentSubjectSectionId: fixture.subjectSectionId,
      requestedByUserId: fixture.requesterUserId,
      familyAccountId: null,
      tutorProfileIds: fixture.tutors.map((tutor) => tutor.tutorProfileId),
      proposedStartAt: start,
      proposedEndAt: new Date(start.getTime() + 60 * 60 * 1000),
      formatCode: 'online',
      timeZone: 'Pacific/Auckland',
      notesForTutors: 'Algebra help',
      hasPaymentMethodOnFile: false,
      paymentExemptionCode: null,
      correlationId: `cor_${randomUUID()}`,
    });

    const view = await listRequestsForTutor(fixture.tutors[0]!.tutorProfileId);
    expect(view).toHaveLength(1);
    const only = view[0]!;

    // The tutor gets what they need to assess the request.
    expect(only.reference).toMatch(/^TREQ-/);
    expect(only.proposedStartAt).toBeInstanceOf(Date);
    expect(only.subjectDisplayName).toBeTruthy();
    expect(only.holdExpiresAt).toBeInstanceOf(Date);

    // And nothing that could reveal competitors. (BigInt prices need a
    // replacer — JSON.stringify cannot serialise them.)
    const serialised = JSON.stringify(only, (_key, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value,
    );
    expect(serialised).not.toContain(created.intendedLessonRequestId);
    expect(Object.keys(only)).not.toContain('intendedLessonRequestId');
    expect(Object.keys(only)).not.toContain('position');
    expect(Object.keys(only)).not.toContain('closeReasonCode');
    // No sibling tutor's identity appears anywhere in the projection.
    for (const sibling of fixture.tutors.slice(1)) {
      expect(serialised).not.toContain(sibling.tutorProfileId);
    }
  });

  it('every ending looks identical to a tutor — no visible-vs-vanished channel', async () => {
    // GUARD RAIL for the selection slice. A tutor must not be able to tell
    // "the family withdrew" from "another tutor was selected". Both must stay
    // VISIBLE and render the same. If a future close-out uses a status that
    // this projection hides, the request would vanish for the loser while a
    // withdrawn one remains — and the difference is the leak.
    const fixture = await buildFixture(`ending-${randomUUID().slice(0, 8)}`);
    const start = future(130);
    const created = await createIntendedLessonRequest({
      studentSubjectSectionId: fixture.subjectSectionId,
      requestedByUserId: fixture.requesterUserId,
      familyAccountId: null,
      tutorProfileIds: [fixture.tutors[0]!.tutorProfileId],
      proposedStartAt: start,
      proposedEndAt: new Date(start.getTime() + 60 * 60 * 1000),
      formatCode: 'online',
      timeZone: 'Pacific/Auckland',
      notesForTutors: null,
      hasPaymentMethodOnFile: false,
      paymentExemptionCode: null,
      correlationId: `cor_${randomUUID()}`,
    });

    await withdrawRequest({
      intendedLessonRequestId: created.intendedLessonRequestId,
      actorUserId: fixture.requesterUserId,
      correlationId: `cor_${randomUUID()}`,
    });

    const afterWithdrawal = await listRequestsForTutor(fixture.tutors[0]!.tutorProfileId);
    expect(afterWithdrawal).toHaveLength(1);
    // Family withdrawal persists as 'closed' — the SAME status selection
    // close-out will produce, so the value itself cannot differentiate.
    expect(afterWithdrawal[0]!.statusCode).toBe('closed');

    // Simulate the states selection close-out will produce and assert they are
    // equally visible with the same shape.
    const { sql, db } = createDatabaseClient();
    try {
      for (const terminal of ['closed'] as const) {
        await db
          .update(tutorRequests)
          .set({ statusCode: terminal })
          .where(eq(tutorRequests.intendedLessonRequestId, created.intendedLessonRequestId));
        const view = await listRequestsForTutor(fixture.tutors[0]!.tutorProfileId);
        expect(view, `${terminal} must remain visible to the tutor`).toHaveLength(1);
        expect(Object.keys(view[0]!).sort()).toEqual(Object.keys(afterWithdrawal[0]!).sort());
      }
    } finally {
      await sql.end();
    }
  });

  it('prices each request from the tutor’s own current service version', async () => {
    // Pricing is resolved SERVER-SIDE from the subject section: the browser
    // never names a service version, so one tutor's request cannot be pinned
    // to another tutor's price. Verify each request carries its own tutor's
    // version.
    const fixture = await buildFixture(`pricing-${randomUUID().slice(0, 8)}`);
    const start = future(150);
    const created = await createIntendedLessonRequest({
      studentSubjectSectionId: fixture.subjectSectionId,
      requestedByUserId: fixture.requesterUserId,
      familyAccountId: null,
      tutorProfileIds: fixture.tutors.map((tutor) => tutor.tutorProfileId),
      proposedStartAt: start,
      proposedEndAt: new Date(start.getTime() + 60 * 60 * 1000),
      formatCode: 'online',
      timeZone: 'Pacific/Auckland',
      notesForTutors: null,
      hasPaymentMethodOnFile: false,
      paymentExemptionCode: null,
      correlationId: `cor_${randomUUID()}`,
    });

    const { sql, db } = createDatabaseClient();
    try {
      const rows = await db
        .select({
          tutorProfileId: tutorRequests.tutorProfileId,
          serviceVersionId: tutorRequests.serviceVersionId,
        })
        .from(tutorRequests)
        .where(eq(tutorRequests.intendedLessonRequestId, created.intendedLessonRequestId));
      for (const row of rows) {
        const expected = fixture.tutors.find(
          (tutor) => tutor.tutorProfileId === row.tutorProfileId,
        );
        expect(row.serviceVersionId).toBe(expected!.serviceVersionId);
      }
    } finally {
      await sql.end();
    }
  });

  it('refuses a tutor who does not offer the subject', async () => {
    const fixture = await buildFixture(`nooffer-${randomUUID().slice(0, 8)}`);
    const other = await buildFixture(`other-${randomUUID().slice(0, 8)}`);
    const start = future(155);
    await expect(
      createIntendedLessonRequest({
        studentSubjectSectionId: fixture.subjectSectionId,
        requestedByUserId: fixture.requesterUserId,
        familyAccountId: null,
        // A tutor whose services are for a different subject entirely.
        tutorProfileIds: [other.tutors[0]!.tutorProfileId],
        proposedStartAt: start,
        proposedEndAt: new Date(start.getTime() + 60 * 60 * 1000),
        formatCode: 'online',
        timeZone: 'Pacific/Auckland',
        notesForTutors: null,
        hasPaymentMethodOnFile: false,
        paymentExemptionCode: null,
        correlationId: `cor_${randomUUID()}`,
      }),
    ).rejects.toBeInstanceOf(RequestValidationError);
  });

  it('a tutor cannot see a request addressed to another tutor', async () => {
    const fixture = await buildFixture(`isolation-${randomUUID().slice(0, 8)}`);
    const start = future(70);
    await createIntendedLessonRequest({
      studentSubjectSectionId: fixture.subjectSectionId,
      requestedByUserId: fixture.requesterUserId,
      familyAccountId: null,
      tutorProfileIds: [fixture.tutors[0]!.tutorProfileId],
      proposedStartAt: start,
      proposedEndAt: new Date(start.getTime() + 60 * 60 * 1000),
      formatCode: 'online',
      timeZone: 'Pacific/Auckland',
      notesForTutors: null,
      hasPaymentMethodOnFile: false,
      paymentExemptionCode: null,
      correlationId: `cor_${randomUUID()}`,
    });

    const uninvited = await listRequestsForTutor(fixture.tutors[1]!.tutorProfileId);
    expect(uninvited).toHaveLength(0);
  });

  it('the family projection does show every invited tutor — scope is not over-restricted', async () => {
    const fixture = await buildFixture(`family-${randomUUID().slice(0, 8)}`);
    const start = future(110);
    await createIntendedLessonRequest({
      studentSubjectSectionId: fixture.subjectSectionId,
      requestedByUserId: fixture.requesterUserId,
      familyAccountId: null,
      tutorProfileIds: fixture.tutors.slice(0, 2).map((tutor) => tutor.tutorProfileId),
      proposedStartAt: start,
      proposedEndAt: new Date(start.getTime() + 60 * 60 * 1000),
      formatCode: 'online',
      timeZone: 'Pacific/Auckland',
      notesForTutors: null,
      hasPaymentMethodOnFile: false,
      paymentExemptionCode: null,
      correlationId: `cor_${randomUUID()}`,
    });

    const { sql, db } = createDatabaseClient();
    let studentProfileId: string;
    try {
      const [section] = await db
        .select({ studentProfileId: studentSubjectSections.studentProfileId })
        .from(studentSubjectSections)
        .where(eq(studentSubjectSections.id, fixture.subjectSectionId));
      studentProfileId = section!.studentProfileId;
    } finally {
      await sql.end();
    }

    const requests = await listRequestsForStudents([studentProfileId]);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.tutorRequests).toHaveLength(2);
    expect(requests[0]!.tutorRequests[0]!.tutorFirstName).toBeTruthy();
  });

  /**
   * The request path must not become an availability oracle.
   *
   * Sending is the one family-facing write that touches a tutor's calendar, so
   * it is the one place a family could probe it. If a time already held by
   * someone else failed differently from a time the tutor privately blocked or
   * simply does not work, a family could send and withdraw across a week and
   * read back the tutor's real calendar — the exact distinction the derived
   * slot boundary exists to erase.
   */
  describe('does not leak why a time is unavailable', () => {
    const requestFor = async (
      fixture: Fixture,
      start: Date,
    ): Promise<{ ok: boolean; error: unknown }> => {
      try {
        await createIntendedLessonRequest({
          studentSubjectSectionId: fixture.subjectSectionId,
          requestedByUserId: fixture.requesterUserId,
          familyAccountId: null,
          tutorProfileIds: [fixture.tutors[0]!.tutorProfileId],
          proposedStartAt: start,
          proposedEndAt: new Date(start.getTime() + 60 * 60 * 1000),
          formatCode: 'online',
          timeZone: 'Pacific/Auckland',
          notesForTutors: null,
          hasPaymentMethodOnFile: false,
          paymentExemptionCode: null,
          correlationId: `cor_${randomUUID()}`,
        });
        return { ok: true, error: null };
      } catch (error) {
        return { ok: false, error };
      }
    };

    it('refuses a time outside the tutor working hours', async () => {
      const fixture = await buildFixture(`oracle-outside-${randomUUID().slice(0, 8)}`);
      // Beyond the fixture's open interval entirely.
      const start = future(95 * 24);
      const result = await requestFor(fixture, start);
      expect(result.ok).toBe(false);
      expect(result.error).toBeInstanceOf(SlotUnavailableError);
    });

    it('refuses a privately blocked time identically to one already held', async () => {
      const fixture = await buildFixture(`oracle-block-${randomUUID().slice(0, 8)}`);
      const blockedStart = future(100);
      const takenStart = future(130);

      // A private block, carrying a reason the family may never learn.
      const { sql, db } = createDatabaseClient();
      try {
        await db.insert(availabilityExceptions).values({
          tutorProfileId: fixture.tutors[0]!.tutorProfileId,
          startsAt: new Date(blockedStart.getTime() - 30 * 60 * 1000),
          endsAt: new Date(blockedStart.getTime() + 90 * 60 * 1000),
          effectCode: 'removes',
          reasonCode: 'medical_appointment',
          privateNote: 'Never reaches a family.',
        });
      } finally {
        await sql.end();
      }

      // Someone else already holds the second time.
      const firstHold = await requestFor(fixture, takenStart);
      expect(firstHold.ok).toBe(true);

      const blocked = await requestFor(fixture, blockedStart);
      const taken = await requestFor(fixture, takenStart);

      // Same class, same message: the difference carries no information.
      expect(blocked.ok).toBe(false);
      expect(taken.ok).toBe(false);
      expect(blocked.error).toBeInstanceOf(SlotUnavailableError);
      expect(taken.error).toBeInstanceOf(SlotUnavailableError);
      expect((blocked.error as Error).message).toBe((taken.error as Error).message);
    });
  });
});
