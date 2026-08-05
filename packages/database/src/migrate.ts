import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDatabaseClient } from './client';

/**
 * Migration runner (Blueprint §16; Database spec).
 *
 * Order:
 *  1. reviewed-sql/pre     — extensions, named schemas, global reference sequence
 *  2. migrations/generated — Drizzle-generated schema migrations (journalled)
 *  3. reviewed-sql/{rls,functions,triggers,constraints,transformations}
 *
 * Reviewed SQL files are tracked in drizzle.reviewed_sql_migrations and are
 * immutable once applied to a shared environment — corrections are new files.
 */
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const reviewedRoot = join(packageRoot, 'migrations', 'reviewed-sql');
const REVIEWED_PHASES_PRE = ['pre'] as const;
const REVIEWED_PHASES_POST = [
  'rls',
  'functions',
  'triggers',
  'constraints',
  'transformations',
] as const;

async function applyReviewedPhase(
  sql: ReturnType<typeof createDatabaseClient>['sql'],
  phase: string,
): Promise<void> {
  let files: string[] = [];
  try {
    files = readdirSync(join(reviewedRoot, phase))
      .filter((file) => file.endsWith('.sql'))
      .sort();
  } catch {
    return; // Phase directory absent — nothing to apply.
  }
  for (const file of files) {
    const key = `${phase}/${file}`;
    const [existing] = await sql`
      select 1 from drizzle.reviewed_sql_migrations where file_key = ${key}
    `;
    if (existing !== undefined) continue;
    const contents = readFileSync(join(reviewedRoot, phase, file), 'utf8');
    await sql.begin(async (tx) => {
      await tx.unsafe(contents);
      await tx`insert into drizzle.reviewed_sql_migrations (file_key) values (${key})`;
    });
    console.log(`applied reviewed-sql: ${key}`);
  }
}

async function main(): Promise<void> {
  const { sql, db } = createDatabaseClient();
  try {
    await sql`create schema if not exists drizzle`;
    await sql`
      create table if not exists drizzle.reviewed_sql_migrations (
        file_key text primary key,
        applied_at timestamptz not null default now()
      )
    `;
    for (const phase of REVIEWED_PHASES_PRE) {
      await applyReviewedPhase(sql, phase);
    }
    await migrate(db, { migrationsFolder: join(packageRoot, 'migrations', 'generated') });
    console.log('applied generated migrations');
    for (const phase of REVIEWED_PHASES_POST) {
      await applyReviewedPhase(sql, phase);
    }
    console.log('migrations complete');
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
