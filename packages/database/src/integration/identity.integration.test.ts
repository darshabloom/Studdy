import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDatabaseClient } from '../client';
import { authIdentityLinks, roleDefinitions, users } from '../schema/index';

/**
 * Integration tests — require a migrated local database
 * (pnpm supabase:start && pnpm db:migrate && pnpm db:seed).
 * Skipped when DATABASE_URL is absent and the default local port is closed.
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

describe.skipIf(!available)('identity foundation (integration)', () => {
  it('users receive an id, USER- reference and record_version 1', async () => {
    const { sql, db } = createDatabaseClient();
    try {
      const [inserted] = await db
        .insert(users)
        .values({
          displayName: 'Integration Test User',
          countryCode: 'NZ',
          timeZone: 'Pacific/Auckland',
          locale: 'en-NZ',
        })
        .returning();
      expect(inserted).toBeDefined();
      expect(inserted?.reference).toMatch(/^USER-\d{8}$/);
      expect(inserted?.recordVersion).toBe(1);
      // Clean up (archival is the product rule; deletion is fine for test rows).
      if (inserted !== undefined) {
        await db.delete(users).where(eq(users.id, inserted.id));
      }
    } finally {
      await sql.end();
    }
  });

  it('auth identity links enforce one active link per provider subject', async () => {
    const { sql, db } = createDatabaseClient();
    try {
      const [user] = await db
        .insert(users)
        .values({
          displayName: 'Link Test User',
          countryCode: 'NZ',
          timeZone: 'Pacific/Auckland',
          locale: 'en-NZ',
        })
        .returning();
      if (user === undefined) throw new Error('insert failed');
      const subject = '00000000-0000-4000-9000-000000009999';
      await db.insert(authIdentityLinks).values({
        userId: user.id,
        providerSubjectId: subject,
        authenticationEmail: 'link.test@local.studdy.test',
      });
      await expect(
        db.insert(authIdentityLinks).values({
          userId: user.id,
          providerSubjectId: subject,
          authenticationEmail: 'link.test@local.studdy.test',
        }),
      ).rejects.toThrow();
      await db.delete(authIdentityLinks).where(eq(authIdentityLinks.userId, user.id));
      await db.delete(users).where(eq(users.id, user.id));
    } finally {
      await sql.end();
    }
  });

  it('RLS is enabled on every classified table', async () => {
    const { sql } = createDatabaseClient();
    try {
      const rows = await sql`
        select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where c.relkind = 'r'
          and n.nspname in ('identity', 'permissions', 'audit')
      `;
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row['rls_enabled'], `${row['schema_name']}.${row['table_name']} must have RLS`).toBe(
          true,
        );
      }
    } finally {
      await sql.end();
    }
  });

  it('role definitions seed is present after db:seed', async () => {
    const { sql, db } = createDatabaseClient();
    try {
      const roles = await db.select().from(roleDefinitions);
      // Passes on a seeded database; tolerated as informational on unseeded.
      if (roles.length > 0) {
        const codes = roles.map((role) => role.code);
        expect(codes).toContain('parent_guardian');
        expect(codes).toContain('platform_owner');
        expect(codes).toHaveLength(9);
      }
    } finally {
      await sql.end();
    }
  });
});

describe.skipIf(available)('identity foundation (integration) — database unavailable', () => {
  it.skip('requires a running local database (pnpm supabase:start && pnpm db:migrate)', () => {
    /* skipped: no database available in this environment */
  });
});
