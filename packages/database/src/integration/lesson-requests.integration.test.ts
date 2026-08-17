import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { createDatabaseClient } from '../client';
import {
  acceptTutorRequestTime,
  createIntendedLessonRequest,
  declineTutorRequest,
  expireOverdueRequests,
  NoTutorAvailableError,
  RequestNotOpenError,
  RequestValidationError,
  TimeNoLongerAvailableError,
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
  requestTimeOptions,
  services,
  serviceVersions,
  statusTransitions,
  studentProfiles,
  studentSubjectSections,
  subjects,
  tutorProfiles,
  tutorRequestTimeOptions,
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

/**
 * A second acceptable time, a day after the first.
 *
 * A request must offer at least two (D-3), so every fixture needs a companion
 * to its primary time. A day apart keeps it inside the fixture's open window
 * and well clear of minimum notice, and far enough from the first that a hold
 * on one cannot overlap the other.
 */
const altStart = (start: Date): Date => new Date(start.getTime() + 24 * 60 * 60 * 1000);

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
      proposedStarts: [start, altStart(start)],
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

      // NOTHING is held at send (D-1). A request is a question, and reserving
      // three tutors' calendars on speculation took real bookable time from
      // people who had not agreed to anything.
      const holds = await db
        .select()
        .from(tutorTimeReservations)
        .where(
          inArray(
            tutorTimeReservations.tutorRequestId,
            requests.map((row) => row.id),
          ),
        );
      expect(holds).toEqual([]);

      // Each tutor is offered the family's times they can actually do.
      const offered = await db
        .select()
        .from(tutorRequestTimeOptions)
        .where(
          inArray(
            tutorRequestTimeOptions.tutorRequestId,
            requests.map((row) => row.id),
          ),
        );
      expect(offered).toHaveLength(6); // three tutors × two offered times
      expect(offered.every((row) => row.statusCode === 'offered')).toBe(true);

      const familyOptions = await db
        .select()
        .from(requestTimeOptions)
        .where(eq(requestTimeOptions.intendedLessonRequestId, created.intendedLessonRequestId));
      expect(familyOptions).toHaveLength(2);
      expect(familyOptions.map((row) => row.position).sort()).toEqual([1, 2]);

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

  it('a second request for the same time is allowed, because sending holds nothing', async () => {
    // Under D-1 a request reserves no calendar time, so two families may ask
    // the same tutor about the same slot. Whoever the tutor accepts takes it;
    // until then nobody has been shut out on speculation.
    const fixture = await buildFixture(`conflict-${randomUUID().slice(0, 8)}`);
    const start = future(120);
    const base = {
      studentSubjectSectionId: fixture.subjectSectionId,
      requestedByUserId: fixture.requesterUserId,
      familyAccountId: null,
      proposedStarts: [start, altStart(start)],
      formatCode: 'online',
      timeZone: 'Pacific/Auckland',
      notesForTutors: null,
      hasPaymentMethodOnFile: false,
      paymentExemptionCode: null,
    };

    const first = await createIntendedLessonRequest({
      ...base,
      tutorProfileIds: [fixture.tutors[0]!.tutorProfileId],
      correlationId: `cor_${randomUUID()}`,
    });
    const second = await createIntendedLessonRequest({
      ...base,
      tutorProfileIds: fixture.tutors.map((tutor) => tutor.tutorProfileId),
      correlationId: `cor_${randomUUID()}`,
    });

    expect(first.tutorRequestReferences).toHaveLength(1);
    expect(second.tutorRequestReferences).toHaveLength(3);

    // And still nothing on anyone's calendar.
    const { sql, db } = createDatabaseClient();
    try {
      const holds = await db
        .select()
        .from(tutorTimeReservations)
        .where(
          inArray(
            tutorTimeReservations.tutorProfileId,
            fixture.tutors.map((tutor) => tutor.tutorProfileId),
          ),
        );
      expect(holds).toEqual([]);
    } finally {
      await sql.end();
    }
  });

  it('a tutor who can do none of the chosen times is simply not asked', async () => {
    const fixture = await buildFixture(`subset-${randomUUID().slice(0, 8)}`);
    const start = future(150);
    const other = altStart(start);

    // Block tutor 2 across the first time only, so their subset shrinks to one.
    const { sql, db } = createDatabaseClient();
    try {
      await db.insert(availabilityExceptions).values({
        tutorProfileId: fixture.tutors[1]!.tutorProfileId,
        startsAt: new Date(start.getTime() - 30 * 60 * 1000),
        endsAt: new Date(start.getTime() + 90 * 60 * 1000),
        effectCode: 'removes',
      });
      // And tutor 3 across both, so they cannot be asked at all.
      await db.insert(availabilityExceptions).values({
        tutorProfileId: fixture.tutors[2]!.tutorProfileId,
        startsAt: new Date(start.getTime() - 60 * 60 * 1000),
        endsAt: new Date(other.getTime() + 120 * 60 * 1000),
        effectCode: 'removes',
      });
    } finally {
      await sql.end();
    }

    const created = await createIntendedLessonRequest({
      studentSubjectSectionId: fixture.subjectSectionId,
      requestedByUserId: fixture.requesterUserId,
      familyAccountId: null,
      tutorProfileIds: fixture.tutors.map((tutor) => tutor.tutorProfileId),
      proposedStarts: [start, other],
      formatCode: 'online',
      timeZone: 'Pacific/Auckland',
      notesForTutors: null,
      hasPaymentMethodOnFile: false,
      paymentExemptionCode: null,
      correlationId: `cor_${randomUUID()}`,
    });

    expect(created.tutorRequestReferences).toHaveLength(2);
    expect(created.notAskedTutorProfileIds).toEqual([fixture.tutors[2]!.tutorProfileId]);
  });

  it('two concurrent requests for the same tutor slot both succeed now that neither holds it', async () => {
    const fixture = await buildFixture(`race-${randomUUID().slice(0, 8)}`);
    const start = future(140);
    const base = {
      studentSubjectSectionId: fixture.subjectSectionId,
      requestedByUserId: fixture.requesterUserId,
      familyAccountId: null,
      tutorProfileIds: [fixture.tutors[0]!.tutorProfileId],
      proposedStarts: [start, altStart(start)],
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

    // Both succeed: asking is not claiming. The race that matters moved to
    // acceptance, where the exclusion constraint still decides it.
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    expect(fulfilled).toHaveLength(2);
  });

  it('rejects a fan-out beyond the cap and duplicate tutors', async () => {
    const fixture = await buildFixture(`cap-${randomUUID().slice(0, 8)}`);
    const start = future(80);
    const base = {
      studentSubjectSectionId: fixture.subjectSectionId,
      requestedByUserId: fixture.requesterUserId,
      familyAccountId: null,
      proposedStarts: [start, altStart(start)],
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
      proposedStarts: [start, altStart(start)],
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
      proposedStarts: [start, altStart(start)],
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
      proposedStarts: [start, altStart(start)],
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
      proposedStarts: [start, altStart(start)],
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

    // The tutor gets what they need to assess the request: their own offered
    // times, and nothing that counts the family's full set.
    expect(only.reference).toMatch(/^TREQ-/);
    expect(only.offeredTimes.length).toBeGreaterThan(0);
    expect(only.offeredTimes[0]?.startAt).toBeInstanceOf(Date);
    // Pinned: an offered time carries the two instants, its status, and the
    // tutor's OWN row id so they can accept it — and in particular never
    // `requestTimeOptionId`, which identifies the family's option and belongs
    // to the other side of the boundary.
    expect(Object.keys(only.offeredTimes[0]!).sort()).toEqual([
      'endAt',
      'startAt',
      'statusCode',
      'tutorRequestTimeOptionId',
    ]);
    expect(only.subjectDisplayName).toBeTruthy();
    // Nothing is held at send any more (D-1): the hold arrives at acceptance.
    expect(only.holdExpiresAt).toBeNull();

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
      proposedStarts: [start, altStart(start)],
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

    // Every terminal state the schema allows must stay equally visible and
    // carry the same shape, so a tutor cannot tell a family withdrawal from an
    // expiry, a decline, or a selection close-out.
    //
    // Iterating only over the status withdrawal already produced would make
    // this a no-op re-assertion of the line above, so each state is forced
    // explicitly — including the ones later slices will start writing.
    const { sql, db } = createDatabaseClient();
    try {
      for (const terminal of [
        'closed',
        'expired',
        'declined',
        'acceptance_withdrawn',
        'selected',
      ] as const) {
        await db
          .update(tutorRequests)
          .set({ statusCode: terminal })
          .where(eq(tutorRequests.intendedLessonRequestId, created.intendedLessonRequestId));
        const view = await listRequestsForTutor(fixture.tutors[0]!.tutorProfileId);
        expect(view, `${terminal} must remain visible to the tutor`).toHaveLength(1);
        expect(
          Object.keys(view[0]!).sort(),
          `${terminal} must expose the same fields as every other ending`,
        ).toEqual(Object.keys(afterWithdrawal[0]!).sort());
      }
    } finally {
      await sql.end();
    }
  });

  it('gives the tutor their own lesson length, not the family-wide one', async () => {
    // The ILR stores the LONGEST duration across invited tutors. Showing that
    // to a 60-minute tutor invited alongside a 90-minute one would hand them a
    // number they know is not theirs — proof another tutor was asked.
    const fixture = await buildFixture(`duration-${randomUUID().slice(0, 8)}`);
    const start = future(105);

    const { sql, db } = createDatabaseClient();
    try {
      await db
        .update(serviceVersions)
        .set({ durationMinutes: 90 })
        .where(eq(serviceVersions.id, fixture.tutors[1]!.serviceVersionId));
    } finally {
      await sql.end();
    }

    await createIntendedLessonRequest({
      studentSubjectSectionId: fixture.subjectSectionId,
      requestedByUserId: fixture.requesterUserId,
      familyAccountId: null,
      tutorProfileIds: [fixture.tutors[0]!.tutorProfileId, fixture.tutors[1]!.tutorProfileId],
      proposedStarts: [start, altStart(start)],
      formatCode: 'online',
      timeZone: 'Pacific/Auckland',
      notesForTutors: null,
      hasPaymentMethodOnFile: false,
      paymentExemptionCode: null,
      correlationId: `cor_${randomUUID()}`,
    });

    const shortTutor = await listRequestsForTutor(fixture.tutors[0]!.tutorProfileId);
    const longTutor = await listRequestsForTutor(fixture.tutors[1]!.tutorProfileId);
    expect(shortTutor[0]!.durationMinutes).toBe(60);
    expect(longTutor[0]!.durationMinutes).toBe(90);
  });

  it('sets each tutor response deadline from their own earliest offered time', async () => {
    // A shared deadline leaks the family's set: the window is clamped to
    // "earliest offered − minimum notice", so a tutor offered only the later
    // time would learn an earlier one exists and could recover it exactly.
    const fixture = await buildFixture(`deadline-${randomUUID().slice(0, 8)}`);
    const soon = future(10);
    const later = future(200);

    // Tutor 2 cannot do the earlier time, so their subset starts later.
    const { sql, db } = createDatabaseClient();
    try {
      await db.insert(availabilityExceptions).values({
        tutorProfileId: fixture.tutors[1]!.tutorProfileId,
        startsAt: new Date(soon.getTime() - 60 * 60 * 1000),
        endsAt: new Date(soon.getTime() + 120 * 60 * 1000),
        effectCode: 'removes',
      });
    } finally {
      await sql.end();
    }

    await createIntendedLessonRequest({
      studentSubjectSectionId: fixture.subjectSectionId,
      requestedByUserId: fixture.requesterUserId,
      familyAccountId: null,
      tutorProfileIds: [fixture.tutors[0]!.tutorProfileId, fixture.tutors[1]!.tutorProfileId],
      proposedStarts: [soon, later],
      formatCode: 'online',
      timeZone: 'Pacific/Auckland',
      notesForTutors: null,
      hasPaymentMethodOnFile: false,
      paymentExemptionCode: null,
      correlationId: `cor_${randomUUID()}`,
    });

    const canDoSoon = await listRequestsForTutor(fixture.tutors[0]!.tutorProfileId);
    const laterOnly = await listRequestsForTutor(fixture.tutors[1]!.tutorProfileId);

    expect(canDoSoon[0]!.offeredTimes).toHaveLength(2);
    expect(laterOnly[0]!.offeredTimes).toHaveLength(1);

    // The tutor who cannot do the early time must not have a deadline derived
    // from it — theirs runs from the time they were actually offered.
    expect(laterOnly[0]!.respondByAt.getTime()).toBeGreaterThan(soon.getTime());
    expect(canDoSoon[0]!.respondByAt.getTime()).toBeLessThan(soon.getTime());
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
      proposedStarts: [start, altStart(start)],
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
        proposedStarts: [start, altStart(start)],
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
      proposedStarts: [start, altStart(start)],
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
      proposedStarts: [start, altStart(start)],
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

  describe('accepting a time', () => {
    /** Send a request to one tutor and return their offered rows. */
    const sendTo = async (
      fixture: Fixture,
      tutorIndex: number,
      starts: readonly Date[],
    ): Promise<{ reference: string; optionIds: string[] }> => {
      const created = await createIntendedLessonRequest({
        studentSubjectSectionId: fixture.subjectSectionId,
        requestedByUserId: fixture.requesterUserId,
        familyAccountId: null,
        tutorProfileIds: [fixture.tutors[tutorIndex]!.tutorProfileId],
        proposedStarts: [...starts],
        formatCode: 'online',
        timeZone: 'Pacific/Auckland',
        notesForTutors: null,
        hasPaymentMethodOnFile: false,
        paymentExemptionCode: null,
        correlationId: `cor_${randomUUID()}`,
      });
      const view = await listRequestsForTutor(fixture.tutors[tutorIndex]!.tutorProfileId);
      const mine = view.find((entry) => entry.reference === created.tutorRequestReferences[0]);
      return {
        reference: created.tutorRequestReferences[0]!,
        optionIds: (mine?.offeredTimes ?? []).map((option) => option.tutorRequestTimeOptionId),
      };
    };

    it('claims the time, holds the calendar and moves the request', async () => {
      const fixture = await buildFixture(`accept-${randomUUID().slice(0, 8)}`);
      const start = future(160);
      const sent = await sendTo(fixture, 0, [start, altStart(start)]);

      const accepted = await acceptTutorRequestTime({
        reference: sent.reference,
        tutorProfileId: fixture.tutors[0]!.tutorProfileId,
        tutorRequestTimeOptionId: sent.optionIds[0]!,
        actorUserId: fixture.tutors[0]!.userId,
        correlationId: `cor_${randomUUID()}`,
      });
      expect(accepted.startAt.getTime()).toBe(start.getTime());

      // The hold exists now — and only now (D-1).
      const { sql, db } = createDatabaseClient();
      try {
        const holds = await db
          .select()
          .from(tutorTimeReservations)
          .where(eq(tutorTimeReservations.tutorProfileId, fixture.tutors[0]!.tutorProfileId));
        expect(holds).toHaveLength(1);
        expect(holds[0]!.statusCode).toBe('active');
        expect(holds[0]!.expiresAt!.getTime()).toBe(accepted.holdExpiresAt.getTime());
        // D-8: never past the point the lesson stops being bookable.
        expect(accepted.holdExpiresAt.getTime()).toBeLessThanOrEqual(
          start.getTime() - 2 * 60 * 60 * 1000,
        );

        const [request] = await db
          .select()
          .from(tutorRequests)
          .where(eq(tutorRequests.reference, sent.reference));
        expect(request!.statusCode).toBe('accepted');
        expect(request!.acceptedTimeOptionId).toBe(sent.optionIds[0]);
        expect(request!.holdRuleVersion).not.toBeNull();
      } finally {
        await sql.end();
      }
    });

    it('refuses a second acceptance on the same request', async () => {
      // D-4: one accepted time per request, and the database enforces it even
      // if the status guard were wrong.
      const fixture = await buildFixture(`accept-twice-${randomUUID().slice(0, 8)}`);
      const start = future(170);
      const sent = await sendTo(fixture, 0, [start, altStart(start)]);
      const base = {
        reference: sent.reference,
        tutorProfileId: fixture.tutors[0]!.tutorProfileId,
        actorUserId: fixture.tutors[0]!.userId,
      };

      await acceptTutorRequestTime({
        ...base,
        tutorRequestTimeOptionId: sent.optionIds[0]!,
        correlationId: `cor_${randomUUID()}`,
      });
      await expect(
        acceptTutorRequestTime({
          ...base,
          tutorRequestTimeOptionId: sent.optionIds[1]!,
          correlationId: `cor_${randomUUID()}`,
        }),
      ).rejects.toBeInstanceOf(RequestNotOpenError);
    });

    it('lets exactly one of two tutors claim the same instant', async () => {
      // Two families, two tutors, one time. Both were free to be asked; the
      // exclusion constraint decides the calendar, and the loser is told the
      // time is gone with no hint of who took it.
      const fixture = await buildFixture(`accept-race-${randomUUID().slice(0, 8)}`);
      const start = future(180);
      const first = await sendTo(fixture, 0, [start, altStart(start)]);
      const second = await sendTo(fixture, 0, [start, altStart(start)]);

      const results = await Promise.allSettled([
        acceptTutorRequestTime({
          reference: first.reference,
          tutorProfileId: fixture.tutors[0]!.tutorProfileId,
          tutorRequestTimeOptionId: first.optionIds[0]!,
          actorUserId: fixture.tutors[0]!.userId,
          correlationId: `cor_${randomUUID()}`,
        }),
        acceptTutorRequestTime({
          reference: second.reference,
          tutorProfileId: fixture.tutors[0]!.tutorProfileId,
          tutorRequestTimeOptionId: second.optionIds[0]!,
          actorUserId: fixture.tutors[0]!.userId,
          correlationId: `cor_${randomUUID()}`,
        }),
      ]);

      expect(results.filter((entry) => entry.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find((entry) => entry.status === 'rejected');
      expect((rejected as PromiseRejectedResult).reason).toBeInstanceOf(TimeNoLongerAvailableError);
    });

    it('refuses a reference belonging to another tutor, exactly as a missing one', async () => {
      const fixture = await buildFixture(`accept-scope-${randomUUID().slice(0, 8)}`);
      const start = future(190);
      const sent = await sendTo(fixture, 0, [start, altStart(start)]);

      const notOurs = acceptTutorRequestTime({
        reference: sent.reference,
        tutorProfileId: fixture.tutors[1]!.tutorProfileId,
        tutorRequestTimeOptionId: sent.optionIds[0]!,
        actorUserId: fixture.tutors[1]!.userId,
        correlationId: `cor_${randomUUID()}`,
      });
      const missing = acceptTutorRequestTime({
        reference: 'TREQ-ZZZZZZZZZZ',
        tutorProfileId: fixture.tutors[1]!.tutorProfileId,
        tutorRequestTimeOptionId: sent.optionIds[0]!,
        actorUserId: fixture.tutors[1]!.userId,
        correlationId: `cor_${randomUUID()}`,
      });

      // Same class, same message: a tutor cannot probe references to discover
      // which ones exist.
      await expect(notOurs).rejects.toBeInstanceOf(RequestNotOpenError);
      await expect(missing).rejects.toBeInstanceOf(RequestNotOpenError);
    });

    it('declines without taking any calendar time', async () => {
      const fixture = await buildFixture(`decline-${randomUUID().slice(0, 8)}`);
      const start = future(200);
      const sent = await sendTo(fixture, 0, [start, altStart(start)]);

      await declineTutorRequest({
        reference: sent.reference,
        tutorProfileId: fixture.tutors[0]!.tutorProfileId,
        actorUserId: fixture.tutors[0]!.userId,
        declineReasonCode: 'too_far_away',
        correlationId: `cor_${randomUUID()}`,
      });

      const { sql, db } = createDatabaseClient();
      try {
        const [request] = await db
          .select()
          .from(tutorRequests)
          .where(eq(tutorRequests.reference, sent.reference));
        expect(request!.statusCode).toBe('declined');

        const holds = await db
          .select()
          .from(tutorTimeReservations)
          .where(eq(tutorTimeReservations.tutorProfileId, fixture.tutors[0]!.tutorProfileId));
        expect(holds).toEqual([]);
      } finally {
        await sql.end();
      }
    });
  });

  /**
   * The request path must not become an availability oracle.
   *
   * Under the multi-time model the protection is structural rather than a
   * matter of matching error messages: a time a tutor cannot do never enters
   * their offered subset, and the subset says only which times they were asked
   * about. Whether a time is missing because the tutor blocked it privately,
   * because an accepted hold already covers it, or because they simply do not
   * work then, the observable result is identical — the time is absent.
   */
  describe('does not leak why a time is unavailable', () => {
    const offeredTimesFor = async (
      fixture: Fixture,
      starts: readonly Date[],
    ): Promise<{ created: boolean; offered: number[]; error: unknown }> => {
      try {
        const created = await createIntendedLessonRequest({
          studentSubjectSectionId: fixture.subjectSectionId,
          requestedByUserId: fixture.requesterUserId,
          familyAccountId: null,
          tutorProfileIds: [fixture.tutors[0]!.tutorProfileId],
          proposedStarts: [...starts],
          formatCode: 'online',
          timeZone: 'Pacific/Auckland',
          notesForTutors: null,
          hasPaymentMethodOnFile: false,
          paymentExemptionCode: null,
          correlationId: `cor_${randomUUID()}`,
        });
        const view = await listRequestsForTutor(fixture.tutors[0]!.tutorProfileId);
        const mine = view.find((entry) => created.tutorRequestReferences.includes(entry.reference));
        return {
          created: true,
          offered: (mine?.offeredTimes ?? []).map((option) => option.startAt.getTime()),
          error: null,
        };
      } catch (error) {
        return { created: false, offered: [], error };
      }
    };

    it('sends nothing when the tutor works none of the chosen times', async () => {
      const fixture = await buildFixture(`oracle-outside-${randomUUID().slice(0, 8)}`);
      // Beyond the fixture's open interval entirely.
      const start = future(95 * 24);
      const result = await offeredTimesFor(fixture, [start, altStart(start)]);
      expect(result.created).toBe(false);
      expect(result.error).toBeInstanceOf(NoTutorAvailableError);
    });

    it('drops a privately blocked time exactly as it drops a reserved one', async () => {
      const fixture = await buildFixture(`oracle-block-${randomUUID().slice(0, 8)}`);
      const free = future(100);
      const blockedStart = future(124);
      const reservedStart = future(148);

      const { sql, db } = createDatabaseClient();
      try {
        // A private block, carrying a reason the family may never learn.
        await db.insert(availabilityExceptions).values({
          tutorProfileId: fixture.tutors[0]!.tutorProfileId,
          startsAt: new Date(blockedStart.getTime() - 30 * 60 * 1000),
          endsAt: new Date(blockedStart.getTime() + 90 * 60 * 1000),
          effectCode: 'removes',
          reasonCode: 'medical_appointment',
          privateNote: 'Never reaches a family.',
        });
        // And an accepted hold from someone else, covering a different time.
        await db.insert(tutorTimeReservations).values({
          tutorProfileId: fixture.tutors[0]!.tutorProfileId,
          startAt: reservedStart,
          endAt: new Date(reservedStart.getTime() + 60 * 60 * 1000),
          statusCode: 'active',
          reservationTypeCode: 'request_hold',
          expiresAt: new Date(reservedStart.getTime() - 2 * 60 * 60 * 1000),
        });
      } finally {
        await sql.end();
      }

      const result = await offeredTimesFor(fixture, [free, blockedStart, reservedStart]);

      // The free time is offered; the other two are absent, and nothing in the
      // result distinguishes the block from the reservation.
      expect(result.created).toBe(true);
      expect(result.offered).toEqual([free.getTime()]);
    });
  });
});
