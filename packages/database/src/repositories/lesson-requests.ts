import { and, eq, inArray, lte } from 'drizzle-orm';
import {
  assignPositions,
  calculateDeadlines,
  offeredSubset,
  validateFanOut,
  type FanOutTarget,
  type RequestRules,
} from '@studdy/domain/bookings';
import { zonedClockTime, zonedDateOnly } from '@studdy/domain/availability';
import { createDatabaseClient } from '../client';
import {
  auditEvents,
  domainEvents,
  intendedLessonRequests,
  outboxEntries,
  requestTimeOptions,
  tutorRequestTimeOptions,
  services,
  serviceVersions,
  statusTransitions,
  studentProfiles,
  studentSubjectSections,
  tutorProfiles,
  tutorRequests,
  tutorTimeReservations,
} from '../schema/index';
import { bookableSlotsForTutors } from './availability';
import { loadRequestRules } from './rule-settings';

/**
 * Commands for the Intended Lesson Request slice.
 *
 * Accept/decline, selection close-out, Booking creation and anything Stripe or
 * ledger are deliberately NOT here — they belong to later slices.
 */

/**
 * Tutors grouped by their own lesson length, so availability is derived once
 * per distinct duration rather than once per tutor.
 */
function groupByDuration(
  targets: readonly FanOutTarget[],
  durationByTutor: ReadonlyMap<string, number>,
): ReadonlyMap<number, string[]> {
  const groups = new Map<number, string[]>();
  for (const target of targets) {
    const duration = durationByTutor.get(target.tutorProfileId) ?? 60;
    const existing = groups.get(duration);
    if (existing === undefined) groups.set(duration, [target.tutorProfileId]);
    else existing.push(target.tutorProfileId);
  }
  return groups;
}

/** Postgres SQLSTATEs surfaced by the guarantees this slice relies on. */
const UNIQUE_VIOLATION = '23505';
const EXCLUSION_VIOLATION = '23P01';

