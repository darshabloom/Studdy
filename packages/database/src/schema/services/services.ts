import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  char,
  check,
  index,
  integer,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { servicesSchema } from '../shared/schemas';
import { users } from '../identity/users';
import { subjects } from '../platform/subjects';
import { tutorProfiles } from '../tutors/tutor-profiles';

/**
 * `services.services` — what a tutor offers.
 *
 * READABLE BY SIGNED-IN BROWSERS once published (RLS policy
 * `public_read_published_services`), so every column here must be safe to show a
 * family. What a reviewer said about a service is NOT here: it lives in
 * `service_reviews`, which no browser role can read.
 */
export const services = servicesSchema.table(
  'services',
  {
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
    /** What a family gets. Null only on rows that predate tutor-managed services. */
    description: text('description'),
    /** This service's own year range. Null falls back to the tutor's profile. */
    yearLevelFrom: integer('year_level_from'),
    yearLevelTo: integer('year_level_to'),
    /**
     * draft | pending_approval | changes_requested | approved | published |
     * unpublished | archived. DRAFT BY DEFAULT: a row that says nothing about its
     * status must not be on sale.
     */
    statusCode: text('status_code').notNull().default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    /**
     * The reviewed service this one will REPLACE when it is published. A service
     * on sale is never edited in place; its changes are drafted here, reviewed,
     * and swapped in by the tutor.
     */
    replacesServiceId: uuid('replaces_service_id').references((): AnyPgColumn => services.id, {
      onDelete: 'restrict',
    }),
  },
  (table) => [
    check(
      'services_status_check',
      sql`${table.statusCode} in ('draft', 'pending_approval', 'changes_requested', 'approved', 'published', 'unpublished', 'archived')`,
    ),
    check(
      'services_year_levels_check',
      sql`${table.yearLevelFrom} is null or ${table.yearLevelTo} is null or ${table.yearLevelFrom} <= ${table.yearLevelTo}`,
    ),
    index('services_tutor_status_idx').on(table.tutorProfileId, table.statusCode),
  ],
);

/**
 * `services.service_reviews` — one row each time a service is sent to Studdy,
 * and what was decided. SERVER-ONLY.
 *
 * Separate from `services` on purpose: that table is readable by browsers once a
 * service is published, and neither a reviewer's identity nor their note belongs
 * anywhere a family could reach.
 */
export const serviceReviews = servicesSchema.table(
  'service_reviews',
  {
    ...standardColumns,
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'restrict' }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull(),
    submittedByUserId: uuid('submitted_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** pending | approved | changes_requested | withdrawn */
    outcomeCode: text('outcome_code').notNull().default('pending'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    /** Written FOR THE TUTOR, and the only reviewer text they are ever shown. */
    tutorMessage: text('tutor_message'),
    /** Staff only. Never rendered to the tutor. */
    internalNote: text('internal_note'),
  },
  (table) => [
    check(
      'service_reviews_outcome_check',
      sql`${table.outcomeCode} in ('pending', 'approved', 'changes_requested', 'withdrawn')`,
    ),
    // A decision carries who made it and when; a pending or withdrawn one need not.
    check(
      'service_reviews_decision_check',
      sql`${table.outcomeCode} not in ('approved', 'changes_requested') or (${table.decidedAt} is not null and ${table.decidedByUserId} is not null)`,
    ),
    index('service_reviews_service_idx').on(table.serviceId, table.submittedAt),
  ],
);

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
  /** draft | current | superseded. Only `current` versions of a published service are on sale. */
  statusCode: text('status_code').notNull().default('current'),
});
