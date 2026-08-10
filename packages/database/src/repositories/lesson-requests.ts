import { and, eq, inArray, lte } from 'drizzle-orm';
import {
  assignPositions,
  calculateDeadlines,
  validateFanOut,
  type FanOutTarget,
  type RequestRules,
} from '@studdy/domain/bookings';
import { createDatabaseClient } from '../client';
import {
  auditEvents,
  domainEvents,
  intendedLessonRequests,
  outboxEntries,
  services,
  serviceVersions,
  statusTransitions,
  studentProfiles,
  studentSubjectSections,
  tutorProfiles,
  tutorRequests,
  tutorTimeReservations,
} from '../schema/index';
import { loadRequestRules } from './rule-settings';

/**
 * Commands for the Intended Lesson Request slice.
 *
 * Accept/decline, selection close-out, Booking creation and anything Stripe or
 * ledger are deliberately NOT here — they belong to later slices.
 */

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
  readonly proposedStartAt: Date;
  readonly proposedEndAt: Date;
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

    const validation = validateFanOut(
      rules,
      {
        targets,
        proposedStartAt: input.proposedStartAt,
        proposedEndAt: input.proposedEndAt,
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

    const deadlines = calculateDeadlines(rules, input.proposedStartAt, now);
    const positioned = assignPositions(targets);

    return await db.transaction(async (tx) => {
      const [ilr] = await tx
        .insert(intendedLessonRequests)
        .values({
          studentSubjectSectionId: input.studentSubjectSectionId,
          requestedByUserId: input.requestedByUserId,
          familyAccountId: input.familyAccountId,
          statusCode: 'awaiting_responses',
          proposedStartAt: input.proposedStartAt,
          proposedEndAt: input.proposedEndAt,
          durationMinutes: validation.value.durationMinutes,
          formatCode: input.formatCode,
          timeZone: input.timeZone,
          notesForTutors: input.notesForTutors,
          // Snapshotted: later configuration changes never move this.
          decisionDeadlineAt: deadlines.decisionDeadlineAt,
          deadlineRuleVersion,
          sentAt: now,
          createdByUserId: input.requestedByUserId,
        })
        .returning({ id: intendedLessonRequests.id, reference: intendedLessonRequests.reference });
      if (ilr === undefined) throw new Error('intended_lesson_requests insert returned no row');

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
            respondByAt: deadlines.respondByAt,
            deadlineRuleVersion,
            sentAt: now,
            createdByUserId: input.requestedByUserId,
          })
          .returning({ id: tutorRequests.id, reference: tutorRequests.reference });
        if (request === undefined) throw new Error('tutor_requests insert returned no row');
        references.push(request.reference);

        // The hold. Overlap is rejected by the exclusion constraint, which is
        // what makes fan-out atomic against concurrent requests.
        await tx.insert(tutorTimeReservations).values({
          tutorProfileId: target.tutorProfileId,
          tutorRequestId: request.id,
          startAt: input.proposedStartAt,
          endAt: input.proposedEndAt,
          statusCode: 'active',
          reservationTypeCode: 'request_hold',
          expiresAt: deadlines.respondByAt,
        });

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
          payload: { tutorRequestReference: request.reference, respondByAt: deadlines.respondByAt },
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
        newValue: { tutorCount: positioned.length, proposedStartAt: input.proposedStartAt },
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
