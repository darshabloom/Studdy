import { sql } from 'drizzle-orm';
import { char, date, text, timestamp } from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { identitySchema } from '../shared/schemas';

/**
 * `identity.users` — the permanent Studdy User (Database spec §2.2 key
 * tables). Business tables reference this ID, never Supabase `auth.users`.
 * The human-readable reference (USER-…) comes from the global reference
 * sequence via a database default.
 */
export const users = identitySchema.table('users', {
  ...standardColumns,
  reference: text('reference')
    .notNull()
    .unique()
    .default(sql`'USER-' || lpad(nextval('platform.global_reference_seq')::text, 8, '0')`),
  legalName: text('legal_name'),
  preferredName: text('preferred_name'),
  /** Collected at /welcome (approved decision, 6 Aug 2026). Legal name stays deferred. */
  familyName: text('family_name'),
  displayName: text('display_name').notNull(),
  dateOfBirth: date('date_of_birth'),
  countryCode: char('country_code', { length: 2 }).notNull(),
  regionCode: text('region_code'),
  timeZone: text('time_zone').notNull(),
  locale: text('locale').notNull(),
  accountStatusCode: text('account_status_code').notNull().default('active'),
  retentionUntil: timestamp('retention_until', { withTimezone: true }),
  legalHoldStatus: text('legal_hold_status'),
});
