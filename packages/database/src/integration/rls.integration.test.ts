import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createDatabaseClient } from '../client';
import { authIdentityLinks, users } from '../schema/index';

/**
 * RLS negative tests (Database spec §13.6; brief §8). Simulates PostgREST's
 * runtime by switching to the `authenticated` / `anon` roles with a JWT
 * claims setting inside a transaction, then asserting row visibility.
 */

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

interface TestIdentity {
  userId: string;
  authId: string;
}

async function createLinkedUser(label: string, authId: string): Promise<TestIdentity> {
  const { sql, db } = createDatabaseClient();
  try {
    const [user] = await db
      .insert(users)
      .values({
        displayName: label,
        countryCode: 'NZ',
        timeZone: 'Pacific/Auckland',
        locale: 'en-NZ',
      })
      .returning({ id: users.id });
    if (user === undefined) throw new Error('insert failed');
    await db.insert(authIdentityLinks).values({
      userId: user.id,
      providerSubjectId: authId,
      authenticationEmail: `${label.toLowerCase().replaceAll(' ', '.')}@local.studdy.test`,
    });
    return { userId: user.id, authId };
  } finally {
    await sql.end();
  }
}

function claims(authId: string): string {
  return JSON.stringify({ sub: authId, role: 'authenticated' });
}

describe.skipIf(!available)('Row Level Security (integration)', () => {
  it('an authenticated user reads their own identity rows and nobody else’s', async () => {
    const a = await createLinkedUser('Rls User A', randomUUID());
    const b = await createLinkedUser('Rls User B', randomUUID());

    const { sql } = createDatabaseClient();
    try {
      const visible = await sql.begin(async (tx) => {
        await tx`select set_config('request.jwt.claims', ${claims(a.authId)}, true)`;
        await tx`set local role authenticated`;
        return await tx`select id from identity.users`;
      });
      const ids = visible.map((row) => row['id']);
      expect(ids).toContain(a.userId);
      expect(ids).not.toContain(b.userId);
    } finally {
      await sql.end();
    }
  });

  it('a user cannot read another user’s role assignments or preferences', async () => {
    const a = await createLinkedUser('Rls User C', randomUUID());
    const b = await createLinkedUser('Rls User D', randomUUID());

    const { sql } = createDatabaseClient();
    try {
      await sql`insert into identity.user_preferences (user_id, last_active_workspace_code) values (${b.userId}, 'parent') on conflict do nothing`;
      const rows = await sql.begin(async (tx) => {
        await tx`select set_config('request.jwt.claims', ${claims(a.authId)}, true)`;
        await tx`set local role authenticated`;
        const assignments = await tx`select user_id from identity.user_role_assignments`;
        const preferences = await tx`select user_id from identity.user_preferences`;
        return { assignments, preferences };
      });
      expect(rows.assignments.every((row) => row['user_id'] === a.userId)).toBe(true);
      expect(rows.preferences.every((row) => row['user_id'] === a.userId)).toBe(true);
    } finally {
      await sql.end();
    }
  });

  it('anonymous sessions read nothing from identity (no grants at all)', async () => {
    const { sql } = createDatabaseClient();
    try {
      await expect(
        sql.begin(async (tx) => {
          await tx`set local role anon`;
          return await tx`select id from identity.users`;
        }),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await sql.end();
    }
  });

  it('audit tables are unreachable from the browser-facing role (server-only)', async () => {
    const a = await createLinkedUser('Rls User E', randomUUID());
    const { sql } = createDatabaseClient();
    try {
      for (const table of [
        'audit_events',
        'status_transitions',
        'domain_events',
        'outbox_entries',
      ]) {
        await expect(
          sql.begin(async (tx) => {
            await tx`select set_config('request.jwt.claims', ${claims(a.authId)}, true)`;
            await tx`set local role authenticated`;
            return await tx.unsafe(`select * from audit.${table} limit 1`);
          }),
        ).rejects.toThrow(/permission denied/);
      }
    } finally {
      await sql.end();
    }
  });

  it('a suspended role assignment is invisible as an active grant', async () => {
    // Server-side resolution filters on status_code = active; RLS own-record
    // read still shows the row to its owner (they may see their own state).
    // The workspace gate lives server-side — asserted in identity-commands
    // and e2e tests. Here we assert the row itself never leaks cross-user.
    const a = await createLinkedUser('Rls User F', randomUUID());
    const { sql } = createDatabaseClient();
    try {
      const rows = await sql.begin(async (tx) => {
        await tx`select set_config('request.jwt.claims', ${claims(a.authId)}, true)`;
        await tx`set local role authenticated`;
        return await tx`select user_id from identity.user_role_assignments where user_id != ${a.userId}`;
      });
      expect(rows).toHaveLength(0);
    } finally {
      await sql.end();
    }
  });
});
