import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { createDatabaseClient } from '../client';
import {
  auditEvents,
  authIdentityLinks,
  domainEvents,
  outboxEntries,
  roleDefinitions,
  statusTransitions,
  userPreferences,
  userRoleAssignments,
  users,
} from '../schema/index';

/**
 * Identity repository — the database implementation behind the domain's
 * identity contracts (Blueprint §14). Server-only.
 *
 * Consequential commands write the business change, audit event, status
 * transition (governed transitions only), domain event and outbox entry in
 * ONE transaction (ADR-0004).
 */

export interface IdentityRoleAssignmentRecord {
  readonly id: string;
  readonly roleCode: string;
  readonly statusCode: string;
  readonly workspaceEnabled: boolean;
  readonly scopeType: string | null;
  readonly scopeId: string | null;
}

export interface IdentityResolutionRecord {
  readonly studdyUserId: string;
  readonly displayName: string;
  readonly preferredName: string | null;
  readonly created: boolean;
  /** Active assignments only. */
  readonly roleAssignments: readonly IdentityRoleAssignmentRecord[];
  /** Pending assignments (e.g. tutor application registered). */
  readonly pendingRoleCodes: readonly string[];
  readonly lastActiveWorkspaceCode: string | null;
  /** True when ANY assignment exists (active, pending or suspended). */
  readonly hasAnyRoleAssignment: boolean;
}

export interface EnsureIdentityInput {
  readonly authUserId: string;
  readonly authenticationEmail: string;
  readonly fallbackDisplayName: string;
  readonly countryCode: string;
  readonly timeZone: string;
  readonly locale: string;
}

export async function ensureIdentityForAuthUser(
  input: EnsureIdentityInput,
): Promise<IdentityResolutionRecord> {
  const { sql, db } = createDatabaseClient();
  try {
    const [link] = await db
      .select()
      .from(authIdentityLinks)
      .where(eq(authIdentityLinks.providerSubjectId, input.authUserId));

    let studdyUserId: string;
    let displayName: string;
    let preferredName: string | null = null;
    let created = false;

    if (link !== undefined) {
      studdyUserId = link.userId;
      const [record] = await db.select().from(users).where(eq(users.id, link.userId));
      displayName = record?.displayName ?? 'Studdy user';
      preferredName = record?.preferredName ?? null;
    } else {
      const correlationId = `cor_${randomUUID()}`;
      const result = await db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(users)
          .values({
            displayName: input.fallbackDisplayName,
            countryCode: input.countryCode,
            timeZone: input.timeZone,
            locale: input.locale,
          })
          .returning({ id: users.id });
        if (inserted === undefined) throw new Error('identity.users insert returned no row');
        await tx.insert(authIdentityLinks).values({
          userId: inserted.id,
          providerSubjectId: input.authUserId,
          authenticationEmail: input.authenticationEmail,
        });
        await tx.insert(auditEvents).values({
          category: 'security',
          action: 'identity.user_created_and_linked',
          entityType: 'identity.users',
          entityId: inserted.id,
          actorUserId: inserted.id,
          correlationId,
          occurredAt: new Date(),
          riskLevel: 'low',
        });
        return inserted.id;
      });
      studdyUserId = result;
      displayName = input.fallbackDisplayName;
      created = true;
    }

    const assignments = await db
      .select({
        id: userRoleAssignments.id,
        statusCode: userRoleAssignments.statusCode,
        workspaceEnabled: userRoleAssignments.workspaceEnabled,
        scopeType: userRoleAssignments.scopeType,
        scopeId: userRoleAssignments.scopeId,
        roleCode: roleDefinitions.code,
      })
      .from(userRoleAssignments)
      .innerJoin(roleDefinitions, eq(userRoleAssignments.roleDefinitionId, roleDefinitions.id))
      .where(eq(userRoleAssignments.userId, studdyUserId));

    const [preferences] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, studdyUserId));

    return {
      studdyUserId,
      displayName,
      preferredName,
      created,
      roleAssignments: assignments
        .filter((assignment) => assignment.statusCode === 'active')
        .map((assignment) => ({ ...assignment })),
      pendingRoleCodes: assignments
        .filter((assignment) => assignment.statusCode === 'pending')
        .map((assignment) => assignment.roleCode),
      lastActiveWorkspaceCode: preferences?.lastActiveWorkspaceCode ?? null,
      hasAnyRoleAssignment: assignments.length > 0,
    };
  } finally {
    await sql.end();
  }
}

export interface CompleteAccountSetupInput {
  readonly studdyUserId: string;
  readonly roleCode: string;
  readonly assignmentStatusCode: 'active' | 'pending';
  readonly workspaceEnabled: boolean;
  readonly preferredName: string;
  readonly familyName: string;
  readonly assignmentReasonCode: string;
  readonly correlationId: string;
}

/**
 * Complete /welcome account setup: names + one self-serve role assignment.
 * Transactional and idempotent — a live assignment of the same role is
 * returned unchanged. Manager/owner role codes are refused defensively here
 * as well as in domain validation.
 */
