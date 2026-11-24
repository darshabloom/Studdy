import { and, eq, inArray } from 'drizzle-orm';
import {
  APPLICATION_CHECK_CODES,
  DECIDABLE_APPLICATION_STATUSES,
  TUTOR_APPLICATION_RULE_KEYS,
  applicantAge,
  approvalReadiness,
  publicLabelForCheck,
  requiredChecksFrom,
  type ApplicationCheckCode,
  type ApplicationV2SubmissionSnapshot,
} from '@studdy/domain/tutors';
import { createDatabaseClient } from '../client';
import {
  auditEvents,
  domainEvents,
  roleDefinitions,
  ruleSettings,
  statusTransitions,
  tutorApplicationChecks,
  tutorApplicationV2Revisions,
  tutorApplications,
  tutorProfiles,
  tutorVerifications,
  userRoleAssignments,
} from '../schema/index';

export type ApproveV2Result =
  | {
      readonly status: 'approved';
      readonly tutorProfileId: string;
      readonly tutorReference: string;
    }
  | {
      readonly status:
        'not_found' | 'not_decidable' | 'profile_exists' | 'guardian_consent_missing';
    }
  | {
      readonly status: 'checks_incomplete';
      readonly missing: readonly ApplicationCheckCode[];
      readonly failed: readonly ApplicationCheckCode[];
    };

/**
 * Dedicated v2 approval transition. The caller MUST independently authorise
 * staff role and step-up MFA; this repository accepts the verified staff ID for
 * audit only. All status, revision, checks, role, profile and audit writes share
 * one database transaction. A newly approved tutor remains unlisted until
 * post-approval setup and service review explicitly publish them.
 *
 * No launch while the related staff controls and notifications are unfinished.
 */
