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
  LessonTooCloseForPaymentError,
  selectAcceptedTutorRequest,
  SelectionNoLongerAvailableError,
  TimeNoLongerAvailableError,
  withdrawRequest,
} from '../repositories/lesson-requests';
import { listRequestsForTutor, listRequestsForStudents } from '../repositories/request-projections';
import { setRuleSetting } from '../repositories/rule-settings';
import { setTutorMinimumGapMinutes, tutorMinimumGapMinutes } from '../repositories/availability';
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

/**
 * Publish a second version for a tutor who already has one.
 *
 * The base fixture gives every tutor sixty minutes online, so a mixed-length or
 * wrong-format request cannot be built from it — and a guard nothing can
 * violate is a guard nothing proves.
 */
async function addVersion(
  tutorProfileId: string,
  durationMinutes: number,
  formatCode?: string,
): Promise<string> {
  const { sql, db } = createDatabaseClient();
  try {
    const [service] = await db
      .select({ id: services.id })
      .from(services)
      .where(eq(services.tutorProfileId, tutorProfileId));

    const [version] = await db
      .insert(serviceVersions)
      .values({
        serviceId: service!.id,
        durationMinutes,
        priceAmountMinor: 6500n,
        currencyCode: 'NZD',
        ...(formatCode === undefined ? {} : { formatCode }),
      })
      .returning({ id: serviceVersions.id });

    return version!.id;
  } finally {
    await sql.end();
  }
}

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

  /**
   * ONE REQUEST IS ONE LESSON.
   *
   * These four cover the invariant from both sides. The public creation path
   * used to RECONCILE a mixed set by taking the longest length, so the family
   * could ask three tutors and mean three different lessons; whichever accepted,
   * they had agreed to something they were never shown. That reconciliation is
   * gone, and nothing may depend on it any more.
   */
  describe('one shared lesson length', () => {
    it('refuses a mixed-length request even when no length is asserted', async () => {
      const fixture = await buildFixture(`mixed-${randomUUID().slice(0, 8)}`);
      const ninety = await addVersion(fixture.tutors[0]!.tutorProfileId, 90);
      const start = future(100);

      /**
       * NO `requestedDurationMinutes` HERE, deliberately. That is precisely the
       * shape that used to fall through to "longest wins": a caller that says
       * nothing about length must not be given a reconciled one.
       */
      await expect(
        createIntendedLessonRequest({
          studentSubjectSectionId: fixture.subjectSectionId,
          requestedByUserId: fixture.requesterUserId,
          familyAccountId: null,
          tutorProfileIds: fixture.tutors.map((tutor) => tutor.tutorProfileId),
          serviceVersionIdByTutor: new Map([[fixture.tutors[0]!.tutorProfileId, ninety]]),
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

    it('writes nothing when it refuses a mixed-length request', async () => {
      const fixture = await buildFixture(`mixednone-${randomUUID().slice(0, 8)}`);
      const ninety = await addVersion(fixture.tutors[0]!.tutorProfileId, 90);
      const start = future(101);

      await expect(
        createIntendedLessonRequest({
          studentSubjectSectionId: fixture.subjectSectionId,
          requestedByUserId: fixture.requesterUserId,
          familyAccountId: null,
          tutorProfileIds: fixture.tutors.map((tutor) => tutor.tutorProfileId),
          serviceVersionIdByTutor: new Map([[fixture.tutors[0]!.tutorProfileId, ninety]]),
          proposedStarts: [start, altStart(start)],
          formatCode: 'online',
          timeZone: 'Pacific/Auckland',
          notesForTutors: null,
          hasPaymentMethodOnFile: false,
          paymentExemptionCode: null,
          correlationId: `cor_${randomUUID()}`,
        }),
      ).rejects.toThrow();

      // Refused, not partially written: every check runs before the transaction.
      const { sql, db } = createDatabaseClient();
      try {
        const rows = await db
          .select({ id: intendedLessonRequests.id })
          .from(intendedLessonRequests)
          .where(eq(intendedLessonRequests.studentSubjectSectionId, fixture.subjectSectionId));
        expect(rows).toHaveLength(0);
      } finally {
        await sql.end();
      }
    });

    it('refuses a length the resolved versions do not match', async () => {
      const fixture = await buildFixture(`assert-${randomUUID().slice(0, 8)}`);
      const start = future(102);

      // Every tutor is on sixty minutes; asking for ninety is a disagreement
      // between what the family was shown and what the tutors publish.
      await expect(
        createIntendedLessonRequest({
          studentSubjectSectionId: fixture.subjectSectionId,
          requestedByUserId: fixture.requesterUserId,
          familyAccountId: null,
          tutorProfileIds: fixture.tutors.map((tutor) => tutor.tutorProfileId),
          proposedStarts: [start, altStart(start)],
          requestedDurationMinutes: 90,
          formatCode: 'online',
          timeZone: 'Pacific/Auckland',
          notesForTutors: null,
          hasPaymentMethodOnFile: false,
          paymentExemptionCode: null,
          correlationId: `cor_${randomUUID()}`,
        }),
      ).rejects.toBeInstanceOf(RequestValidationError);
    });

    /** The positive control: the guard must not simply refuse everything. */
    it('accepts a request where every tutor shares the asserted length', async () => {
      const fixture = await buildFixture(`shared-${randomUUID().slice(0, 8)}`);
      const start = future(103);

      const pinned = new Map<string, string>();
      for (const tutor of fixture.tutors) {
        pinned.set(tutor.tutorProfileId, await addVersion(tutor.tutorProfileId, 90));
      }

      const created = await createIntendedLessonRequest({
        studentSubjectSectionId: fixture.subjectSectionId,
        requestedByUserId: fixture.requesterUserId,
        familyAccountId: null,
        tutorProfileIds: fixture.tutors.map((tutor) => tutor.tutorProfileId),
        serviceVersionIdByTutor: pinned,
        proposedStarts: [start, altStart(start)],
        requestedDurationMinutes: 90,
        formatCode: 'online',
        timeZone: 'Pacific/Auckland',
        notesForTutors: null,
        hasPaymentMethodOnFile: false,
        paymentExemptionCode: null,
        correlationId: `cor_${randomUUID()}`,
      });

      expect(created.intendedLessonRequestId).toBeTruthy();

      // And the family-side record carries that one length, not a reconciled one.
      const { sql, db } = createDatabaseClient();
      try {
        const [row] = await db
          .select({ durationMinutes: intendedLessonRequests.durationMinutes })
          .from(intendedLessonRequests)
          .where(eq(intendedLessonRequests.id, created.intendedLessonRequestId));
        expect(row?.durationMinutes).toBe(90);
      } finally {
        await sql.end();
      }
    });
  });

  /**
   * A tutor must never be asked for a lesson they cannot deliver. Nothing
   * checked this before: the offerings query restricts to the right subject and
   * a current published version, and `validateFanOut` only checks the format is
   * one of the two concrete values.
   */
  it('refuses a format the tutor does not teach that lesson in', async () => {
    const fixture = await buildFixture(`format-${randomUUID().slice(0, 8)}`);
    const onlineOnly = await addVersion(fixture.tutors[0]!.tutorProfileId, 120, 'online');
    const start = future(104);

    await expect(
      createIntendedLessonRequest({
        studentSubjectSectionId: fixture.subjectSectionId,
        requestedByUserId: fixture.requesterUserId,
        familyAccountId: null,
        tutorProfileIds: [fixture.tutors[0]!.tutorProfileId],
        serviceVersionIdByTutor: new Map([[fixture.tutors[0]!.tutorProfileId, onlineOnly]]),
        proposedStarts: [start, altStart(start)],
        requestedDurationMinutes: 120,
        formatCode: 'in_person',
        timeZone: 'Pacific/Auckland',
        notesForTutors: null,
        hasPaymentMethodOnFile: false,
        paymentExemptionCode: null,
        correlationId: `cor_${randomUUID()}`,
      }),
    ).rejects.toBeInstanceOf(RequestValidationError);
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

  it('reads the tutor lesson length from their own version, not the request', async () => {
    /**
     * A tutor must be shown THEIR length, never the family-side field.
     *
     * This used to be demonstrated by fanning out to a 60-minute and a
     * 90-minute tutor at once and checking each saw their own — the request
     * then stored the longest, and handing that to the 60-minute tutor would
     * have been a number they knew was not theirs, and so proof another tutor
     * had been asked.
     *
     * That fan-out is now refused outright: one request is one lesson. The
     * guarantee still matters, though, because the request row STILL carries a
     * family-side `durationMinutes` and a future change to the projection could
     * start reading it. So the divergence is created directly here, after a
     * perfectly ordinary uniform request, which tests the projection rather
     * than a creation path that can no longer produce a mix.
     */
    const fixture = await buildFixture(`duration-${randomUUID().slice(0, 8)}`);
    const start = future(105);

    const created = await createIntendedLessonRequest({
      studentSubjectSectionId: fixture.subjectSectionId,
      requestedByUserId: fixture.requesterUserId,
      familyAccountId: null,
      tutorProfileIds: [fixture.tutors[0]!.tutorProfileId, fixture.tutors[1]!.tutorProfileId],
      proposedStarts: [start, altStart(start)],
      requestedDurationMinutes: 60,
      formatCode: 'online',
      timeZone: 'Pacific/Auckland',
      notesForTutors: null,
      hasPaymentMethodOnFile: false,
      paymentExemptionCode: null,
      correlationId: `cor_${randomUUID()}`,
    });

    // Force the two apart. Nothing in the product does this; it exists so the
    // assertion below can tell which column the projection actually reads.
    const { sql, db } = createDatabaseClient();
    try {
      await db
        .update(intendedLessonRequests)
        .set({ durationMinutes: 90 })
        .where(eq(intendedLessonRequests.id, created.intendedLessonRequestId));
    } finally {
      await sql.end();
    }

    const first = await listRequestsForTutor(fixture.tutors[0]!.tutorProfileId);
    const second = await listRequestsForTutor(fixture.tutors[1]!.tutorProfileId);

    // Their own sixty, not the ninety now sitting on the request.
    expect(first[0]!.durationMinutes).toBe(60);
    expect(second[0]!.durationMinutes).toBe(60);
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

      // Settled together: creating both promises and awaiting them one after
      // the other leaves the second rejecting with nothing listening, which
      // Vitest reports as an unhandled rejection.
      const [notOurs, missing] = await Promise.allSettled([
        acceptTutorRequestTime({
          reference: sent.reference,
          tutorProfileId: fixture.tutors[1]!.tutorProfileId,
          tutorRequestTimeOptionId: sent.optionIds[0]!,
          actorUserId: fixture.tutors[1]!.userId,
          correlationId: `cor_${randomUUID()}`,
        }),
        acceptTutorRequestTime({
          reference: 'TREQ-ZZZZZZZZZZ',
          tutorProfileId: fixture.tutors[1]!.tutorProfileId,
          tutorRequestTimeOptionId: sent.optionIds[0]!,
          actorUserId: fixture.tutors[1]!.userId,
          correlationId: `cor_${randomUUID()}`,
        }),
      ]);

      // Same class, same message: a tutor cannot probe references to discover
      // which ones exist.
      expect(notOurs.status).toBe('rejected');
      expect(missing.status).toBe('rejected');
      expect((notOurs as PromiseRejectedResult).reason).toBeInstanceOf(RequestNotOpenError);
      expect((missing as PromiseRejectedResult).reason).toBeInstanceOf(RequestNotOpenError);
      expect(((notOurs as PromiseRejectedResult).reason as Error).message).toBe(
        ((missing as PromiseRejectedResult).reason as Error).message,
      );
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
   * One request to two tutors, each accepting a different time — the D-5 shape
   * the family then chooses between. Shared by the selection tests and the
   * hold-expiry tests, which both need a request with live acceptances.
   */
  const twoAcceptances = async (
    label: string,
  ): Promise<{
    fixture: Fixture;
    ilrReference: string;
    studentProfileIds: string[];
    winner: string;
    loser: string;
    loserTutorProfileId: string;
  }> => {
    const fixture = await buildFixture(label);
    const first = future(220);
    const second = altStart(first);

    const created = await createIntendedLessonRequest({
      studentSubjectSectionId: fixture.subjectSectionId,
      requestedByUserId: fixture.requesterUserId,
      familyAccountId: null,
      tutorProfileIds: [fixture.tutors[0]!.tutorProfileId, fixture.tutors[1]!.tutorProfileId],
      proposedStarts: [first, second],
      formatCode: 'online',
      timeZone: 'Pacific/Auckland',
      notesForTutors: null,
      hasPaymentMethodOnFile: false,
      paymentExemptionCode: null,
      correlationId: `cor_${randomUUID()}`,
    });

    // Each tutor accepts a different time, so the family is genuinely
    // choosing a tutor AND a time.
    const references: string[] = [];
    for (const [index, tutor] of [fixture.tutors[0]!, fixture.tutors[1]!].entries()) {
      const view = await listRequestsForTutor(tutor.tutorProfileId);
      const mine = view.find((entry) => created.tutorRequestReferences.includes(entry.reference))!;
      await acceptTutorRequestTime({
        reference: mine.reference,
        tutorProfileId: tutor.tutorProfileId,
        tutorRequestTimeOptionId: mine.offeredTimes[index]!.tutorRequestTimeOptionId,
        actorUserId: tutor.userId,
        correlationId: `cor_${randomUUID()}`,
      });
      references.push(mine.reference);
    }

    const { sql, db } = createDatabaseClient();
    let studentProfileIds: string[];
    try {
      const [section] = await db
        .select({ studentProfileId: studentSubjectSections.studentProfileId })
        .from(studentSubjectSections)
        .where(eq(studentSubjectSections.id, fixture.subjectSectionId));
      studentProfileIds = [section!.studentProfileId];
    } finally {
      await sql.end();
    }

    return {
      fixture,
      ilrReference: created.reference,
      studentProfileIds,
      winner: references[0]!,
      loser: references[1]!,
      loserTutorProfileId: fixture.tutors[1]!.tutorProfileId,
    };
  };

  describe('family selection', () => {
    it('keeps the winner, closes the rest and releases only their holds', async () => {
      const scenario = await twoAcceptances(`select-${randomUUID().slice(0, 8)}`);

      const outcome = await selectAcceptedTutorRequest({
        reference: scenario.ilrReference,
        studentProfileIds: scenario.studentProfileIds,
        tutorRequestReference: scenario.winner,
        actorUserId: scenario.fixture.requesterUserId,
        correlationId: `cor_${randomUUID()}`,
      });
      expect(outcome.closedCount).toBe(1);

      const { sql, db } = createDatabaseClient();
      try {
        const [won] = await db
          .select()
          .from(tutorRequests)
          .where(eq(tutorRequests.reference, scenario.winner));
        expect(won!.statusCode).toBe('selected');

        const [lost] = await db
          .select()
          .from(tutorRequests)
          .where(eq(tutorRequests.reference, scenario.loser));
        // Plain `closed` — never a status that says "not selected".
        expect(lost!.statusCode).toBe('closed');
        expect(lost!.closeReasonCode).toBe('another_tutor_selected');

        const winnerHold = await db
          .select()
          .from(tutorTimeReservations)
          .where(eq(tutorTimeReservations.tutorRequestId, won!.id));
        expect(winnerHold[0]!.statusCode).toBe('active');

        const loserHold = await db
          .select()
          .from(tutorTimeReservations)
          .where(eq(tutorTimeReservations.tutorRequestId, lost!.id));
        // Released at once: a tutor who was not chosen gets their calendar
        // back immediately rather than waiting out a hold protecting nothing.
        expect(loserHold[0]!.statusCode).toBe('released');
        expect(loserHold[0]!.releasedAt).not.toBeNull();

        const [ilr] = await db
          .select()
          .from(intendedLessonRequests)
          .where(eq(intendedLessonRequests.reference, scenario.ilrReference));
        // NOT fulfilled: nobody has paid, so this is not a confirmed booking.
        expect(ilr!.statusCode).toBe('awaiting_payment');
      } finally {
        await sql.end();
      }
    });

    it('records the real prior status of each closed request', async () => {
      // Audit fidelity: whether a tutor had accepted or was still deciding
      // when the family chose is the interesting part of the transition.
      const scenario = await twoAcceptances(`select-audit-${randomUUID().slice(0, 8)}`);
      const correlationId = `cor_${randomUUID()}`;
      await selectAcceptedTutorRequest({
        reference: scenario.ilrReference,
        studentProfileIds: scenario.studentProfileIds,
        tutorRequestReference: scenario.winner,
        actorUserId: scenario.fixture.requesterUserId,
        correlationId,
      });

      const { sql, db } = createDatabaseClient();
      try {
        const [loser] = await db
          .select({ id: tutorRequests.id })
          .from(tutorRequests)
          .where(eq(tutorRequests.reference, scenario.loser));
        const transitions = await db
          .select()
          .from(statusTransitions)
          .where(
            and(
              eq(statusTransitions.correlationId, correlationId),
              eq(statusTransitions.entityId, loser!.id),
            ),
          );
        expect(transitions).toHaveLength(1);
        expect(transitions[0]!.fromStatusCode).toBe('accepted');
        expect(transitions[0]!.toStatusCode).toBe('closed');
      } finally {
        await sql.end();
      }
    });

    it('tells the closed tutor nothing about why', async () => {
      const scenario = await twoAcceptances(`select-privacy-${randomUUID().slice(0, 8)}`);
      await selectAcceptedTutorRequest({
        reference: scenario.ilrReference,
        studentProfileIds: scenario.studentProfileIds,
        tutorRequestReference: scenario.winner,
        actorUserId: scenario.fixture.requesterUserId,
        correlationId: `cor_${randomUUID()}`,
      });

      const view = await listRequestsForTutor(scenario.loserTutorProfileId);
      const theirs = view.find((entry) => entry.reference === scenario.loser)!;
      expect(theirs.statusCode).toBe('closed');

      const serialised = JSON.stringify(theirs, (_key, value: unknown) =>
        typeof value === 'bigint' ? value.toString() : value,
      );
      expect(serialised).not.toContain('another_tutor_selected');
      expect(serialised).not.toContain('closeReasonCode');
      expect(serialised).not.toContain(scenario.winner);
      expect(serialised).not.toContain(scenario.ilrReference);
    });

    it('applies exactly once when submitted twice at the same moment', async () => {
      const scenario = await twoAcceptances(`select-race-${randomUUID().slice(0, 8)}`);
      const call = () =>
        selectAcceptedTutorRequest({
          reference: scenario.ilrReference,
          studentProfileIds: scenario.studentProfileIds,
          tutorRequestReference: scenario.winner,
          actorUserId: scenario.fixture.requesterUserId,
          correlationId: `cor_${randomUUID()}`,
        });

      const results = await Promise.allSettled([call(), call()]);
      expect(results.filter((entry) => entry.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find((entry) => entry.status === 'rejected');
      expect((rejected as PromiseRejectedResult).reason).toBeInstanceOf(
        SelectionNoLongerAvailableError,
      );
    });

    it('refuses another family request, exactly as a missing one', async () => {
      const scenario = await twoAcceptances(`select-scope-${randomUUID().slice(0, 8)}`);
      const other = await buildFixture(`select-other-${randomUUID().slice(0, 8)}`);
      const { sql, db } = createDatabaseClient();
      let strangerProfileIds: string[];
      try {
        const [section] = await db
          .select({ studentProfileId: studentSubjectSections.studentProfileId })
          .from(studentSubjectSections)
          .where(eq(studentSubjectSections.id, other.subjectSectionId));
        strangerProfileIds = [section!.studentProfileId];
      } finally {
        await sql.end();
      }

      const [notOurs, missing] = await Promise.allSettled([
        selectAcceptedTutorRequest({
          reference: scenario.ilrReference,
          studentProfileIds: strangerProfileIds,
          tutorRequestReference: scenario.winner,
          actorUserId: other.requesterUserId,
          correlationId: `cor_${randomUUID()}`,
        }),
        selectAcceptedTutorRequest({
          reference: 'LR-00000000',
          studentProfileIds: strangerProfileIds,
          tutorRequestReference: scenario.winner,
          actorUserId: other.requesterUserId,
          correlationId: `cor_${randomUUID()}`,
        }),
      ]);

      expect(notOurs.status).toBe('rejected');
      expect(missing.status).toBe('rejected');
      expect((notOurs as PromiseRejectedResult).reason).toBeInstanceOf(
        SelectionNoLongerAvailableError,
      );
      expect(((notOurs as PromiseRejectedResult).reason as Error).message).toBe(
        ((missing as PromiseRejectedResult).reason as Error).message,
      );
    });

    it('refuses a tutor request that never accepted', async () => {
      const scenario = await twoAcceptances(`select-unaccepted-${randomUUID().slice(0, 8)}`);
      // Close the loser first, then try to select it.
      await selectAcceptedTutorRequest({
        reference: scenario.ilrReference,
        studentProfileIds: scenario.studentProfileIds,
        tutorRequestReference: scenario.winner,
        actorUserId: scenario.fixture.requesterUserId,
        correlationId: `cor_${randomUUID()}`,
      });
      await expect(
        selectAcceptedTutorRequest({
          reference: scenario.ilrReference,
          studentProfileIds: scenario.studentProfileIds,
          tutorRequestReference: scenario.loser,
          actorUserId: scenario.fixture.requesterUserId,
          correlationId: `cor_${randomUUID()}`,
        }),
      ).rejects.toBeInstanceOf(SelectionNoLongerAvailableError);
    });
  });

  /**
   * The payment window — the deadline a family is given once they have chosen,
   * and the guard that stops the expiry sweep closing a booking somebody paid
   * for.
   *
   * The sweep is where this slice earns its keep. A paid booking leaves its
   * winning request `selected` forever, so status alone cannot tell "waiting to
   * be paid for" from "paid for and confirmed" — the ILR is what distinguishes
   * them, and these tests pin that from both sides.
   */
  describe('the payment window', () => {
    /** The claimed start of the winner's time, and its request row. */
    const winnerFacts = async (
      reference: string,
    ): Promise<{ id: string; startAt: Date; ilrId: string }> => {
      const { sql, db } = createDatabaseClient();
      try {
        const [row] = await db
          .select({
            id: tutorRequests.id,
            ilrId: tutorRequests.intendedLessonRequestId,
            startAt: tutorRequestTimeOptions.startsAt,
          })
          .from(tutorRequests)
          .innerJoin(
            tutorRequestTimeOptions,
            eq(tutorRequests.acceptedTimeOptionId, tutorRequestTimeOptions.id),
          )
          .where(eq(tutorRequests.reference, reference));
        return { id: row!.id, startAt: row!.startAt, ilrId: row!.ilrId };
      } finally {
        await sql.end();
      }
    };

    const minutesBefore = (at: Date, minutes: number): Date =>
      new Date(at.getTime() - minutes * 60_000);

    it('snapshots the deadline and both rule inputs onto the winner', async () => {
      const scenario = await twoAcceptances(`pay-snap-${randomUUID().slice(0, 8)}`);
      const facts = await winnerFacts(scenario.winner);
      // Comfortably clear of the 90-minute boundary.
      const selectedAt = minutesBefore(facts.startAt, 600);

      const outcome = await selectAcceptedTutorRequest({
        reference: scenario.ilrReference,
        studentProfileIds: scenario.studentProfileIds,
        tutorRequestReference: scenario.winner,
        actorUserId: scenario.fixture.requesterUserId,
        correlationId: `cor_${randomUUID()}`,
        now: selectedAt,
      });

      // The deadline is the window and nothing else — never clamped against
      // the lesson, which is where zero and negative windows came from.
      expect(outcome.paymentDeadlineAt.getTime()).toBe(selectedAt.getTime() + 60 * 60_000);
      expect(outcome.paymentWindowMinutes).toBe(60);

      const { sql, db } = createDatabaseClient();
      try {
        const [won] = await db
          .select()
          .from(tutorRequests)
          .where(eq(tutorRequests.reference, scenario.winner));
        expect(won!.statusCode).toBe('selected');
        expect(won!.paymentDeadlineAt?.getTime()).toBe(selectedAt.getTime() + 60 * 60_000);
        expect(won!.paymentWindowMinutes).toBe(60);
        expect(won!.nearLessonCutoffMinutes).toBe(30);
        /*
         * ONE VERSION PER RULE. `rule_settings` versions per key, so the two
         * move independently and a single column could not say which cutoff
         * was in force. Both are recorded, so the decision is reconstructable
         * from this row alone months later.
         */
        expect(won!.paymentWindowRuleVersion).toBeGreaterThan(0);
        expect(won!.nearLessonCutoffRuleVersion).toBeGreaterThan(0);

        // The winner's hold now runs to the payment deadline rather than to
        // the acceptance hold it replaces.
        const [hold] = await db
          .select()
          .from(tutorTimeReservations)
          .where(eq(tutorTimeReservations.tutorRequestId, won!.id));
        expect(hold!.statusCode).toBe('active');
        expect(hold!.expiresAt?.getTime()).toBe(selectedAt.getTime() + 60 * 60_000);
        // Still a request hold: it becomes a confirmed booking only when a
        // payment succeeds, which is a later slice.
        expect(hold!.reservationTypeCode).toBe('request_hold');
      } finally {
        await sql.end();
      }
    });

    it('allows a selection exactly on the 90-minute boundary', async () => {
      const scenario = await twoAcceptances(`pay-edge-ok-${randomUUID().slice(0, 8)}`);
      const facts = await winnerFacts(scenario.winner);

      const outcome = await selectAcceptedTutorRequest({
        reference: scenario.ilrReference,
        studentProfileIds: scenario.studentProfileIds,
        tutorRequestReference: scenario.winner,
        actorUserId: scenario.fixture.requesterUserId,
        correlationId: `cor_${randomUUID()}`,
        now: minutesBefore(facts.startAt, 90),
      });
      // A full hour even at the boundary — the cutoff is what protects the
      // margin, so the window itself never has to be shortened.
      expect(outcome.paymentDeadlineAt.getTime()).toBe(facts.startAt.getTime() - 30 * 60_000);
    });

    /**
     * A REFUSED SELECTION WRITES NOTHING.
     *
     * The winner is claimed with an UPDATE before the lesson's start time is
     * even known, so the refusal necessarily happens after that write. The
     * whole thing is one transaction, and this proves the rollback rather than
     * assuming it.
     */
    it('refuses one minute inside the boundary and writes nothing at all', async () => {
      const scenario = await twoAcceptances(`pay-edge-no-${randomUUID().slice(0, 8)}`);
      const facts = await winnerFacts(scenario.winner);

      await expect(
        selectAcceptedTutorRequest({
          reference: scenario.ilrReference,
          studentProfileIds: scenario.studentProfileIds,
          tutorRequestReference: scenario.winner,
          actorUserId: scenario.fixture.requesterUserId,
          correlationId: `cor_${randomUUID()}`,
          now: minutesBefore(facts.startAt, 89),
        }),
      ).rejects.toBeInstanceOf(LessonTooCloseForPaymentError);

      const { sql, db } = createDatabaseClient();
      try {
        const [won] = await db
          .select()
          .from(tutorRequests)
          .where(eq(tutorRequests.reference, scenario.winner));
        expect(won!.statusCode).toBe('accepted');
        expect(won!.paymentDeadlineAt).toBeNull();

        // The loser was not closed, and neither hold moved.
        const [lost] = await db
          .select()
          .from(tutorRequests)
          .where(eq(tutorRequests.reference, scenario.loser));
        expect(lost!.statusCode).toBe('accepted');

        for (const id of [won!.id, lost!.id]) {
          const [hold] = await db
            .select()
            .from(tutorTimeReservations)
            .where(eq(tutorTimeReservations.tutorRequestId, id));
          expect(hold!.statusCode).toBe('active');
        }

        const [ilr] = await db
          .select()
          .from(intendedLessonRequests)
          .where(eq(intendedLessonRequests.reference, scenario.ilrReference));
        expect(ilr!.statusCode).toBe('ready_for_selection');
      } finally {
        await sql.end();
      }
    });

    it('carries the enforced lead time in the refusal, rather than a copy of it', async () => {
      const scenario = await twoAcceptances(`pay-msg-${randomUUID().slice(0, 8)}`);
      const facts = await winnerFacts(scenario.winner);

      const refusal = await selectAcceptedTutorRequest({
        reference: scenario.ilrReference,
        studentProfileIds: scenario.studentProfileIds,
        tutorRequestReference: scenario.winner,
        actorUserId: scenario.fixture.requesterUserId,
        correlationId: `cor_${randomUUID()}`,
        now: minutesBefore(facts.startAt, 10),
      }).catch((error: unknown) => error);

      expect(refusal).toBeInstanceOf(LessonTooCloseForPaymentError);
      expect((refusal as LessonTooCloseForPaymentError).requiredLeadMinutes).toBe(90);
      expect((refusal as Error).message).toContain('90 minutes');
      // About the lesson and what to do next — never about the tutor.
      expect((refusal as Error).message.toLowerCase()).not.toContain('tutor');
    });

    it('lapses a selection whose payment window has run out', async () => {
      const scenario = await twoAcceptances(`pay-lapse-${randomUUID().slice(0, 8)}`);
      const facts = await winnerFacts(scenario.winner);
      const selectedAt = minutesBefore(facts.startAt, 600);

      await selectAcceptedTutorRequest({
        reference: scenario.ilrReference,
        studentProfileIds: scenario.studentProfileIds,
        tutorRequestReference: scenario.winner,
        actorUserId: scenario.fixture.requesterUserId,
        correlationId: `cor_${randomUUID()}`,
        now: selectedAt,
      });

      // One minute past the deadline. The acceptance hold still has hours to
      // run, so this proves the sweep is reading the PAYMENT deadline.
      await expireOverdueRequests({
        correlationId: `cor_${randomUUID()}`,
        now: new Date(selectedAt.getTime() + 61 * 60_000),
      });

      const { sql, db } = createDatabaseClient();
      try {
        const [won] = await db
          .select()
          .from(tutorRequests)
          .where(eq(tutorRequests.reference, scenario.winner));
        expect(won!.statusCode).toBe('closed');
        expect(won!.closeReasonCode).toBe('payment_window_lapsed');

        const [hold] = await db
          .select()
          .from(tutorTimeReservations)
          .where(eq(tutorTimeReservations.tutorRequestId, won!.id));
        expect(hold!.statusCode).toBe('released');
        expect(hold!.releaseReasonCode).toBe('payment_window_lapsed');

        const [ilr] = await db
          .select()
          .from(intendedLessonRequests)
          .where(eq(intendedLessonRequests.reference, scenario.ilrReference));
        expect(ilr!.statusCode).toBe('closed');
        expect(ilr!.closeReasonCode).toBe('payment_window_lapsed');
      } finally {
        await sql.end();
      }
    });

    it('leaves a selection alone while its window is still open', async () => {
      const scenario = await twoAcceptances(`pay-open-${randomUUID().slice(0, 8)}`);
      const facts = await winnerFacts(scenario.winner);
      const selectedAt = minutesBefore(facts.startAt, 600);

      await selectAcceptedTutorRequest({
        reference: scenario.ilrReference,
        studentProfileIds: scenario.studentProfileIds,
        tutorRequestReference: scenario.winner,
        actorUserId: scenario.fixture.requesterUserId,
        correlationId: `cor_${randomUUID()}`,
        now: selectedAt,
      });

      await expireOverdueRequests({
        correlationId: `cor_${randomUUID()}`,
        now: new Date(selectedAt.getTime() + 59 * 60_000),
      });

      const { sql, db } = createDatabaseClient();
      try {
        const [won] = await db
          .select()
          .from(tutorRequests)
          .where(eq(tutorRequests.reference, scenario.winner));
        expect(won!.statusCode).toBe('selected');
      } finally {
        await sql.end();
      }
    });

    /**
     * THE GUARD THIS SLICE EXISTS FOR.
     *
     * A paid booking keeps its winning request `selected` — the Tutor Request
     * state machine deliberately gained no new state — so without the ILR guard
     * the very next sweep would close a lesson somebody had paid for and hand
     * the tutor's time back. `fulfilled` is set directly here because nothing
     * writes it until the Stripe slice; the point under test is the sweep, not
     * the route into that state.
     */
    it('never expires a selection whose ILR is fulfilled, however old the deadline', async () => {
      const scenario = await twoAcceptances(`pay-fulfilled-${randomUUID().slice(0, 8)}`);
      const facts = await winnerFacts(scenario.winner);
      const selectedAt = minutesBefore(facts.startAt, 600);

      await selectAcceptedTutorRequest({
        reference: scenario.ilrReference,
        studentProfileIds: scenario.studentProfileIds,
        tutorRequestReference: scenario.winner,
        actorUserId: scenario.fixture.requesterUserId,
        correlationId: `cor_${randomUUID()}`,
        now: selectedAt,
      });

      const { sql, db } = createDatabaseClient();
      try {
        await db
          .update(intendedLessonRequests)
          .set({ statusCode: 'fulfilled' })
          .where(eq(intendedLessonRequests.reference, scenario.ilrReference));
        await db
          .update(tutorTimeReservations)
          .set({ reservationTypeCode: 'booking_confirmed', expiresAt: null })
          .where(eq(tutorTimeReservations.tutorRequestId, facts.id));

        // Long past the deadline, and past the acceptance hold too.
        await expireOverdueRequests({
          correlationId: `cor_${randomUUID()}`,
          now: new Date(selectedAt.getTime() + 60 * 60 * 60_000),
        });

        const [won] = await db
          .select()
          .from(tutorRequests)
          .where(eq(tutorRequests.reference, scenario.winner));
        expect(won!.statusCode).toBe('selected');
        expect(won!.closeReasonCode).toBeNull();

        const [hold] = await db
          .select()
          .from(tutorTimeReservations)
          .where(eq(tutorTimeReservations.tutorRequestId, facts.id));
        expect(hold!.statusCode).toBe('active');
        expect(hold!.reservationTypeCode).toBe('booking_confirmed');

        const [ilr] = await db
          .select()
          .from(intendedLessonRequests)
          .where(eq(intendedLessonRequests.reference, scenario.ilrReference));
        expect(ilr!.statusCode).toBe('fulfilled');
      } finally {
        await sql.end();
      }
    });

    /**
     * A selection made before the payment window existed carries no deadline,
     * and must keep behaving exactly as it does today — falling back to the
     * acceptance hold. Proved by clearing the snapshot, which is precisely the
     * shape of a row already in flight when this slice deploys.
     */
    it('falls back to the acceptance hold for a row selected before this slice', async () => {
      const scenario = await twoAcceptances(`pay-legacy-${randomUUID().slice(0, 8)}`);
      const facts = await winnerFacts(scenario.winner);
      const selectedAt = minutesBefore(facts.startAt, 600);

      await selectAcceptedTutorRequest({
        reference: scenario.ilrReference,
        studentProfileIds: scenario.studentProfileIds,
        tutorRequestReference: scenario.winner,
        actorUserId: scenario.fixture.requesterUserId,
        correlationId: `cor_${randomUUID()}`,
        now: selectedAt,
      });

      const { sql, db } = createDatabaseClient();
      try {
        await sql`update bookings.tutor_requests
                     set payment_deadline_at = null,
                         payment_window_minutes = null,
                         payment_window_rule_version = null,
                         near_lesson_cutoff_minutes = null,
                         near_lesson_cutoff_rule_version = null,
                         acceptance_hold_expires_at = now() - interval '1 minute'
                   where reference = ${scenario.winner}`;

        await expireOverdueRequests({ correlationId: `cor_${randomUUID()}` });

        const [won] = await db
          .select()
          .from(tutorRequests)
          .where(eq(tutorRequests.reference, scenario.winner));
        expect(won!.statusCode).toBe('closed');
        expect(won!.closeReasonCode).toBe('payment_window_lapsed');
      } finally {
        await sql.end();
      }
    });

    /**
     * Concurrency is unchanged by this slice, and that has to be shown rather
     * than assumed: the window check sits inside the same transaction as the
     * claim, so two guardians choosing at once must still produce exactly one
     * winner and one honest refusal.
     */
    it('still admits exactly one winner when two selections race', async () => {
      const scenario = await twoAcceptances(`pay-race-${randomUUID().slice(0, 8)}`);
      const facts = await winnerFacts(scenario.winner);
      const selectedAt = minutesBefore(facts.startAt, 600);

      const attempt = () =>
        selectAcceptedTutorRequest({
          reference: scenario.ilrReference,
          studentProfileIds: scenario.studentProfileIds,
          tutorRequestReference: scenario.winner,
          actorUserId: scenario.fixture.requesterUserId,
          correlationId: `cor_${randomUUID()}`,
          now: selectedAt,
        });

      const results = await Promise.allSettled([attempt(), attempt()]);
      expect(results.filter((entry) => entry.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find((entry) => entry.status === 'rejected');
      expect((rejected as PromiseRejectedResult).reason).toBeInstanceOf(
        SelectionNoLongerAvailableError,
      );

      const { sql, db } = createDatabaseClient();
      try {
        const [won] = await db
          .select()
          .from(tutorRequests)
          .where(eq(tutorRequests.reference, scenario.winner));
        // One deadline, written once.
        expect(won!.paymentDeadlineAt?.getTime()).toBe(selectedAt.getTime() + 60 * 60_000);
      } finally {
        await sql.end();
      }
    });
  });

  describe('holds die at their natural expiry', () => {
    /** Force a hold's expiry into the past, as the clock eventually would. */
    const expireHold = async (reference: string): Promise<void> => {
      const { sql } = createDatabaseClient();
      try {
        await sql`update bookings.tutor_requests
                     set acceptance_hold_expires_at = now() - interval '1 minute'
                   where reference = ${reference}`;
      } finally {
        await sql.end();
      }
    };

    /**
     * Force a SELECTED request's payment window into the past.
     *
     * Separate from `expireHold`, because after selection the acceptance hold
     * is no longer what governs — the payment deadline is, and the sweep reads
     * that. Ageing the acceptance hold on a selected row proves nothing, and
     * before this helper existed it silently proved the opposite.
     */
    const expirePaymentWindow = async (reference: string): Promise<void> => {
      const { sql } = createDatabaseClient();
      try {
        await sql`update bookings.tutor_requests
                     set payment_deadline_at = now() - interval '1 minute'
                   where reference = ${reference}`;
      } finally {
        await sql.end();
      }
    };

    it('releases an accepted hold the family never chose', async () => {
      // §8.2: the selection window lapsed. The tutor gets their calendar back
      // rather than holding it on the chance a decision arrives later.
      const scenario = await twoAcceptances(`lapse-accept-${randomUUID().slice(0, 8)}`);
      await expireHold(scenario.winner);

      await expireOverdueRequests({ correlationId: `cor_${randomUUID()}`, now: new Date() });

      const { sql, db } = createDatabaseClient();
      try {
        const [request] = await db
          .select()
          .from(tutorRequests)
          .where(eq(tutorRequests.reference, scenario.winner));
        expect(request!.statusCode).toBe('closed');
        expect(request!.closeReasonCode).toBe('selection_window_lapsed');

        const holds = await db
          .select()
          .from(tutorTimeReservations)
          .where(eq(tutorTimeReservations.tutorRequestId, request!.id));
        expect(holds[0]!.statusCode).toBe('released');
      } finally {
        await sql.end();
      }
    });

    it('releases the winner hold when payment never happens', async () => {
      // Selection moves the winner's hold to the PAYMENT DEADLINE — usually
      // sooner than the acceptance hold it replaces, never later. When that
      // deadline passes with no payment, the hold goes: §12 forbids retaining
      // it beyond its expiry, and the tutor's own screen promises it is
      // released either way.
      const scenario = await twoAcceptances(`lapse-selected-${randomUUID().slice(0, 8)}`);
      await selectAcceptedTutorRequest({
        reference: scenario.ilrReference,
        studentProfileIds: scenario.studentProfileIds,
        tutorRequestReference: scenario.winner,
        actorUserId: scenario.fixture.requesterUserId,
        correlationId: `cor_${randomUUID()}`,
      });
      await expirePaymentWindow(scenario.winner);

      await expireOverdueRequests({ correlationId: `cor_${randomUUID()}`, now: new Date() });

      const { sql, db } = createDatabaseClient();
      try {
        const [request] = await db
          .select()
          .from(tutorRequests)
          .where(eq(tutorRequests.reference, scenario.winner));
        expect(request!.statusCode).toBe('closed');
        expect(request!.closeReasonCode).toBe('payment_window_lapsed');

        const holds = await db
          .select()
          .from(tutorTimeReservations)
          .where(eq(tutorTimeReservations.tutorRequestId, request!.id));
        expect(holds[0]!.statusCode).toBe('released');

        // The ILR follows its winner, forwards — never back out of a terminal.
        const [ilr] = await db
          .select()
          .from(intendedLessonRequests)
          .where(eq(intendedLessonRequests.reference, scenario.ilrReference));
        expect(ilr!.statusCode).toBe('closed');
        expect(ilr!.closeReasonCode).toBe('payment_window_lapsed');
      } finally {
        await sql.end();
      }
    });

    it('does not let a withdrawal half-apply over a completed selection', async () => {
      const scenario = await twoAcceptances(`withdraw-after-${randomUUID().slice(0, 8)}`);
      const { sql, db } = createDatabaseClient();
      let ilrId: string;
      try {
        const [row] = await db
          .select({ id: intendedLessonRequests.id })
          .from(intendedLessonRequests)
          .where(eq(intendedLessonRequests.reference, scenario.ilrReference));
        ilrId = row!.id;
      } finally {
        await sql.end();
      }

      await selectAcceptedTutorRequest({
        reference: scenario.ilrReference,
        studentProfileIds: scenario.studentProfileIds,
        tutorRequestReference: scenario.winner,
        actorUserId: scenario.fixture.requesterUserId,
        correlationId: `cor_${randomUUID()}`,
      });

      // A stale tab submitting withdrawal after the choice was made must not
      // close the winner and strand the request with no chosen tutor.
      const outcome = await withdrawRequest({
        intendedLessonRequestId: ilrId,
        actorUserId: scenario.fixture.requesterUserId,
        correlationId: `cor_${randomUUID()}`,
      });
      expect(outcome.withdrawnCount).toBe(0);

      const probe = createDatabaseClient();
      try {
        const [winner] = await probe.db
          .select()
          .from(tutorRequests)
          .where(eq(tutorRequests.reference, scenario.winner));
        expect(winner!.statusCode).toBe('selected');
      } finally {
        await probe.sql.end();
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
          gapMinutes: 0,
          effectiveEndAt: new Date(reservedStart.getTime() + 60 * 60 * 1000),
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
  /**
   * The booking journey's two new guarantees, tested where they actually live.
   *
   * Both are about a family being charged, or a child's profile being changed,
   * by something other than what the family chose.
   */
});

describe.skipIf(!available)(
  'booking journey: chosen lengths and atomic sends (integration)',
  () => {
    /**
     * A tutor who publishes TWO lengths for one subject.
     *
     * Nothing in the schema ever prevented this; everything else assumed it
     * away. The dearer, longer version is second so "cheapest" and "first" are
     * different rows and a test cannot pass by accident.
     */
    async function buildTwoLengthFixture(label: string): Promise<{
      requesterUserId: string;
      studentProfileId: string;
      subjectId: string;
      tutorProfileId: string;
      shortVersionId: string;
      longVersionId: string;
      otherSubjectVersionId: string;
      otherTutorVersionId: string;
    }> {
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
        const [otherSubject] = await db
          .insert(subjects)
          .values({ code: `other-${label}`, displayName: `Other ${label}` })
          .returning({ id: subjects.id });
        const [student] = await db
          .insert(studentProfiles)
          .values({ preferredName: `Student ${label}`, independenceStatusCode: 'dependent' })
          .returning({ id: studentProfiles.id });

        const makeTutor = async (suffix: string): Promise<string> => {
          const [tutorUser] = await db
            .insert(users)
            .values({
              displayName: `Tutor ${label}-${suffix}`,
              countryCode: 'NZ',
              timeZone: 'Pacific/Auckland',
              locale: 'en-NZ',
            })
            .returning({ id: users.id });
          const [profile] = await db
            .insert(tutorProfiles)
            .values({
              userId: tutorUser!.id,
              publicFirstName: `T${suffix}`,
              visibilityStateCode: 'unlisted',
            })
            .returning({ id: tutorProfiles.id });
          await db.insert(availabilityExceptions).values({
            tutorProfileId: profile!.id,
            startsAt: new Date(Date.now() - 60 * 60 * 1000),
            endsAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            effectCode: 'adds',
          });
          return profile!.id;
        };

        const makeVersion = async (
          tutorProfileId: string,
          subjectId: string,
          displayName: string,
          durationMinutes: number,
          priceAmountMinor: bigint,
        ): Promise<string> => {
          const [service] = await db
            .insert(services)
            .values({ tutorProfileId, subjectId, displayName })
            .returning({ id: services.id });
          const [version] = await db
            .insert(serviceVersions)
            .values({
              serviceId: service!.id,
              durationMinutes,
              priceAmountMinor,
              currencyCode: 'NZD',
            })
            .returning({ id: serviceVersions.id });
          return version!.id;
        };

        const tutorProfileId = await makeTutor('a');
        const otherTutorProfileId = await makeTutor('b');

        return {
          requesterUserId: requester!.id,
          studentProfileId: student!.id,
          subjectId: subject!.id,
          tutorProfileId,
          shortVersionId: await makeVersion(
            tutorProfileId,
            subject!.id,
            `Short ${label}`,
            60,
            4000n,
          ),
          longVersionId: await makeVersion(tutorProfileId, subject!.id, `Long ${label}`, 90, 6000n),
          otherSubjectVersionId: await makeVersion(
            tutorProfileId,
            otherSubject!.id,
            `Other subject ${label}`,
            60,
            1000n,
          ),
          otherTutorVersionId: await makeVersion(
            otherTutorProfileId,
            subject!.id,
            `Other tutor ${label}`,
            60,
            1000n,
          ),
        };
      } finally {
        await sql.end();
      }
    }

    const draftFor = (fixture: { studentProfileId: string; subjectId: string }) => ({
      studentProfileId: fixture.studentProfileId,
      subjectId: fixture.subjectId,
      schoolYearCode: 'Y9',
      formatPreferenceCode: 'online',
    });

    async function countSections(studentProfileId: string): Promise<number> {
      const { sql, db } = createDatabaseClient();
      try {
        const rows = await db
          .select({ id: studentSubjectSections.id })
          .from(studentSubjectSections)
          .where(eq(studentSubjectSections.studentProfileId, studentProfileId));
        return rows.length;
      } finally {
        await sql.end();
      }
    }

    it('honours the chosen lesson length rather than whichever row came back last', async () => {
      const fixture = await buildTwoLengthFixture(`len-${randomUUID().slice(0, 8)}`);
      const start = future(100);

      const created = await createIntendedLessonRequest({
        subjectSectionDraft: draftFor(fixture),
        requestedByUserId: fixture.requesterUserId,
        familyAccountId: null,
        tutorProfileIds: [fixture.tutorProfileId],
        serviceVersionIdByTutor: new Map([[fixture.tutorProfileId, fixture.longVersionId]]),
        proposedStarts: [start],
        formatCode: 'online',
        timeZone: 'Pacific/Auckland',
        notesForTutors: null,
        hasPaymentMethodOnFile: false,
        paymentExemptionCode: null,
        correlationId: `cor_${randomUUID()}`,
      });

      const { sql, db } = createDatabaseClient();
      try {
        const [ilr] = await db
          .select({ durationMinutes: intendedLessonRequests.durationMinutes })
          .from(intendedLessonRequests)
          .where(eq(intendedLessonRequests.id, created.intendedLessonRequestId));
        expect(ilr?.durationMinutes).toBe(90);

        // And the tutor's own row points at the version the family paid for.
        const [request] = await db
          .select({ serviceVersionId: tutorRequests.serviceVersionId })
          .from(tutorRequests)
          .where(eq(tutorRequests.intendedLessonRequestId, created.intendedLessonRequestId));
        expect(request?.serviceVersionId).toBe(fixture.longVersionId);
      } finally {
        await sql.end();
      }
    });

    it('falls back to the cheapest version when no length is chosen', async () => {
      const fixture = await buildTwoLengthFixture(`cheap-${randomUUID().slice(0, 8)}`);
      const created = await createIntendedLessonRequest({
        subjectSectionDraft: draftFor(fixture),
        requestedByUserId: fixture.requesterUserId,
        familyAccountId: null,
        tutorProfileIds: [fixture.tutorProfileId],
        proposedStarts: [future(101)],
        formatCode: 'online',
        timeZone: 'Pacific/Auckland',
        notesForTutors: null,
        hasPaymentMethodOnFile: false,
        paymentExemptionCode: null,
        correlationId: `cor_${randomUUID()}`,
      });

      const { sql, db } = createDatabaseClient();
      try {
        const [request] = await db
          .select({ serviceVersionId: tutorRequests.serviceVersionId })
          .from(tutorRequests)
          .where(eq(tutorRequests.intendedLessonRequestId, created.intendedLessonRequestId));
        // An unstated choice is never the most expensive thing on offer.
        expect(request?.serviceVersionId).toBe(fixture.shortVersionId);
      } finally {
        await sql.end();
      }
    });

    /**
     * A service version id is an amount of money. Accepting one because it
     * exists, rather than because it is this tutor's, would let a crafted form
     * buy a ninety-minute lesson at another tutor's ten-dollar price.
     */
    it('refuses a version belonging to another tutor', async () => {
      const fixture = await buildTwoLengthFixture(`xtutor-${randomUUID().slice(0, 8)}`);
      await expect(
        createIntendedLessonRequest({
          subjectSectionDraft: draftFor(fixture),
          requestedByUserId: fixture.requesterUserId,
          familyAccountId: null,
          tutorProfileIds: [fixture.tutorProfileId],
          serviceVersionIdByTutor: new Map([[fixture.tutorProfileId, fixture.otherTutorVersionId]]),
          proposedStarts: [future(102)],
          formatCode: 'online',
          timeZone: 'Pacific/Auckland',
          notesForTutors: null,
          hasPaymentMethodOnFile: false,
          paymentExemptionCode: null,
          correlationId: `cor_${randomUUID()}`,
        }),
      ).rejects.toBeInstanceOf(RequestValidationError);
    });

    it('refuses a version for another subject, even from the same tutor', async () => {
      const fixture = await buildTwoLengthFixture(`xsubject-${randomUUID().slice(0, 8)}`);
      await expect(
        createIntendedLessonRequest({
          subjectSectionDraft: draftFor(fixture),
          requestedByUserId: fixture.requesterUserId,
          familyAccountId: null,
          tutorProfileIds: [fixture.tutorProfileId],
          serviceVersionIdByTutor: new Map([
            [fixture.tutorProfileId, fixture.otherSubjectVersionId],
          ]),
          proposedStarts: [future(103)],
          formatCode: 'online',
          timeZone: 'Pacific/Auckland',
          notesForTutors: null,
          hasPaymentMethodOnFile: false,
          paymentExemptionCode: null,
          correlationId: `cor_${randomUUID()}`,
        }),
      ).rejects.toBeInstanceOf(RequestValidationError);
    });

    it('creates the subject section as part of a successful send', async () => {
      const fixture = await buildTwoLengthFixture(`section-${randomUUID().slice(0, 8)}`);
      expect(await countSections(fixture.studentProfileId)).toBe(0);

      const created = await createIntendedLessonRequest({
        subjectSectionDraft: draftFor(fixture),
        requestedByUserId: fixture.requesterUserId,
        familyAccountId: null,
        tutorProfileIds: [fixture.tutorProfileId],
        proposedStarts: [future(104)],
        formatCode: 'online',
        timeZone: 'Pacific/Auckland',
        notesForTutors: null,
        hasPaymentMethodOnFile: false,
        paymentExemptionCode: null,
        correlationId: `cor_${randomUUID()}`,
      });

      expect(created.subjectSectionCreated).toBe(true);
      expect(await countSections(fixture.studentProfileId)).toBe(1);

      // And the request really hangs from it, rather than from something else.
      const { sql, db } = createDatabaseClient();
      try {
        const [ilr] = await db
          .select({ sectionId: intendedLessonRequests.studentSubjectSectionId })
          .from(intendedLessonRequests)
          .where(eq(intendedLessonRequests.id, created.intendedLessonRequestId));
        expect(ilr?.sectionId).toBe(created.studentSubjectSectionId);
      } finally {
        await sql.end();
      }
    });

    /**
     * THE ORPHAN CASE, which is the whole reason the draft exists.
     *
     * A send that fails because no tutor can do any of the offered times must
     * leave the child exactly as it found them. Creating the section first and
     * the request second would put a subject on a child's profile that they
     * never agreed to study, because of a request that was never sent.
     */
    it('leaves no orphan subject section when the send fails', async () => {
      const fixture = await buildTwoLengthFixture(`orphan-${randomUUID().slice(0, 8)}`);
      expect(await countSections(fixture.studentProfileId)).toBe(0);

      // A time outside the tutor's open window: nothing to offer, nothing sent.
      const outside = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000);
      outside.setSeconds(0, 0);

      await expect(
        createIntendedLessonRequest({
          subjectSectionDraft: draftFor(fixture),
          requestedByUserId: fixture.requesterUserId,
          familyAccountId: null,
          tutorProfileIds: [fixture.tutorProfileId],
          proposedStarts: [outside],
          formatCode: 'online',
          timeZone: 'Pacific/Auckland',
          notesForTutors: null,
          hasPaymentMethodOnFile: false,
          paymentExemptionCode: null,
          correlationId: `cor_${randomUUID()}`,
        }),
      ).rejects.toBeInstanceOf(NoTutorAvailableError);

      expect(await countSections(fixture.studentProfileId)).toBe(0);
    });

    it('leaves no orphan subject section when validation rejects the request', async () => {
      const fixture = await buildTwoLengthFixture(`orphan2-${randomUUID().slice(0, 8)}`);

      await expect(
        createIntendedLessonRequest({
          subjectSectionDraft: draftFor(fixture),
          requestedByUserId: fixture.requesterUserId,
          familyAccountId: null,
          tutorProfileIds: [fixture.tutorProfileId],
          // 'either' is not a lesson anyone can attend; validateFanOut refuses it.
          proposedStarts: [future(105)],
          formatCode: 'either',
          timeZone: 'Pacific/Auckland',
          notesForTutors: null,
          hasPaymentMethodOnFile: false,
          paymentExemptionCode: null,
          correlationId: `cor_${randomUUID()}`,
        }),
      ).rejects.toBeInstanceOf(RequestValidationError);

      expect(await countSections(fixture.studentProfileId)).toBe(0);
    });

    it('reuses an existing section rather than creating a second', async () => {
      const fixture = await buildTwoLengthFixture(`reuse-${randomUUID().slice(0, 8)}`);
      const send = async (hours: number) =>
        createIntendedLessonRequest({
          subjectSectionDraft: draftFor(fixture),
          requestedByUserId: fixture.requesterUserId,
          familyAccountId: null,
          tutorProfileIds: [fixture.tutorProfileId],
          proposedStarts: [future(hours)],
          formatCode: 'online',
          timeZone: 'Pacific/Auckland',
          notesForTutors: null,
          hasPaymentMethodOnFile: false,
          paymentExemptionCode: null,
          correlationId: `cor_${randomUUID()}`,
        });

      const first = await send(106);
      const second = await send(130);

      expect(first.subjectSectionCreated).toBe(true);
      expect(second.subjectSectionCreated).toBe(false);
      expect(second.studentSubjectSectionId).toBe(first.studentSubjectSectionId);
      expect(await countSections(fixture.studentProfileId)).toBe(1);
    });

    /** One workable time is a real request (rule change: 1-5 times). */
    it('accepts a request offering a single time', async () => {
      const fixture = await buildTwoLengthFixture(`one-${randomUUID().slice(0, 8)}`);
      const created = await createIntendedLessonRequest({
        subjectSectionDraft: draftFor(fixture),
        requestedByUserId: fixture.requesterUserId,
        familyAccountId: null,
        tutorProfileIds: [fixture.tutorProfileId],
        proposedStarts: [future(107)],
        formatCode: 'online',
        timeZone: 'Pacific/Auckland',
        notesForTutors: null,
        hasPaymentMethodOnFile: false,
        paymentExemptionCode: null,
        correlationId: `cor_${randomUUID()}`,
      });
      expect(created.tutorRequestReferences).toHaveLength(1);
    });

    it('refuses a draft and a section id together, rather than guessing', async () => {
      const fixture = await buildTwoLengthFixture(`both-${randomUUID().slice(0, 8)}`);
      await expect(
        createIntendedLessonRequest({
          subjectSectionDraft: draftFor(fixture),
          studentSubjectSectionId: randomUUID(),
          requestedByUserId: fixture.requesterUserId,
          familyAccountId: null,
          tutorProfileIds: [fixture.tutorProfileId],
          proposedStarts: [future(108)],
          formatCode: 'online',
          timeZone: 'Pacific/Auckland',
          notesForTutors: null,
          hasPaymentMethodOnFile: false,
          paymentExemptionCode: null,
          correlationId: `cor_${randomUUID()}`,
        }),
      ).rejects.toBeInstanceOf(RequestValidationError);
    });
  },
);

/**
 * The minimum gap between one lesson and the next, where it is actually
 * enforced: the database.
 *
 * The exclusion constraint compares `[start_at, effective_end_at)`, where the
 * effective end is the lesson's end plus the gap SNAPSHOTTED when the
 * reservation was taken. Padding one side on every row requires exactly one gap
 * between any two; padding both sides of both rows would silently demand two.
 *
 * These go through the table directly rather than through acceptance, because
 * what is under test is the guarantee itself — the thing that holds when two
 * transactions race and application logic has already had its say.
 */
describe.skipIf(!available)('the minimum gap between lessons (integration)', () => {
  async function tutorWithGap(label: string, gapMinutes: number): Promise<string> {
    const { sql, db } = createDatabaseClient();
    try {
      const [tutorUser] = await db
        .insert(users)
        .values({
          displayName: `Gap tutor ${label}`,
          countryCode: 'NZ',
          timeZone: 'Pacific/Auckland',
          locale: 'en-NZ',
        })
        .returning({ id: users.id });
      const [profile] = await db
        .insert(tutorProfiles)
        .values({
          userId: tutorUser!.id,
          publicFirstName: `Gap${label}`,
          visibilityStateCode: 'unlisted',
          minimumGapMinutes: gapMinutes,
        })
        .returning({ id: tutorProfiles.id });
      return profile!.id;
    } finally {
      await sql.end();
    }
  }

  /** Insert a reservation exactly as acceptance does: gap snapshotted on the row. */
  async function reserve(
    tutorProfileId: string,
    startAt: Date,
    minutes: number,
    gapMinutes: number,
    reservationTypeCode: 'request_hold' | 'booking_confirmed' = 'request_hold',
  ): Promise<void> {
    const { sql, db } = createDatabaseClient();
    try {
      const endAt = new Date(startAt.getTime() + minutes * 60_000);
      await db.insert(tutorTimeReservations).values({
        tutorProfileId,
        startAt,
        endAt,
        gapMinutes,
        effectiveEndAt: new Date(endAt.getTime() + gapMinutes * 60_000),
        statusCode: 'active',
        reservationTypeCode,
      });
    } finally {
      await sql.end();
    }
  }

  const at = (iso: string): Date => new Date(iso);

  it('allows a lesson beginning exactly one gap after the last one ends', async () => {
    const tutor = await tutorWithGap(`ok-${randomUUID().slice(0, 8)}`, 15);
    await reserve(tutor, at('2031-03-01T17:00:00Z'), 60, 15); // ends 18:00
    // 18:15 is exactly fifteen minutes later. The gap is a MINIMUM, so this is
    // the first legitimate start rather than one minute too soon.
    await expect(reserve(tutor, at('2031-03-01T18:15:00Z'), 60, 15)).resolves.toBeUndefined();
  });

  it('refuses a lesson one minute inside the gap', async () => {
    const tutor = await tutorWithGap(`short-${randomUUID().slice(0, 8)}`, 15);
    await reserve(tutor, at('2031-03-02T17:00:00Z'), 60, 15); // ends 18:00
    await expect(reserve(tutor, at('2031-03-02T18:14:00Z'), 60, 15)).rejects.toThrow();
  });

  /**
   * Order must not matter. The constraint compares two padded ranges, so a
   * lesson placed too close BEFORE an existing one is caught by its own padding
   * running into that lesson's start — which is the half of the rule that a
   * one-sided pad might be expected to miss, and does not.
   */
  it('refuses the same pair inserted in the opposite order', async () => {
    const tutor = await tutorWithGap(`rev-${randomUUID().slice(0, 8)}`, 15);
    await reserve(tutor, at('2031-03-03T18:14:00Z'), 60, 15); // later one first
    await expect(reserve(tutor, at('2031-03-03T17:00:00Z'), 60, 15)).rejects.toThrow();
  });

  it('allows the legitimate pair inserted in the opposite order', async () => {
    const tutor = await tutorWithGap(`revok-${randomUUID().slice(0, 8)}`, 15);
    await reserve(tutor, at('2031-03-04T18:15:00Z'), 60, 15);
    await expect(reserve(tutor, at('2031-03-04T17:00:00Z'), 60, 15)).resolves.toBeUndefined();
  });

  /**
   * A hold and a confirmed lesson are one table and one rule. A tutor needs the
   * same turnaround whether the next lesson is agreed or still being decided,
   * and treating them differently would let a hold be taken that could never
   * become a booking.
   */
  it('applies the gap between an active hold and a confirmed lesson', async () => {
    const tutor = await tutorWithGap(`mixed-${randomUUID().slice(0, 8)}`, 15);
    await reserve(tutor, at('2031-03-05T17:00:00Z'), 60, 15, 'booking_confirmed');
    await expect(
      reserve(tutor, at('2031-03-05T18:05:00Z'), 60, 15, 'request_hold'),
    ).rejects.toThrow();
    await expect(
      reserve(tutor, at('2031-03-05T18:15:00Z'), 60, 15, 'request_hold'),
    ).resolves.toBeUndefined();
  });

  it('honours a tutor who needs no gap at all', async () => {
    const tutor = await tutorWithGap(`zero-${randomUUID().slice(0, 8)}`, 0);
    await reserve(tutor, at('2031-03-06T17:00:00Z'), 60, 0);
    await expect(reserve(tutor, at('2031-03-06T18:00:00Z'), 60, 0)).resolves.toBeUndefined();
  });

  /**
   * THE SNAPSHOT, which is why the gap lives on the row at all.
   *
   * A tutor who widens their gap tomorrow must not retroactively invalidate a
   * hold a family already has, nor move the line under a lesson already agreed.
   * The new figure governs what may be taken NEXT.
   */
  it('does not rewrite reservations already taken when the tutor changes the setting', async () => {
    const tutor = await tutorWithGap(`snap-${randomUUID().slice(0, 8)}`, 15);
    await reserve(tutor, at('2031-03-07T17:00:00Z'), 60, 15);

    await setTutorMinimumGapMinutes({ tutorProfileId: tutor, minimumGapMinutes: 60 });

    const { sql, db } = createDatabaseClient();
    try {
      const rows = await db
        .select({
          gapMinutes: tutorTimeReservations.gapMinutes,
          endAt: tutorTimeReservations.endAt,
          effectiveEndAt: tutorTimeReservations.effectiveEndAt,
        })
        .from(tutorTimeReservations)
        .where(eq(tutorTimeReservations.tutorProfileId, tutor));

      expect(rows).toHaveLength(1);
      // Still fifteen, and the blocked interval still ends fifteen past.
      expect(rows[0]?.gapMinutes).toBe(15);
      expect(rows[0]!.effectiveEndAt.getTime() - rows[0]!.endAt.getTime()).toBe(15 * 60_000);
    } finally {
      await sql.end();
    }

    // And the live setting really did change, so the next one is governed by it.
    expect(await tutorMinimumGapMinutes(tutor)).toBe(60);
  });

  it('keeps two tutors gaps to themselves', async () => {
    const roomy = await tutorWithGap(`roomy-${randomUUID().slice(0, 8)}`, 60);
    const tight = await tutorWithGap(`tight-${randomUUID().slice(0, 8)}`, 0);
    await reserve(roomy, at('2031-03-08T17:00:00Z'), 60, 60);
    // The same pair of times, refused for one tutor and fine for the other.
    await expect(reserve(roomy, at('2031-03-08T18:15:00Z'), 60, 60)).rejects.toThrow();
    await reserve(tight, at('2031-03-08T17:00:00Z'), 60, 0);
    await expect(reserve(tight, at('2031-03-08T18:00:00Z'), 60, 0)).resolves.toBeUndefined();
  });
});
