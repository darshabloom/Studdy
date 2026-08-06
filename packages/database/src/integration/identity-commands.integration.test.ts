import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDatabaseClient } from '../client';
import { completeAccountSetup, setLastActiveWorkspace } from '../repositories/identity';
import {
  auditEvents,
  domainEvents,
  outboxEntries,
  statusTransitions,
  userPreferences,
  userRoleAssignments,
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

async function createTestUser(): Promise<string> {
  const { sql, db } = createDatabaseClient();
  try {
    const [user] = await db
      .insert(users)
      .values({
        displayName: 'Command Test User',
        countryCode: 'NZ',
        timeZone: 'Pacific/Auckland',
        locale: 'en-NZ',
      })
      .returning({ id: users.id });
    if (user === undefined) throw new Error('insert failed');
    return user.id;
  } finally {
    await sql.end();
  }
}

describe.skipIf(!available)('completeAccountSetup (integration)', () => {
  it('writes assignment + audit + governed transition + domain event + outbox in one transaction', async () => {
    const userId = await createTestUser();
    const correlationId = `cor_${randomUUID()}`;
    const result = await completeAccountSetup({
      studdyUserId: userId,
      roleCode: 'parent_guardian',
      assignmentStatusCode: 'active',
      workspaceEnabled: true,
      preferredName: 'Test',
      familyName: 'Parent',
      assignmentReasonCode: 'self_registration',
      correlationId,
    });
    expect(result.alreadyExisted).toBe(false);

    const { sql, db } = createDatabaseClient();
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      expect(user?.preferredName).toBe('Test');
      expect(user?.familyName).toBe('Parent');

      const audits = await db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.correlationId, correlationId));
      expect(audits).toHaveLength(1);
      expect(audits[0]?.action).toBe('identity.account_setup_completed');

      const transitions = await db
        .select()
        .from(statusTransitions)
        .where(eq(statusTransitions.correlationId, correlationId));
      expect(transitions).toHaveLength(1);
      expect(transitions[0]?.toStatusCode).toBe('active');

      const events = await db
        .select()
        .from(domainEvents)
        .where(eq(domainEvents.correlationId, correlationId));
      expect(events).toHaveLength(1);
      expect(events[0]?.eventType).toBe('identity.role_assigned');

      const outbox = await db
        .select()
        .from(outboxEntries)
        .where(eq(outboxEntries.correlationId, correlationId));
      expect(outbox).toHaveLength(1);
      expect(outbox[0]?.idempotencyKey).toBe(`identity.role_assigned:${result.assignmentId}`);
    } finally {
      await sql.end();
    }
  });

  it('is idempotent — repeating the command does not duplicate the assignment', async () => {
    const userId = await createTestUser();
    const input = {
      studdyUserId: userId,
      roleCode: 'independent_student',
      assignmentStatusCode: 'active' as const,
      workspaceEnabled: true,
      preferredName: 'Solo',
      familyName: 'Student',
      assignmentReasonCode: 'self_declared_18_plus',
      correlationId: `cor_${randomUUID()}`,
    };
    const first = await completeAccountSetup(input);
    const second = await completeAccountSetup({ ...input, correlationId: `cor_${randomUUID()}` });
    expect(first.alreadyExisted).toBe(false);
    expect(second.alreadyExisted).toBe(true);
    expect(second.assignmentId).toBe(first.assignmentId);

    const { sql, db } = createDatabaseClient();
    try {
      const rows = await db
        .select()
        .from(userRoleAssignments)
        .where(eq(userRoleAssignments.userId, userId));
      expect(rows).toHaveLength(1);
    } finally {
      await sql.end();
    }
  });

  it('pending tutor assignments never enable a workspace', async () => {
    const userId = await createTestUser();
    await completeAccountSetup({
      studdyUserId: userId,
      roleCode: 'tutor',
      assignmentStatusCode: 'pending',
      workspaceEnabled: false,
      preferredName: 'Pending',
      familyName: 'Tutor',
      assignmentReasonCode: 'self_registration_pending_application',
      correlationId: `cor_${randomUUID()}`,
    });
    const { sql, db } = createDatabaseClient();
    try {
      const rows = await db
        .select()
        .from(userRoleAssignments)
        .where(eq(userRoleAssignments.userId, userId));
      expect(rows[0]?.statusCode).toBe('pending');
      expect(rows[0]?.workspaceEnabled).toBe(false);
    } finally {
      await sql.end();
    }
  });

  it('refuses manager and owner role codes outright', async () => {
    const userId = await createTestUser();
    for (const roleCode of ['platform_manager', 'platform_owner']) {
      await expect(
        completeAccountSetup({
          studdyUserId: userId,
          roleCode,
          assignmentStatusCode: 'active',
          workspaceEnabled: true,
          preferredName: 'X',
          familyName: 'Y',
          assignmentReasonCode: 'x',
          correlationId: `cor_${randomUUID()}`,
        }),
      ).rejects.toThrow(/refused role code/);
    }
  });
});

describe.skipIf(!available)('setLastActiveWorkspace (integration)', () => {
  it('upserts the preference and audit-logs the switch', async () => {
    const userId = await createTestUser();
    await setLastActiveWorkspace(userId, 'parent', `cor_${randomUUID()}`);
    await setLastActiveWorkspace(userId, 'tutor', `cor_${randomUUID()}`);
    const { sql, db } = createDatabaseClient();
    try {
      const [preference] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId));
      expect(preference?.lastActiveWorkspaceCode).toBe('tutor');
    } finally {
      await sql.end();
    }
  });
});