/** Drizzle wraps driver errors, so the SQLSTATE sits on the cause chain. */
function postgresErrorCode(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current !== null && current !== undefined; depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string') return code;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

export class SlotUnavailableError extends Error {
  override name = 'SlotUnavailableError';
  constructor(readonly tutorProfileId: string | null) {
    super('A selected tutor is no longer free at that time.');
  }
}

export class RequestValidationError extends Error {
  override name = 'RequestValidationError';
  constructor(readonly issues: Record<string, string>) {
    super('Request validation failed');
  }
}

export interface CreateIntendedLessonRequestInput {
  readonly studentSubjectSectionId: string;
  readonly requestedByUserId: string;
  readonly familyAccountId: string | null;
  /**
   * Tutor profile ids only. The priced service version is resolved
   * SERVER-SIDE from the subject section, so a crafted form cannot pin one
   * tutor to another tutor's cheaper price.
   */
  readonly tutorProfileIds: readonly string[];
  /**
   * The times the family would accept, as start instants (D-3). Each tutor is
   * offered only the subset they can actually do; a tutor who can do none is
   * not sent a request at all.
   */
  readonly proposedStarts: readonly Date[];
  readonly formatCode: string;
  readonly timeZone: string;
  readonly notesForTutors: string | null;
  readonly hasPaymentMethodOnFile: boolean;
  readonly paymentExemptionCode: string | null;
  readonly correlationId: string;
  /** Test seam so deadline maths is deterministic. */
  readonly now?: Date;
}

export interface CreatedIntendedLessonRequest {
  readonly intendedLessonRequestId: string;
  readonly reference: string;
  readonly tutorRequestReferences: readonly string[];
  /**
   * Tutors who could do none of the chosen times and were therefore not asked
   * (D-2). The caller surfaces this so the family learns it before sending
   * rather than discovering a silent omission afterwards.
   */
  readonly notAskedTutorProfileIds: readonly string[];
}

/** No tutor could do any of the chosen times, so nothing was sent. */
export class NoTutorAvailableError extends Error {
  override name = 'NoTutorAvailableError';
  constructor() {
    super('None of the chosen tutors are free at any of those times.');
  }
}

/**
 * Create an Intended Lesson Request and fan it out to the chosen tutors.
 *
 * ALL-OR-NOTHING (approved decision 8). The ILR, every Tutor Request, every
 * calendar hold, the audit event, the status transitions, the domain event and
 * the outbox entries are written in ONE transaction. If any tutor's slot is
 * already held, the GiST exclusion constraint raises 23P01 and the whole
 * transaction rolls back — no partial fan-out is possible, and the caller
 * learns which tutor caused it.
 */
export async function createIntendedLessonRequest(
  input: CreateIntendedLessonRequestInput,
): Promise<CreatedIntendedLessonRequest> {
  const { sql, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    const { rules, deadlineRuleVersion } = await loadRequestRules(db);

    // Resolve the priced version for each tutor from the subject section's
    // subject. Nothing about pricing is taken from the browser.
    const [sectionRow] = await db
      .select({ subjectId: studentSubjectSections.subjectId })
      .from(studentSubjectSections)
      .where(eq(studentSubjectSections.id, input.studentSubjectSectionId));
    if (sectionRow === undefined) {
      throw new RequestValidationError({ targets: 'That subject is no longer available.' });
    }

    const offerings = await db
      .select({
        tutorProfileId: services.tutorProfileId,
        serviceVersionId: serviceVersions.id,
        durationMinutes: serviceVersions.durationMinutes,
        tutorFirstName: tutorProfiles.publicFirstName,
      })
      .from(serviceVersions)
      .innerJoin(services, eq(serviceVersions.serviceId, services.id))
      .innerJoin(tutorProfiles, eq(services.tutorProfileId, tutorProfiles.id))
      .where(
        and(
          inArray(services.tutorProfileId, [...input.tutorProfileIds]),
          eq(services.subjectId, sectionRow.subjectId),
          eq(services.statusCode, 'published'),
          eq(serviceVersions.statusCode, 'current'),
        ),
      );

    const versionByTutor = new Map(
      offerings.map((row) => [row.tutorProfileId, row.serviceVersionId]),
    );
    const withoutOffering = input.tutorProfileIds.filter((id) => !versionByTutor.has(id));
    if (withoutOffering.length > 0) {
      throw new RequestValidationError({
        targets:
          'One of the tutors you chose no longer offers this subject. Refresh and try again.',
      });
    }

    const targets: FanOutTarget[] = input.tutorProfileIds.map((tutorProfileId) => ({
      tutorProfileId,
      serviceVersionId: versionByTutor.get(tutorProfileId)!,
    }));

    const durationByTutor = new Map(
      offerings.map((row) => [row.tutorProfileId, row.durationMinutes]),
    );
    // The family-side record needs one lesson length. Where invited tutors
    // differ, take the longest: the family should plan for the longest lesson
    // they might get, and each tutor's own option rows still snapshot their own
    // length.
    const familyDurationMinutes = Math.max(
      ...targets.map((target) => durationByTutor.get(target.tutorProfileId) ?? 60),
    );

    const validation = validateFanOut(
      rules,
      {
        targets,
        proposedStarts: input.proposedStarts,
        durationMinutes: familyDurationMinutes,
        formatCode: input.formatCode,
        hasPaymentMethodOnFile: input.hasPaymentMethodOnFile,
        paymentExemptionCode: input.paymentExemptionCode,
      },
      now,
    );
    if (!validation.ok) {
      throw new RequestValidationError(
        (validation.error.details?.['issues'] ?? {}) as Record<string, string>,
      );
    }

    // Work out, against live availability, which of the chosen times each tutor
    // can actually do.
    //
    // Every offered time is checked, not just one: a tutor may accept any of
    // them, so each has to be a time they were genuinely free for. This is also
    // what stops the request path being an availability oracle — a tutor is
    // only ever asked about times they could accept, so a later "no longer
    // available" cannot be read as "we asked about a time you never offered".
    //
    // `stepMinutes: 1` aligns the grid to the proposed start rather than the
    // 30-minute grid a family is shown, so this asks "is this lesson inside the
    // tutor's open time" rather than "does it sit on our display grid": a tutor
    // free 16:00–19:00 genuinely is free at 17:15.
    const bookableStartsByTutor = new Map<string, Date[]>();
    for (const startAt of validation.value.proposedStarts) {
      for (const [durationMinutes, group] of groupByDuration(targets, durationByTutor)) {
        const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);
        const bookable = await bookableSlotsForTutors({
          tutorProfileIds: group,
          from: startAt,
          to: endAt,
          durationMinutes,
          stepMinutes: 1,
          now,
        });
        for (const tutorProfileId of group) {
          const canDoIt = (bookable.get(tutorProfileId) ?? []).some(
            (slot) => slot.startAt.getTime() === startAt.getTime(),
          );
          if (!canDoIt) continue;
          const existing = bookableStartsByTutor.get(tutorProfileId);
          if (existing === undefined) bookableStartsByTutor.set(tutorProfileId, [startAt]);
          else existing.push(startAt);
        }
      }
    }

    // A tutor who can do none of the chosen times is not asked at all (D-2).
    // An unanswerable request is worse than no request: the tutor can only
    // decline, and the family waits out a deadline for an answer that was
    // never possible.
    const offeredByTutor = new Map<string, readonly Date[]>();
    const notAskedTutorProfileIds: string[] = [];
    for (const target of targets) {
      const subset = offeredSubset(
        validation.value.proposedStarts,
        bookableStartsByTutor.get(target.tutorProfileId) ?? [],
      );
      if (subset.length === 0) notAskedTutorProfileIds.push(target.tutorProfileId);
      else offeredByTutor.set(target.tutorProfileId, subset);
    }
    if (offeredByTutor.size === 0) throw new NoTutorAvailableError();

    const askedTargets = targets.filter((target) => offeredByTutor.has(target.tutorProfileId));

    // The family's own deadline runs from the soonest time they offered.
    const earliestStart = validation.value.proposedStarts[0]!;
    const familyDeadlines = calculateDeadlines(rules, earliestStart, now);

    // Each tutor's response window runs from the soonest time THEY were
    // offered — never the family's earliest.
    //
    // A shared deadline leaks the set the tutor cannot see. The window is
    // clamped to `earliest − minimum notice`, so a tutor offered only Saturday
    // but shown a deadline of 2pm today learns both that an earlier option
    // exists and, by adding the notice back, exactly when it is. The response
    // tiers leak the same thing more coarsely. Deriving from the tutor's own
    // subset is also what D-8 means by "how far ahead the lesson is": for a
    // tutor, that is the lesson they could actually accept.
    const deadlinesByTutor = new Map<string, ReturnType<typeof calculateDeadlines>>();
    for (const target of askedTargets) {
      const ownEarliest = offeredByTutor.get(target.tutorProfileId)![0]!;
      deadlinesByTutor.set(target.tutorProfileId, calculateDeadlines(rules, ownEarliest, now));
    }

    const positioned = assignPositions(askedTargets);

    return await db.transaction(async (tx) => {
      const [ilr] = await tx
        .insert(intendedLessonRequests)
        .values({
          studentSubjectSectionId: input.studentSubjectSectionId,
          requestedByUserId: input.requestedByUserId,
          familyAccountId: input.familyAccountId,
          statusCode: 'awaiting_responses',
          durationMinutes: validation.value.durationMinutes,
          formatCode: input.formatCode,
          timeZone: input.timeZone,
          notesForTutors: input.notesForTutors,
          // Snapshotted: later configuration changes never move this.
          decisionDeadlineAt: familyDeadlines.decisionDeadlineAt,
          deadlineRuleVersion,
          sentAt: now,
          createdByUserId: input.requestedByUserId,
        })
        .returning({ id: intendedLessonRequests.id, reference: intendedLessonRequests.reference });
      if (ilr === undefined) throw new Error('intended_lesson_requests insert returned no row');

      // The family's full set of acceptable times. Server-only and family-side:
      // its size alone would tell a tutor how flexible the family is.
      const optionIdByStart = new Map<number, string>();
      for (const [index, startAt] of validation.value.proposedStarts.entries()) {
        const endAt = new Date(startAt.getTime() + validation.value.durationMinutes * 60_000);
        const [option] = await tx
          .insert(requestTimeOptions)
          .values({
            intendedLessonRequestId: ilr.id,
            position: index + 1,
            startsAt: startAt,
            endsAt: endAt,
            localDate: zonedDateOnly(startAt, input.timeZone),
            localStartTime: zonedClockTime(startAt, input.timeZone),
            ianaTimeZone: input.timeZone,
            statusCode: 'offered',
          })
          .returning({ id: requestTimeOptions.id });
        if (option === undefined) throw new Error('request_time_options insert returned no row');
        optionIdByStart.set(startAt.getTime(), option.id);
      }

      const references: string[] = [];
      for (const target of positioned) {
        const [request] = await tx
          .insert(tutorRequests)
          .values({
            intendedLessonRequestId: ilr.id,
            tutorProfileId: target.tutorProfileId,
            serviceVersionId: target.serviceVersionId,
            position: target.position,
            statusCode: 'sent',
            respondByAt: deadlinesByTutor.get(target.tutorProfileId)!.respondByAt,
            deadlineRuleVersion,
            sentAt: now,
            createdByUserId: input.requestedByUserId,
          })
          .returning({ id: tutorRequests.id, reference: tutorRequests.reference });
        if (request === undefined) throw new Error('tutor_requests insert returned no row');
        references.push(request.reference);

        // This tutor's own offered subset, with their own lesson length. Times
        // are snapshotted rather than joined at read time: this row is the
        // record of what this tutor was offered, and a later change to the
        // family's options must not rewrite that history.
        const tutorDuration = durationByTutor.get(target.tutorProfileId) ?? 60;
        for (const startAt of offeredByTutor.get(target.tutorProfileId) ?? []) {
          await tx.insert(tutorRequestTimeOptions).values({
            tutorRequestId: request.id,
            requestTimeOptionId: optionIdByStart.get(startAt.getTime())!,
            startsAt: startAt,
            endsAt: new Date(startAt.getTime() + tutorDuration * 60_000),
            statusCode: 'offered',
          });
        }

        // NO calendar hold here. A request is a question, and holding three
        // tutors' calendars on speculation took real bookable time from people
        // who had not agreed to anything (D-1). The hold is taken at
        // acceptance, by the tutor who actually said yes.

        await tx.insert(statusTransitions).values({
          entityType: 'tutor_request',
          entityId: request.id,
          fromStatusCode: null,
          toStatusCode: 'sent',
          actorUserId: input.requestedByUserId,
          reasonCode: 'request_sent',
          correlationId: input.correlationId,
          occurredAt: now,
        });

        // One outbox entry per tutor. The payload deliberately carries only
        // this tutor's reference — nothing about siblings.
        await tx.insert(outboxEntries).values({
          eventType: 'tutor_request.sent',
          payload: {
            tutorRequestReference: request.reference,
            respondByAt: deadlinesByTutor.get(target.tutorProfileId)!.respondByAt,
          },
          idempotencyKey: `tutor_request.sent:${request.id}`,
          correlationId: input.correlationId,
        });
      }

      await tx.insert(statusTransitions).values({
        entityType: 'intended_lesson_request',
        entityId: ilr.id,
        fromStatusCode: null,
        toStatusCode: 'awaiting_responses',
        actorUserId: input.requestedByUserId,
        reasonCode: 'request_sent',
        correlationId: input.correlationId,
        occurredAt: now,
      });

      await tx.insert(auditEvents).values({
        category: 'business',
        action: 'intended_lesson_request.created',
        entityType: 'intended_lesson_request',
        entityId: ilr.id,
        actorUserId: input.requestedByUserId,
        correlationId: input.correlationId,
        occurredAt: now,
        newValue: {
          tutorCount: positioned.length,
          timeOptionCount: validation.value.proposedStarts.length,
          earliestStartAt: earliestStart,
        },
        riskLevel: 'low',
      });

      await tx.insert(domainEvents).values({
        eventType: 'intended_lesson_request.sent',
        entityType: 'intended_lesson_request',
        entityId: ilr.id,
        payload: { reference: ilr.reference, tutorCount: positioned.length },
        correlationId: input.correlationId,
        occurredAt: now,
      });

      return {
        intendedLessonRequestId: ilr.id,
        reference: ilr.reference,
        tutorRequestReferences: references,
        notAskedTutorProfileIds,
      };
    });
  } catch (error) {
    const code = postgresErrorCode(error);
    if (code === EXCLUSION_VIOLATION) {
      // A tutor's slot was taken between validation and the write. Nothing was
      // written: the whole transaction rolled back.
      throw new SlotUnavailableError(null);
    }
    if (code === UNIQUE_VIOLATION) {
      throw new RequestValidationError({
        targets: 'That request has already been sent. Refresh to see its current state.',
      });
    }
    throw error;
  } finally {
    await sql.end();
  }
}

