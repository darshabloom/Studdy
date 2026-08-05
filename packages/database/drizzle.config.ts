import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle generates ordinary schema migrations into migrations/generated.
 * Reviewed handwritten SQL (RLS, functions, triggers, constraints) lives in
 * migrations/reviewed-sql and is applied by src/migrate.ts after the
 * generated set (Blueprint §16; Database spec).
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations/generated',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  },
  schemaFilter: [
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
  ],
});