export async function approveApplicationV2(input: {
  readonly reference: string;
  readonly actorUserId: string;
  readonly correlationId: string;
  readonly now?: Date;
}): Promise<ApproveV2Result> {
  const now = input.now ?? new Date();
  const { sql: client, db } = createDatabaseClient();
  try {
    return await db.transaction(async (tx): Promise<ApproveV2Result> => {
      const [application] = await tx
        .select()
        .from(tutorApplications)
        .where(eq(tutorApplications.reference, input.reference))
        .limit(1)
        .for('update');
      if (!application) return { status: 'not_found' };
      if (!(DECIDABLE_APPLICATION_STATUSES as readonly string[]).includes(application.statusCode))
        return { status: 'not_decidable' };

      const [revision] = await tx
        .select()
        .from(tutorApplicationV2Revisions)
        .where(
          and(
            eq(tutorApplicationV2Revisions.applicationId, application.id),
            eq(tutorApplicationV2Revisions.revisionNumber, application.currentRevisionNumber),
          ),
        )
        .limit(1);
      if (!revision) return { status: 'not_decidable' };

      const snapshot = revision.snapshot as ApplicationV2SubmissionSnapshot;
      const answers = snapshot.answers;
      // A minor must have a previously verified consent reference bound to the
      // exact submitted revision, never a mutable checkbox from an applicant.
      const age = applicantAge(answers.about.dateOfBirth, now.toISOString().slice(0, 10));
      if (age === null || age < 16) return { status: 'guardian_consent_missing' };
      if (age < 18 && !revision.guardianConsentReference) {
        return { status: 'guardian_consent_missing' };
      }

      const [rule] = await tx
        .select({ value: ruleSettings.value })
        .from(ruleSettings)
        .where(
          and(
            eq(ruleSettings.settingKey, TUTOR_APPLICATION_RULE_KEYS.requiredChecks),
            eq(ruleSettings.statusCode, 'current'),
          ),
        )
        .limit(1);
      const required = requiredChecksFrom(rule?.value);
      const recorded = await tx
        .select({
          code: tutorApplicationChecks.checkCode,
          status: tutorApplicationChecks.statusCode,
        })
        .from(tutorApplicationChecks)
        .where(eq(tutorApplicationChecks.applicationId, application.id));
      const readiness = approvalReadiness(recorded, required);
      if (!readiness.ready) {
        return {
          status: 'checks_incomplete',
          missing: readiness.missing,
          failed: readiness.failed,
        };
      }
      // All four checks, even if an administrator config later relaxes the
      // general requirement, are mandatory for v2 child-safeguarding review.
      const strict = approvalReadiness(recorded, APPLICATION_CHECK_CODES);
      if (!strict.ready) {
        return {
          status: 'checks_incomplete',
          missing: strict.missing,
          failed: strict.failed,
        };
      }

      const [existing] = await tx
        .select({ id: tutorProfiles.id })
        .from(tutorProfiles)
        .where(eq(tutorProfiles.userId, application.applicantUserId))
        .limit(1);
      if (existing) return { status: 'profile_exists' };

      const levels = answers.subjects.selections.flatMap((item) => item.levels);
      if (levels.length === 0) return { status: 'not_decidable' };

      const [profile] = await tx
        .insert(tutorProfiles)
        .values({
          userId: application.applicantUserId,
          publicFirstName: answers.about.preferredFirstName,
          headline: null,
          teachingApproach: answers.teaching.approach,
          statusCode: 'approved',
          visibilityStateCode: 'unlisted',
          sourceTypeCode: 'tutor_application',
          yearLevelFrom: Math.min(...levels),
          yearLevelTo: Math.max(...levels),
          offersOnline: answers.subjects.offersOnline,
          offersInPerson: answers.subjects.offersInPerson,
          availabilityLabelCode: 'accepting_new',
          isNewToStuddy: true,
        })
        .returning({ id: tutorProfiles.id, reference: tutorProfiles.reference });
      if (!profile) throw new Error('v2 approval profile insert returned no row');

      for (const code of required) {
        const label = publicLabelForCheck(code);
        if (!label) continue;
        await tx
          .insert(tutorVerifications)
          .values({
            tutorProfileId: profile.id,
            labelCode: label,
            verifiedAt: now,
            statusCode: 'active',
          })
          .onConflictDoNothing();
      }

      const [role] = await tx
        .select({ id: roleDefinitions.id })
        .from(roleDefinitions)
        .where(eq(roleDefinitions.code, 'tutor'))
        .limit(1);
      if (!role) throw new Error('Missing tutor role definition');

      const [activated] = await tx
        .update(userRoleAssignments)
        .set({
          statusCode: 'active',
          workspaceEnabled: true,
          assignmentReasonCode: 'tutor_application_approved',
          assignedByUserId: input.actorUserId,
          updatedAt: now,
        })
        .where(
          and(
            eq(userRoleAssignments.userId, application.applicantUserId),
            eq(userRoleAssignments.roleDefinitionId, role.id),
            eq(userRoleAssignments.statusCode, 'pending'),
          ),
        )
        .returning({ id: userRoleAssignments.id });
      let assignmentId = activated?.id;
      if (!assignmentId) {
        const [created] = await tx
          .insert(userRoleAssignments)
          .values({
            userId: application.applicantUserId,
            roleDefinitionId: role.id,
            statusCode: 'active',
            workspaceEnabled: true,
            assignmentReasonCode: 'tutor_application_approved',
            assignedByUserId: input.actorUserId,
          })
          .returning({ id: userRoleAssignments.id });
        assignmentId = created?.id;
      }
      if (assignmentId) {
        await tx.insert(statusTransitions).values({
          entityType: 'identity.user_role_assignments',
          entityId: assignmentId,
          fromStatusCode: activated ? 'pending' : null,
          toStatusCode: 'active',
          actorUserId: input.actorUserId,
          reasonCode: 'tutor_application_approved',
          correlationId: input.correlationId,
          occurredAt: now,
        });
      }

      const [moved] = await tx
        .update(tutorApplications)
        .set({
          statusCode: 'approved',
          decidedAt: now,
          decidedByUserId: input.actorUserId,
          approvedRevisionNumber: application.currentRevisionNumber,
          tutorProfileId: profile.id,
          applicantMessage: null,
          draft: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(tutorApplications.id, application.id),
            inArray(tutorApplications.statusCode, [...DECIDABLE_APPLICATION_STATUSES]),
          ),
        )
        .returning({ id: tutorApplications.id });
      if (!moved) throw new Error('v2 application changed during approval');
      await tx.insert(statusTransitions).values({
        entityType: 'tutor_application',
        entityId: application.id,
        fromStatusCode: application.statusCode,
        toStatusCode: 'approved',
        actorUserId: input.actorUserId,
        reasonCode: 'application_approved',
        correlationId: input.correlationId,
        occurredAt: now,
      });
      await tx.insert(auditEvents).values({
        category: 'sensitive_access',
        action: 'tutor_application.v2_approved',
        entityType: 'tutor_application',
        entityId: application.id,
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        occurredAt: now,
        newValue: {
          revisionNumber: application.currentRevisionNumber,
          tutorProfileId: profile.id,
          requiredChecks: [...required],
          schemaVersion: 2,
        },
        riskLevel: 'high',
      });
      await tx.insert(domainEvents).values({
        eventType: 'tutor.v2_approved',
        entityType: 'tutor_application',
        entityId: application.id,
        payload: {
          applicationId: application.id,
          tutorProfileId: profile.id,
          revisionNumber: application.currentRevisionNumber,
          schemaVersion: 2,
        },
        correlationId: input.correlationId,
        occurredAt: now,
      });

      // No v1 email outbox here: the existing template joins the v1 revision.
      // A v2-specific renderer is required before the release flag is enabled.
      return {
        status: 'approved',
        tutorProfileId: profile.id,
        tutorReference: profile.reference,
      };
    });
  } finally {
    await client.end();
  }
}