/** Release every active hold attached to the given tutor requests. */
async function releaseHoldsFor(
  tx: Parameters<Parameters<ReturnType<typeof createDatabaseClient>['db']['transaction']>[0]>[0],
  tutorRequestIds: readonly string[],
  reasonCode: string,
  at: Date,
): Promise<void> {
  if (tutorRequestIds.length === 0) return;
  await tx
    .update(tutorTimeReservations)
    .set({
      statusCode: 'released',
      releasedAt: at,
      releaseReasonCode: reasonCode,
      updatedAt: at,
    })
    .where(
      and(
        inArray(tutorTimeReservations.tutorRequestId, [...tutorRequestIds]),
        eq(tutorTimeReservations.statusCode, 'active'),
      ),
    );
}

export interface WithdrawInput {
  readonly intendedLessonRequestId: string;
  readonly actorUserId: string;
  readonly correlationId: string;
  /** Withdraw a single tutor request; omit to withdraw the whole request. */
  readonly tutorRequestId?: string;
  readonly now?: Date;
}

/**
 * Withdraw one tutor request, or the whole intended lesson request.
 *
 * Idempotent: the status-guarded UPDATE simply affects no rows if the request
 * has already closed, and the command reports how many it actually changed.
 */
export async function withdrawRequest(input: WithdrawInput): Promise<{ withdrawnCount: number }> {
  const { sql, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx) => {
      // Lock the ILR so a concurrent withdrawal or expiry serialises behind us.
      const [ilr] = await tx
        .select({ id: intendedLessonRequests.id, statusCode: intendedLessonRequests.statusCode })
        .from(intendedLessonRequests)
        .where(eq(intendedLessonRequests.id, input.intendedLessonRequestId))
        .for('update');
      if (ilr === undefined) return { withdrawnCount: 0 };

      const targetFilter =
        input.tutorRequestId === undefined
          ? eq(tutorRequests.intendedLessonRequestId, input.intendedLessonRequestId)
          : and(
              eq(tutorRequests.intendedLessonRequestId, input.intendedLessonRequestId),
              eq(tutorRequests.id, input.tutorRequestId),
            );

      const liveBefore = await tx
        .select({ id: tutorRequests.id, statusCode: tutorRequests.statusCode })
        .from(tutorRequests)
        .where(
          and(targetFilter, inArray(tutorRequests.statusCode, ['sent', 'accepted', 'selected'])),
        );
      const statusBefore = new Map(liveBefore.map((row) => [row.id, row.statusCode]));

      const withdrawn = await tx
        .update(tutorRequests)
        .set({
          statusCode: 'closed',
          closedAt: now,
          closeReasonCode: 'requester_withdrew',
          updatedByUserId: input.actorUserId,
          updatedAt: now,
        })
        .where(
          and(targetFilter, inArray(tutorRequests.statusCode, ['sent', 'accepted', 'selected'])),
        )
        .returning({ id: tutorRequests.id });

      await releaseHoldsFor(
        tx,
        withdrawn.map((row) => row.id),
        'requester_withdrew',
        now,
      );

      for (const row of withdrawn) {
        await tx.insert(statusTransitions).values({
          entityType: 'tutor_request',
          entityId: row.id,
          fromStatusCode: statusBefore.get(row.id) ?? 'sent',
          toStatusCode: 'closed',
          actorUserId: input.actorUserId,
          reasonCode: 'requester_withdrew',
          correlationId: input.correlationId,
          occurredAt: now,
        });
        // Undifferentiated closure notice: no reason, no mention of others.
        await tx.insert(outboxEntries).values({
          eventType: 'tutor_request.closed',
          payload: { tutorRequestId: row.id },
          idempotencyKey: `tutor_request.closed:${row.id}`,
          correlationId: input.correlationId,
        });
      }

      // Close the ILR when nothing live remains.
      const remaining = await tx
        .select({ id: tutorRequests.id })
        .from(tutorRequests)
        .where(
          and(
            eq(tutorRequests.intendedLessonRequestId, input.intendedLessonRequestId),
            inArray(tutorRequests.statusCode, ['sent', 'accepted', 'selected']),
          ),
        );

      if (remaining.length === 0) {
        const closed = await tx
          .update(intendedLessonRequests)
          .set({
            statusCode: 'closed',
            closedAt: now,
            closeReasonCode: 'requester_withdrew',
            updatedByUserId: input.actorUserId,
            updatedAt: now,
          })
          .where(
            and(
              eq(intendedLessonRequests.id, input.intendedLessonRequestId),
              inArray(intendedLessonRequests.statusCode, [
                'awaiting_responses',
                'ready_for_selection',
              ]),
            ),
          )
          .returning({ id: intendedLessonRequests.id });

        for (const row of closed) {
          await tx.insert(statusTransitions).values({
            entityType: 'intended_lesson_request',
            entityId: row.id,
            fromStatusCode: ilr.statusCode,
            toStatusCode: 'closed',
            actorUserId: input.actorUserId,
            reasonCode: 'requester_withdrew',
            correlationId: input.correlationId,
            occurredAt: now,
          });
          await tx.insert(auditEvents).values({
            category: 'business',
            action: 'intended_lesson_request.withdrawn',
            entityType: 'intended_lesson_request',
            entityId: row.id,
            actorUserId: input.actorUserId,
            correlationId: input.correlationId,
            occurredAt: now,
            riskLevel: 'low',
          });
        }
      }

      return { withdrawnCount: withdrawn.length };
    });
  } finally {
    await sql.end();
  }
}

