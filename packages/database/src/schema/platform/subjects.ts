import { integer, text } from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { platformSchema } from '../shared/schemas';

/**
 * `platform.subjects` — small seeded reference list so subject filtering has
 * referential integrity. Reference data, not user content.
 */
export const subjects = platformSchema.table('subjects', {
  ...standardColumns,
  code: text('code').notNull().unique(),
  displayName: text('display_name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  statusCode: text('status_code').notNull().default('active'),
});
