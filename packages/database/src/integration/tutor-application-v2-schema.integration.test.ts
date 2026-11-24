import { describe, expect, it } from 'vitest';
import { createDatabaseClient } from '../client';

/**
 * Migration and access-control smoke tests for the v2 submission table.
 * No real applications are created and no personal information is logged.
 */
async function databaseAvailable(): Promise<boolean> {
  const { sql } = createDatabaseClient();
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await sql.end();
  }
}

const available = await databaseAvailable();

describe.skipIf(!available)('Tutor Application v2 schema security', () => {
  it('creates a separate append-only revision table with RLS enabled', async () => {
    const { sql } = createDatabaseClient();
    try {
      const [row] = await sql`
        select
          c.relrowsecurity as rls_enabled,
          exists (
            select 1 from pg_trigger t
            where t.tgrelid = c.oid
              and t.tgname = 'tutor_application_v2_revisions_immutable'
              and not t.tgisinternal
          ) as immutable_trigger
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'tutors'
          and c.relname = 'tutor_application_v2_revisions'
      `;
      expect(row).toMatchObject({ rls_enabled: true, immutable_trigger: true });
    } finally {
      await sql.end();
    }
  });

  it('denies both anonymous and authenticated browser table privileges', async () => {
    const { sql } = createDatabaseClient();
    try {
      const [row] = await sql`
        select
          has_table_privilege(
            'anon', 'tutors.tutor_application_v2_revisions', 'SELECT'
          ) as anon_can_read,
          has_table_privilege(
            'authenticated', 'tutors.tutor_application_v2_revisions', 'SELECT'
          ) as authenticated_can_read,
          has_table_privilege(
            'authenticated', 'tutors.tutor_application_v2_revisions', 'INSERT'
          ) as authenticated_can_write
      `;
      expect(row).toMatchObject({
        anon_can_read: false,
        authenticated_can_read: false,
        authenticated_can_write: false,
      });
    } finally {
      await sql.end();
    }
  });
});