export async function completeAccountSetup(input: CompleteAccountSetupInput): Promise<{
  assignmentId: string;
  alreadyExisted: boolean;
}> {
  if (!['parent_guardian', 'independent_student', 'tutor'].includes(input.roleCode)) {
    throw new Error(`completeAccountSetup refused role code: ${input.roleCode}`);
  }
  const { sql, db } = createDatabaseClient();
  try {
    return await db.transaction(async (tx) => {
      const [role] = await tx
        .select()
        .from(roleDefinitions)
        .where(eq(roleDefinitions.code, input.roleCode));
      if (role === undefined) throw new Error(`Unknown role definition: ${input.roleCode}`);

      const [existing] = await tx
        .select({ id: userRoleAssignments.id })
        .from(userRoleAssignments)
        .where(
          and(
            eq(userRoleAssignments.userId, input.studdyUserId),
            eq(userRoleAssignments.roleDefinitionId, role.id),
            inArray(userRoleAssignments.statusCode, ['active', 'pending']),
          ),
        );

      await tx
        .update(users)
        .set({
          preferredName: input.preferredName,
          familyName: input.familyName,
          displayName: input.preferredName,
          updatedAt: new Date(),
        })
        .where(eq(users.id, input.studdyUserId));

      if (existing !== undefined) {
        return { assignmentId: existing.id, alreadyExisted: true };
      }

      const [assignment] = await tx
        .insert(userRoleAssignments)
        .values({
          userId: input.studdyUserId,
          roleDefinitionId: role.id,
          statusCode: input.assignmentStatusCode,
          workspaceEnabled: input.workspaceEnabled,
          assignmentReasonCode: input.assignmentReasonCode,
          assignedByUserId: input.studdyUserId,
        })
        .returning({ id: userRoleAssignments.id });
      if (assignment === undefined) throw new Error('role assignment insert returned no row');

      const occurredAt = new Date();

      await tx.insert(auditEvents).values({
        category: 'business',
        action: 'identity.account_setup_completed',
        entityType: 'identity.user_role_assignments',
        entityId: assignment.id,
        actorUserId: input.studdyUserId,
        correlationId: input.correlationId,
        occurredAt,
        newValue: {
          roleCode: input.roleCode,
          statusCode: input.assignmentStatusCode,
          assignmentReasonCode: input.assignmentReasonCode,
        },
        riskLevel: 'low',
      });

      // Governed transition: a role assignment coming into existence.
      await tx.insert(statusTransitions).values({
        entityType: 'identity.user_role_assignments',
        entityId: assignment.id,
        fromStatusCode: null,
        toStatusCode: input.assignmentStatusCode,
        actorUserId: input.studdyUserId,
        reasonCode: input.assignmentReasonCode,
        correlationId: input.correlationId,
        occurredAt,
      });

      const eventType =
        input.roleCode === 'tutor'
          ? 'identity.tutor_interest_registered'
          : 'identity.role_assigned';
      await tx.insert(domainEvents).values({
        eventType,
        entityType: 'identity.user_role_assignments',
        entityId: assignment.id,
        payload: {
          userId: input.studdyUserId,
          roleCode: input.roleCode,
          statusCode: input.assignmentStatusCode,
        },
        correlationId: input.correlationId,
        occurredAt,
      });
      await tx.insert(outboxEntries).values({
        eventType,
        payload: {
          userId: input.studdyUserId,
          roleCode: input.roleCode,
          statusCode: input.assignmentStatusCode,
        },
        idempotencyKey: `${eventType}:${assignment.id}`,
        correlationId: input.correlationId,
      });

      return { assignmentId: assignment.id, alreadyExisted: false };
    });
  } finally {
    await sql.end();
  }
}

/** Persist the last active workspace (chooser choice or workspace entry). */
export async function setLastActiveWorkspace(
  studdyUserId: string,
  workspaceCode: string,
  correlationId: string,
): Promise<void> {
  const { sql, db } = createDatabaseClient();
  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(userPreferences)
        .values({ userId: studdyUserId, lastActiveWorkspaceCode: workspaceCode })
        .onConflictDoUpdate({
          target: userPreferences.userId,
          set: { lastActiveWorkspaceCode: workspaceCode, updatedAt: new Date() },
        });
      await tx.insert(auditEvents).values({
        category: 'business',
        action: 'identity.workspace_switched',
        entityType: 'identity.user_preferences',
        entityId: studdyUserId,
        actorUserId: studdyUserId,
        correlationId,
        occurredAt: new Date(),
        newValue: { lastActiveWorkspaceCode: workspaceCode },
        riskLevel: 'low',
      });
    });
  } finally {
    await sql.end();
  }
}

/**
 * Best-effort security audit for authentication events (sign-in, reset
 * request, MFA enrolment). Never records passwords, tokens or provider
 * payloads. Failures are swallowed — authentication must not depend on the
 * audit database being reachable.
 */
export async function recordAuthAuditEvent(input: {
  action: string;
  studdyUserId: string | null;
  correlationId: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { sql, db } = createDatabaseClient();
    try {
      await db.insert(auditEvents).values({
        category: 'security',
        action: input.action,
        entityType: 'identity.users',
        entityId: input.studdyUserId,
        actorUserId: input.studdyUserId,
        correlationId: input.correlationId,
        occurredAt: new Date(),
        ...(input.detail === undefined ? {} : { newValue: input.detail }),
        riskLevel: 'low',
      });
    } finally {
      await sql.end();
    }
  } catch {
    // Best-effort by design.
  }
}
