import { sql } from 'drizzle-orm';
import { bigint, char, integer, text, uuid } from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { servicesSchema } from '../shared/schemas';
import { subjects } from '../platform/subjects';
import { tutorProfiles } from '../tutors/tutor-profiles';

/** `services.services` — what a tutor offers. */
export const services = servicesSchema.table('services', {
  ...standardColumns,
  reference: text('reference')
    .notNull()
    .unique()
    .default(sql`'SERVICE-' || lpad(nextval('platform.global_reference_seq')::text, 8, '0')`),
  tutorProfileId: uuid('tutor_profile_id')
    .notNull()
    .references(() => tutorProfiles.id, { onDelete: 'restrict' }),
  subjectId: uuid('subject_id')
    .notNull()
    .references(() => subjects.id, { onDelete: 'restrict' }),
  displayName: text('display_name').notNull(),
  statusCode: text('status_code').notNull().default('published'),
});

/**
 * `services.service_versions` — immutable priced versions. A Booking will
 * later reference one exact version; discovery reads the current one.
 * Money is minor units + ISO currency; floats are prohibited.
 */
export const serviceVersions = servicesSchema.table('service_versions', {
  ...standardColumns,
  serviceId: uuid('service_id')
    .notNull()
    .references(() => services.id, { onDelete: 'restrict' }),
  versionNumber: integer('version_number').notNull().default(1),
  durationMinutes: integer('duration_minutes').notNull(),
  priceAmountMinor: bigint('price_amount_minor', { mode: 'bigint' }).notNull(),
  currencyCode: char('currency_code', { length: 3 }).notNull(),
  /** online | in_person | either */
  formatCode: text('format_code').notNull().default('online'),
  statusCode: text('status_code').notNull().default('current'),
});
