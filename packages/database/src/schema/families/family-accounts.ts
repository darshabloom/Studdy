import { sql } from 'drizzle-orm';
import { char, text } from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { familiesSchema } from '../shared/schemas';

/**
 * `families.family_accounts` — a permanent entity in its own right, not
 * fields on the primary parent (Data Model §23). Created lazily when a
 * guardian adds their first student.
 */
export const familyAccounts = familiesSchema.table('family_accounts', {
  ...standardColumns,
  reference: text('reference')
    .notNull()
    .unique()
    .default(sql`'FAM-' || lpad(nextval('platform.global_reference_seq')::text, 8, '0')`),
  displayName: text('display_name').notNull(),
  primaryCountryCode: char('primary_country_code', { length: 2 }).notNull(),
  regionCode: text('region_code'),
  defaultCurrencyCode: char('default_currency_code', { length: 3 }).notNull(),
  statusCode: text('status_code').notNull().default('active'),
});
