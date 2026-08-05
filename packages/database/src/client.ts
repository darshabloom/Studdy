import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

export const LOCAL_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:14322/postgres';

export function databaseUrl(): string {
  return process.env['DATABASE_URL'] ?? LOCAL_DATABASE_URL;
}

/** Server-only database client. Never import from browser code. */
export function createDatabaseClient(url: string = databaseUrl()) {
  const sql = postgres(url, { max: 5, onnotice: () => undefined });
  const db = drizzle(sql, { schema });
  return { sql, db };
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;