export interface ExpireRequestsResult {
  readonly expiredTutorRequests: number;
  readonly closedIntendedLessonRequests: number;
  readonly releasedHolds: number;
}

/**
 * Expire overdue tutor requests and close intended lesson requests that have
 * nothing live left, releasing every unused hold.
 *
 * Independent of any scheduler: Vercel Cron invokes it today and Inngest can
 * invoke the same function later without touching this logic. Idempotent and
 * batched — every UPDATE is status-guarded, so a re-run or an overlapping run
 * simply affects no rows.
 */
export async function expireOverdueRequests(options: {
  readonly correlationId: string;
  readonly batchSize?: number;
  readonly now?: Date;
}): Promise<ExpireRequestsResult> {
  const { sql, db } = createDatabaseClient();
  const now = options.now ?? new Date();
  const batchSize = options.batchSize ?? 200;
  try {
    return await db.transaction(async (tx) => {
      const due = await tx
        .select({ id: tutorRequests.id, ilrId: tutorRequests.intendedLessonRequestId })
        .from(tutorRequests)
        .where(and(eq(tutorRequests.statusCode, 'sent'), lte(tutorRequests.respondByAt, now)))
        .limit(batchSize)
        .for('update', { skipLocked: true });

      const dueIds = due.map((row) => row.id);
      let releasedHolds = 0;

      if (dueIds.length > 0) {
        const expired = await tx
          .update(tutorRequests)
          .set({
            statusCode: 'expired',
            closedAt: now,
            closeReasonCode: 'request_expired',
            updatedAt: now,
          })
          .where(and(inArray(tutorRequests.id, dueIds), eq(tutorRequests.statusCode, 'sent')))
          .returning({ id: tutorRequests.id });

        const released = await tx
          .update(tutorTimeReservations)
          .set({
            statusCode: 'released',
            releasedAt: now,
            releaseReasonCode: 'request_expired',
            updatedAt: now,
          })
          .where(
            and(
              inArray(
                tutorTimeReservations.tutorRequestId,
                expired.map((row) => row.id),
              ),
              eq(tutorTimeReservations.statusCode, 'active'),
            ),
          )
          .returning({ id: tutorTimeReservations.id });
        releasedHolds = released.length;

        for (const row of expired) {
          await tx.insert(statusTransitions).values({
            entityType: 'tutor_request',
            entityId: row.id,
            fromStatusCode: 'sent',
            toStatusCode: 'expired',
            actorUserId: null,
            reasonCode: 'request_expired',
            correlationId: options.correlationId,
            occurredAt: now,
          });
          await tx.insert(outboxEntries).values({
            eventType: 'tutor_request.closed',
            payload: { tutorRequestId: row.id },
            idempotencyKey: `tutor_request.closed:${row.id}`,
            correlationId: options.correlationId,
          });
        }
      }

      // Close any ILR past its decision deadline, or with nothing live left.
      const candidateIlrIds = [...new Set(due.map((row) => row.ilrId))];
      const overdue = await tx
        .select({ id: intendedLessonRequests.id })
        .from(intendedLessonRequests)
        .where(
          and(
            inArray(intendedLessonRequests.statusCode, [
              'awaiting_responses',
              'ready_for_selection',
            ]),
            lte(intendedLessonRequests.decisionDeadlineAt, now),
          ),
        )
        .limit(batchSize);

      const toConsider = [...new Set([...candidateIlrIds, ...overdue.map((row) => row.id)])];
      let closedCount = 0;

      for (const ilrId of toConsider) {
        const live = await tx
          .select({ id: tutorRequests.id })
          .from(tutorRequests)
          .where(
            and(
              eq(tutorRequests.intendedLessonRequestId, ilrId),
              inArray(tutorRequests.statusCode, ['sent', 'accepted', 'selected']),
            ),
          );
        const pastDeadline = overdue.some((row) => row.id === ilrId);
        if (live.length > 0 && !pastDeadline) continue;

        const closed = await tx
          .update(intendedLessonRequests)
          .set({
            statusCode: 'closed',
            closedAt: now,
            closeReasonCode: live.length === 0 ? 'all_tutors_declined' : 'request_expired',
            updatedAt: now,
          })
          .where(
            and(
              eq(intendedLessonRequests.id, ilrId),
              inArray(intendedLessonRequests.statusCode, [
                'awaiting_responses',
                'ready_for_selection',
              ]),
            ),
          )
          .returning({ id: intendedLessonRequests.id });

        for (const row of closed) {
          closedCount += 1;
          await tx.insert(statusTransitions).values({
            entityType: 'intended_lesson_request',
            entityId: row.id,
            fromStatusCode: 'awaiting_responses',
            toStatusCode: 'closed',
            actorUserId: null,
            reasonCode: 'request_expired',
            correlationId: options.correlationId,
            occurredAt: now,
          });
          await tx.insert(outboxEntries).values({
            eventType: 'intended_lesson_request.expired',
            payload: { intendedLessonRequestId: row.id },
            idempotencyKey: `intended_lesson_request.expired:${row.id}`,
            correlationId: options.correlationId,
          });
        }
      }

      return {
        expiredTutorRequests: dueIds.length,
        closedIntendedLessonRequests: closedCount,
        releasedHolds,
      };
    });
  } finally {
    await sql.end();
  }
}

/** Rules currently in force, for interface copy and validation. */
export async function currentRequestRules(): Promise<RequestRules> {
  const { rules } = await loadRequestRules();
  return rules;
}

/** Resolve the student profile owning a subject section, for scope checks. */
export async function subjectSectionOwner(
  subjectSectionId: string,
): Promise<{ studentProfileId: string; defaultFamilyAccountId: string | null } | null> {
  const { sql, db } = createDatabaseClient();
  try {
    const [row] = await db
      .select({
        studentProfileId: studentSubjectSections.studentProfileId,
        defaultFamilyAccountId: studentProfiles.defaultFamilyAccountId,
      })
      .from(studentSubjectSections)
      .innerJoin(studentProfiles, eq(studentSubjectSections.studentProfileId, studentProfiles.id))
      .where(
        and(
          eq(studentSubjectSections.id, subjectSectionId),
          eq(studentSubjectSections.statusCode, 'active'),
        ),
      );
    return row ?? null;
  } finally {
    await sql.end();
  }
}
