import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type {
  ApplicationV2SubmissionSnapshot,
  TutorApplicationStatus,
} from '@studdy/domain/tutors';
import { createDatabaseClient } from '../client';
import {
  tutorApplications,
  tutorApplicationV2Revisions,
} from '../schema/index';

/**
 * Staff-only v2 projections. Callers MUST use requireStaff() with MFA before
 * reading these personal details. No applicant or browser grants exist.
 */
export interface V2ReviewQueueEntry {
  readonly reference: string;
  readonly status: TutorApplicationStatus;
  readonly revisionNumber: number;
  readonly submittedAt: Date;
  readonly preferredFirstName: string;
  readonly verifiedChecks: number;
}

export interface V2ReviewDetail extends V2ReviewQueueEntry {
  readonly snapshot: ApplicationV2SubmissionSnapshot;
  readonly documentVersions: {
    readonly tutorAgreement: string;
    readonly codeOfConduct: string;
    readonly privacyNotice: string;
  };
  readonly guardianConsentReference: string | null;
}

export async function v2ReviewQueue(): Promise<readonly V2ReviewQueueEntry[]> {
  const { sql: client, db } = createDatabaseClient();
  try {
    const rows = await db
      .select({
        reference: tutorApplications.reference,
        statusCode: tutorApplications.statusCode,
        revisionNumber: tutorApplications.currentRevisionNumber,
        submittedAt: tutorApplicationV2Revisions.submittedAt,
        snapshot: tutorApplicationV2Revisions.snapshot,
        verifiedChecks: sql<number>`(
          select count(*)::int from tutors.tutor_application_checks c
          where c.application_id = ${tutorApplications.id} and c.status_code = 'verified'
        )`,
      })
      .from(tutorApplications)
      .innerJoin(
        tutorApplicationV2Revisions,
        and(
          eq(tutorApplicationV2Revisions.applicationId, tutorApplications.id),
          eq(
            tutorApplicationV2Revisions.revisionNumber,
            tutorApplications.currentRevisionNumber,
          ),
        ),
      )
      .where(
        inArray(tutorApplications.statusCode, [
          'submitted', 'under_review', 'changes_requested',
        ]),
      )
      .orderBy(asc(tutorApplications.submittedAt));
    return rows.map((row) => {
      const snapshot = row.snapshot as ApplicationV2SubmissionSnapshot;
      return {
        reference: row.reference,
        status: row.statusCode as TutorApplicationStatus,
        revisionNumber: row.revisionNumber,
        submittedAt: row.submittedAt,
        preferredFirstName: snapshot.answers.about.preferredFirstName,
        verifiedChecks: row.verifiedChecks,
      };
    });
  } finally {
    await client.end();
  }
}

export async function v2ApplicationForReview(reference: string): Promise<V2ReviewDetail | null> {
  const { sql: client, db } = createDatabaseClient();
  try {
    const [row] = await db
      .select({
        reference: tutorApplications.reference,
        statusCode: tutorApplications.statusCode,
        revisionNumber: tutorApplications.currentRevisionNumber,
        submittedAt: tutorApplicationV2Revisions.submittedAt,
        snapshot: tutorApplicationV2Revisions.snapshot,
        tutorAgreementVersion: tutorApplicationV2Revisions.tutorAgreementVersion,
        codeOfConductVersion: tutorApplicationV2Revisions.codeOfConductVersion,
        privacyNoticeVersion: tutorApplicationV2Revisions.privacyNoticeVersion,
        guardianConsentReference: tutorApplicationV2Revisions.guardianConsentReference,
        verifiedChecks: sql<number>`(
          select count(*)::int from tutors.tutor_application_checks c
          where c.application_id = ${tutorApplications.id} and c.status_code = 'verified'
        )`,
      })
      .from(tutorApplications)
      .innerJoin(
        tutorApplicationV2Revisions,
        and(
          eq(tutorApplicationV2Revisions.applicationId, tutorApplications.id),
          eq(
            tutorApplicationV2Revisions.revisionNumber,
            tutorApplications.currentRevisionNumber,
          ),
        ),
      )
      .where(eq(tutorApplications.reference, reference))
      .limit(1);
    if (!row) return null;
    const snapshot = row.snapshot as ApplicationV2SubmissionSnapshot;
    return {
      reference: row.reference,
      status: row.statusCode as TutorApplicationStatus,
      revisionNumber: row.revisionNumber,
      submittedAt: row.submittedAt,
      preferredFirstName: snapshot.answers.about.preferredFirstName,
      verifiedChecks: row.verifiedChecks,
      snapshot,
      documentVersions: {
        tutorAgreement: row.tutorAgreementVersion,
        codeOfConduct: row.codeOfConductVersion,
        privacyNotice: row.privacyNoticeVersion,
      },
      guardianConsentReference: row.guardianConsentReference,
    };
  } finally {
    await client.end();
  }
}
