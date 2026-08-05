import { integer, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Standard mutable-record columns (Database spec §3). Money is always
 * `amount_minor bigint` + `currency_code char(3)`; floats are prohibited.
 * Optimistic concurrency uses record_version (RESOURCE_CONFLICT on mismatch).
 */
export const standardColumns = {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  recordVersion: integer('record_version').notNull().default(1),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
};
