import { boolean, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { identitySchema } from '../shared/schemas';
import { users } from './users';

/** `identity.contact_points` (Database spec §2.2). */
export const contactPoints = identitySchema.table('contact_points', {
  ...standardColumns,
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  contactTypeCode: text('contact_type_code').notNull(), // email | phone
  value: text('value').notNull(),
  isPrimary: boolean('is_primary').notNull().default(false),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  statusCode: text('status_code').notNull().default('active'),
});
