import { boolean, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { standardColumns } from '../shared/columns';
import { identitySchema } from '../shared/schemas';
import { users } from './users';

/**
 * `identity.auth_identity_links` — the bridge between Supabase Auth and the
 * permanent Studdy User. RLS resolution chain:
 * `auth.uid() → identity.auth_identity_links → identity.users` (spec §13).
 */
export const authIdentityLinks = identitySchema.table(
  'auth_identity_links',
  {
    ...standardColumns,
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    providerType: text('provider_type').notNull().default('supabase'),
    /** Supabase `auth.users.id`. Deliberately no FK — auth schema stays separate. */
    providerSubjectId: uuid('provider_subject_id').notNull(),
    providerTenant: text('provider_tenant'),
    authenticationEmail: text('authentication_email').notNull(),
    statusCode: text('status_code').notNull().default('active'),
    isPrimary: boolean('is_primary').notNull().default(true),
    linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
    lastAuthenticatedAt: timestamp('last_authenticated_at', { withTimezone: true }),
    unlinkedAt: timestamp('unlinked_at', { withTimezone: true }),
    unlinkReasonCode: text('unlink_reason_code'),
  },
  (table) => [
    uniqueIndex('auth_identity_links_active_subject_idx')
      .on(table.providerType, table.providerSubjectId)
      .where(sql`${table.statusCode} = 'active'`),
  ],
);
