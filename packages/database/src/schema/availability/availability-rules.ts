import { sql } from 'drizzle-orm';
import { check, index, integer, smallint, text, time, date, uuid } from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { availabilitySchema } from '../shared/schemas';
import { users } from '../identity/users';
import { tutorProfiles } from '../tutors/tutor-profiles';
import { subjects } from '../platform/subjects';
import { services } from '../services/services';

/**
 * `availability.availability_rules` — recurring bookable time (Database spec §8.4).
 *
 * SERVER-ONLY. A family never reads this table. Discovery and the request
 * composer receive only *derived positive bookable slots*; the rules that
 * produced them, and every gap in them, stay here. A raw rule would tell a
 * reader when a tutor is habitually not working, which is information about a
 * person's life rather than about a bookable service.
 *
 * LOCAL TIME IS AUTHORITATIVE. `day_of_week` plus `local_start_time` and
 * `local_end_time` are stored with the tutor's `iana_time_zone`, never as a UTC
 * offset. A stored offset would silently move a tutor's Tuesday evening when
 * daylight saving changed; a zone plus a local time does not.
 *
 * `service_id` and `subject_id` are nullable: null means "applies to all of my
 * services". A rule naming a service is more specific and wins where both
 * match.
 */
export const availabilityRules = availabilitySchema.table(
  'availability_rules',
  {
    ...standardColumns,
    tutorProfileId: uuid('tutor_profile_id')
      .notNull()
      .references(() => tutorProfiles.id, { onDelete: 'restrict' }),
    /** Null = every service this tutor offers. */
    serviceId: uuid('service_id').references(() => services.id, { onDelete: 'restrict' }),
    /** Null = every subject this tutor teaches. */
    subjectId: uuid('subject_id').references(() => subjects.id, { onDelete: 'restrict' }),
    /** online | in_person | any */
    lessonFormatCode: text('lesson_format_code').notNull().default('any'),
    /** 0 = Sunday … 6 = Saturday, matching PostgreSQL `extract(dow …)`. */
    dayOfWeek: smallint('day_of_week').notNull(),
    localStartTime: time('local_start_time').notNull(),
    localEndTime: time('local_end_time').notNull(),
    /** IANA zone, e.g. Pacific/Auckland. Never a numeric offset. */
    ianaTimeZone: text('iana_time_zone').notNull(),
    effectiveFrom: date('effective_from').notNull(),
    /** Null = open-ended. */
    effectiveUntil: date('effective_until'),
    /** Null = fall back to the service version, then to platform configuration. */
    minimumNoticeMinutes: integer('minimum_notice_minutes'),
    maximumAdvanceBookingDays: integer('maximum_advance_booking_days'),
    /** active | archived */
    statusCode: text('status_code').notNull().default('active'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    updatedByUserId: uuid('updated_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
  },
  (table) => [
    check('availability_rule_status_check', sql`${table.statusCode} in ('active', 'archived')`),
    check(
      'availability_rule_format_check',
      sql`${table.lessonFormatCode} in ('online', 'in_person', 'any')`,
    ),
    check('availability_rule_day_range', sql`${table.dayOfWeek} between 0 and 6`),
    // A rule that ends before it starts would silently contribute nothing.
    // Rejecting it means a mistake surfaces at entry, not as absent slots.
    check('availability_rule_time_order', sql`${table.localEndTime} > ${table.localStartTime}`),
    check(
      'availability_rule_effective_order',
      sql`${table.effectiveUntil} is null or ${table.effectiveUntil} >= ${table.effectiveFrom}`,
    ),
    check(
      'availability_rule_notice_non_negative',
      sql`${table.minimumNoticeMinutes} is null or ${table.minimumNoticeMinutes} >= 0`,
    ),
    check(
      'availability_rule_advance_positive',
      sql`${table.maximumAdvanceBookingDays} is null or ${table.maximumAdvanceBookingDays} > 0`,
    ),
    index('availability_rule_tutor_active_idx')
      .on(table.tutorProfileId, table.dayOfWeek)
      .where(sql`${table.statusCode} = 'active'`),
  ],
);
