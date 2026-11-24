import { and, eq, inArray } from 'drizzle-orm';
import {
  DECIDABLE_APPLICATION_STATUSES,
  type ApplicationV2SubmissionSnapshot,
} from '@studdy/domain/tutors';
import { createDatabaseClient } from '../client';
import {
  auditEvents,
  domainEvents,
  outboxEntries,
  roleDefinitions,
  statusTransitions,
  tutorApplicationV2Revisions,
  tutorApplications,
  userRoleAssignments,
} from '../schema/index';

export type V2DecisionResult = {
  readonly status: 'done' | 'not_found' | 'not_decidable' | 'invalid';
};

export async function decideApplicationV2(input: {
  readonly reference: string;
  readonly decision: 'changes_requested' | 'rejected';
  readonly message: string;
  readonly actorUserId: string;
  readonly correlationId: string;
  readonly now?: Date;
}): Promise<V2DecisionResult> {
  if (input.message.trim().length === 0 || input.message.length > 1000) {
    return { status: 'invalid' };
  }
  const now = input.now ?? new Date();
  const { sql: client, db } = createDatabaseClient();
  try {
    return await db.transaction(async (tx): Promise<V2DecisionResult> => {
      const [app] = await tx
        .select()
        .from(tutorApplications)
        .where(eq(tutorApplications.reference, input.reference))
        .limit(1)
        .for('update');
      if (!app) return { status: 'not_found' };
      if (!(DECIDABLE_APPLICATION_STATUSES as readonly string[]).includes(app.statusCode)) {
        return { status: 'not_decidable' };
      }
      const [revision] = await tx
        .select()
        .from(tutorApplicationV2Revisions)
        .where(
          and(
            eq(tutorApplicationV2Revisions.applicationId, app.id),
            eq(tutorApplicationV2Revisions.revisionNumber, app.currentRevisionNumber),
          ),
        )
        .limit(1);
      if (!revision) return { status: 'not_decidable' };
      const snapshot = revision.snapshot as ApplicationV2SubmissionSnapshot;

      // Restore a detached copy of the exact prior v2 answers. Every required
      // declaration must be accepted again when a revised draft is submitted.
      const restored = structuredClone(snapshot.answers);
      const draft =
        input.decision === 'changes_requested'
          ? {
              ...restored,
              declarations: {
                accuracyAccepted: false,
                safeguardingAccepted: false,
                codeOfConductAccepted: false,
                tutorAgreementAccepted: false,
                privacyNoticeAccepted: false,
                interviewAccepted: false,
              },
            }
          : null;

      const [moved] = await tx
        .update(tutorApplications)
        .set({
          statusCode: input.decision,
          applicantMessage: input.message.trim(),
          decidedAt: now,
          decidedByUserId: input.actorUserId,
          draft,
          recordVersion: app.recordVersion + 1,
          updatedAt: now,
        })
        .where(
          and(
            eq(tutorApplications.id, app.id),
            inArray(tutorApplications.statusCode, [...DECIDABLE_APPLICATION_STATUSES]),
          ),
        )
        .returning({ id: tutorApplications.id });
      if (!moved) throw new Error('The v2 application changed during the decision');

      if (input.decision === 'rejected') {
        const [role] = await tx
          .select({ id: roleDefinitions.id })
          .from(roleDefinitions)
          .where(eq(roleDefinitions.code, 'tutor'))
          .limit(1);
        if (!role) throw new Error('Tutor role definition missing');
        const [ended] = await tx
          .update(userRoleAssignments)
          .set({
            statusCode: 'ended',
            workspaceEnabled: false,
            effectiveUntil: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(userRoleAssignments.userId, app.applicantUserId),
              eq(userRoleAssignments.roleDefinitionId, role.id),
              eq(userRoleAssignments.statusCode, 'pending'),
            ),
          )
          .returning({ id: userRoleAssignments.id });
        if (ended) {
          await tx.insert(statusTransitions).values({
            entityType: 'identity.user_role_assignments',
            entityId: ended.id,
            fromStatusCode: 'pending',
            toStatusCode: 'ended',
            actorUserId: input.actorUserId,
            reasonCode: 'tutor_application_rejected',
            correlationId: input.correlationId,
            occurredAt: now,
          });
        }
      }

      await tx.insert(statusTransitions).values({
        entityType: 'tutor_application',
        entityId: app.id,
        fromStatusCode: app.statusCode,
        toStatusCode: input.decision,
        actorUserId: input.actorUserId,
        reasonCode: input.decision === 'rejected' ? 'application_rejected' : 'changes_requested',
        correlationId: input.correlationId,
        occurredAt: now,
      });
      await tx.insert(auditEvents).values({
        category: 'sensitive_access',
        action: `tutor_application.v2_${input.decision}`,
        entityType: 'tutor_application',
        entityId: app.id,
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        occurredAt: now,
        newValue: { revisionNumber: app.currentRevisionNumber, schemaVersion: 2 },
        riskLevel: 'high',
      });
      await tx.insert(domainEvents).values({
        eventType: `tutor_application.v2_${input.decision}`,
        entityType: 'tutor_application',
        entityId: app.id,
        payload: {
          applicationId: app.id,
          revisionNumber: app.currentRevisionNumber,
          schemaVersion: 2,
        },
        correlationId: input.correlationId,
        occurredAt: now,
      });
      await tx.insert(outboxEntries).values({
        eventType: `tutor_application.${input.decision}`,
        payload: {
          applicationId: app.id,
          revisionNumber: app.currentRevisionNumber,
          schemaVersion: 2,
        },
        idempotencyKey: `tutor_application.${input.decision}:v2:${app.id}:${app.currentRevisionNumber}`,
        correlationId: input.correlationId,
      });
      return { status: 'done' };
    });
  } finally {
    await client.end();
  }
}
