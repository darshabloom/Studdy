import { assertDestructiveCommandAllowed } from '@studdy/configuration';
import { createDatabaseClient } from './client';

/**
 * Local database reset. Drops the application schemas and the migration
 * journal, then exits — run `pnpm db:migrate && pnpm db:seed` afterwards.
 *
 * Guarded: refuses to run outside STUDDY_ENVIRONMENT=local (brief §11 — a
 * reset must never casually run against shared environments).
 */
const APPLICATION_SCHEMAS = [
  'identity',
  'families',
  'students',
  'tutors',
  'organisations',
  'services',
  'availability',
  'bookings',
  'payments',
  'lessons',
  'learning',
  'resources',
  'communications',
  'support',
  'permissions',
  'platform',
  'audit',
  'integration',
  'migration',
  'drizzle',
];

async function main(): Promise<void> {
  assertDestructiveCommandAllowed('db:reset');
  const { sql } = createDatabaseClient();
  try {
    for (const schema of APPLICATION_SCHEMAS) {
      await sql.unsafe(`drop schema if exists "${schema}" cascade`);
      console.log(`dropped schema ${schema}`);
    }
    console.log('reset complete — run pnpm db:migrate && pnpm db:seed');
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
