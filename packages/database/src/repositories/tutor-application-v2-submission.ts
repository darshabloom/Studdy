import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  APPLICATION_CHECK_CODES,
  EDITABLE_APPLICATION_STATUSES,
  prepareApplicationV2Submission,
  type ApplicationV2SubmissionPolicy,
  type TutorApplicationV2Draft,
} from '@studdy/domain/tutors';
import { createDatabaseClient } from '../client';
import {
  domainEvents,
  outboxEntries,
  statusTransitions,
  subjects,
  tutorApplicationChecks,
  tutorApplications,
  tutorApplicationV2Revisions,
} from '../schema/index';

/**
 * Internal-only submission transaction. Do not expose this to applicants until
 * versioned agreement links, guardian-consent verification, v2 reviewer
 * projections, notification delivery and approval workflow are connected.
 */
export type SubmitV2Result =
  | { readonly status: 'submitted'; readonly revisionNumber: number }
  | { readonly status: 'not_found' | 'not_editable' | 'conflict' }
  | { readonly status: 'invalid'; readonly issues: Record<string, string> };

export async function submitApplicationV2(input: {
  readonly userId: string;
  readonly expectedRecordVersion: number;
  readonly correlationId: string;
  /** Trusted server-side legal document versions and guardian consent check. */
  readonly policy: Pick<
    ApplicationV2SubmissionPolicy,
    | 'tutorAgreementVersion'
    | 'codeOfConductVersion'
    | 'privacyNoticeVersion'
    | 'guardianConsentVerified'
    | 'guardianConsentReference'
  >;
  readonly now?: Date;
}): Promise<SubmitV2Result> {
  const now = input.now ?? new Date();
  const { sql: client, db } = createDatabaseClient();
  try {
    return await db.transaction(async (tx): Promise<SubmitV2Result> => {
      const [application] = await tx
        .select()
        .from(tutorApplications)
        .where(eq(tutorApplications.applicantUserId, input.userId))
        .orderBy(
          sql`case when ${tutorApplications.statusCode} in ('draft', 'changes_requested') then 0 else 1 end`,
        )
        .limit(1)
        .for('update');

      if (!application) return { status: 'not_found' };
      if (!(EDITABLE_APPLICATION_STATUSES as readonly string[]).includes(application.statusCode)) {
        return { status: 'not_editable' };
      }
      if (application.recordVersion !== input.expectedRecordVersion) {
        return { status: 'conflict' };
      }

      const current = application.draft;
      if (
        current === null ||
        typeof current !== 'object' ||
        Array.isArray(current) ||
        (current as Record<string, unknown>)['schemaVersion'] !== 2
      ) {
        return { status: 'not_editable' };
      }

      const allowed = await tx
        .select({ id: subjects.id })
        .from(subjects)
        .where(eq(subjects.statusCode, 'active'));

      // Important: trust the current server-stored draft and catalogue, not an
      // arbitrary browser-provided snapshot or a list of claimed subject IDs.
      const prepared = prepareApplicationV2Submission(current as TutorApplicationV2Draft, {
        ...input.policy,
        knownSubjectIds: allowed.map((row) => row.id),
        today: now.toISOString().slice(0, 10),
      });
      if (prepared.status === 'invalid') {
        return { status: 'invalid', issues: prepared.issues };
      }

      const revisionNumber = application.currentRevisionNumber + 1;
      await tx.insert(tutorApplicationV2Revisions).values({
        applicationId: application.id,
        revisionNumber,
        submittedAt: now,
        snapshot: prepared.snapshot,
        tutorAgreementVersion: prepared.snapshot.documentVersions.tutorAgreement,
        codeOfConductVersion: prepared.snapshot.documentVersions.codeOfConduct,
        privacyNoticeVersion: prepared.snapshot.documentVersions.privacyNotice,
        guardianConsentReference: prepared.snapshot.guardianConsentReference,
      });

      const [moved] = await tx
        .update(tutorApplications)
        .set({
          statusCode: 'submitted',
          currentRevisionNumber: revisionNumber,
          submittedAt: now,
          draft: null,
          applicantMessage: null,
          recordVersion: sql`${tutorApplications.recordVersion} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(tutorApplications.id, application.id),
            eq(tutorApplications.recordVersion, input.expectedRecordVersion),
            inArray(tutorApplications.statusCode, [...EDITABLE_APPLICATION_STATUSES]),
          ),
        )
        .returning({ id: tutorApplications.id });
      if (!moved) throw new Error('Tutor Application changed during v2 submission.');

      await tx
        .insert(tutorApplicationChecks)
        .values(
          APPLICATION_CHECK_CODES.map((checkCode) => ({
            applicationId: application.id,
            checkCode,
            statusCode: 'pending',
          })),
        )
        .onConflictDoNothing();

      const reasonCode = revisionNumber === 1 ? 'application_submitted' : 'application_resubmitted';
      await tx.insert(statusTransitions).values({
        entityType: 'tutor_application',
        entityId: application.id,
        fromStatusCode: application.statusCode,
        toStatusCode: 'submitted',
        actorUserId: input.userId,
        reasonCode,
        correlationId: input.correlationId,
        occurredAt: now,
      });
      await tx.insert(domainEvents).values({
        eventType: 'tutor_application.v2_submitted',
        entityType: 'tutor_application',
        entityId: application.id,
        payload: { applicationId: application.id, revisionNumber, schemaVersion: 2 },
        correlationId: input.correlationId,
        occurredAt: now,
      });
      // Reuse the existing applicant + operations templates, resolving only
      // the preferred name and APP reference from this exact v2 revision.
      await tx.insert(outboxEntries).values({
        eventType: 'tutor_application.submitted',
        payload: { applicationId: application.id, revisionNumber, schemaVersion: 2 },
        idempotencyKey: `tutor_application.submitted:v2:${application.id}:${revisionNumber}`,
        correlationId: input.correlationId,
      });
      return { status: 'submitted', revisionNumber };
    });
  } finally {
    await client.end();
  }
}
