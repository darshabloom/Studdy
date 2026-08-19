import { sql } from 'drizzle-orm';
import { boolean, check, index, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { availabilitySchema } from '../shared/schemas';
import { users } from '../identity/users';
import { tutorProfiles } from '../tutors/tutor-profiles';

/**
 * `availability.availability_exceptions` — one-off additions and removals
 * (Database spec §8.6): extra hours, holidays, breaks and blocked time.
 *
 * SERVER-ONLY, and more sensitive than the rules. `reason_code` and the private
 * flag exist because doc 07 §8.6 requires blocked time to record its reason
 * separately from any public "unavailable" label. A reason such as a medical
 * appointment or a family commitment must never leave the tutor's own
 * workspace, and no family-facing projection selects it.
 *
 * Removals and additions may overlap each other freely — a holiday inside a
 * blocked week is ordinary. There is deliberately no exclusion constraint here;
 * resolution order lives in the bookable-slot calculation, where `removes`
 * always beats `adds`.
 */
export const availabilityExceptions = availabilitySchema.table(
  'availability_exceptions',
  {
    ...standardColumns,
    tutorProfileId: uuid('tutor_profile_id')
      .notNull()
      .references(() => tutorProfiles.id, { onDelete: 'restrict' }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    /** adds = extra availability; removes = holiday, break or blocked time. */
    effectCode: text('effect_code').notNull(),
    /**
     * Which lesson format this exception scopes, mirroring
     * `availability_rules.lesson_format_code`: online | in_person | any.
     *
     * ONLY MEANINGFUL FOR `adds`. A one-off addition is availability, so it
     * carries the same scope a recurring rule does. A `removes` keeps 'any' and
     * removes the time whatever the format, because being unavailable is a fact
     * about the tutor rather than about how a lesson would have been delivered.
     * A tutor who is away but can still teach online narrows their availability
     * rather than carving a format-shaped hole in a block.
     */
    lessonFormatCode: text('lesson_format_code').notNull().default('any'),
    /**
     * SERVER-ONLY, and never rendered outside the tutor's own workspace.
     * Doc 07 §8.6: blocked time records its private reason separately from the
     * public "unavailable" label.
     */
    reasonCode: text('reason_code'),
    /** Free text the tutor writes for themselves. Never leaves their workspace. */
    privateNote: text('private_note'),
    isPrivate: boolean('is_private').notNull().default(true),
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
    check('availability_exception_effect_check', sql`${table.effectCode} in ('adds', 'removes')`),
    check(
      'availability_exception_format_check',
      sql`${table.lessonFormatCode} in ('online', 'in_person', 'any')`,
    ),
    check(
      'availability_exception_status_check',
      sql`${table.statusCode} in ('active', 'archived')`,
    ),
    check('availability_exception_time_order', sql`${table.endsAt} > ${table.startsAt}`),
    index('availability_exception_tutor_window_idx')
      .on(table.tutorProfileId, table.startsAt, table.endsAt)
      .where(sql`${table.statusCode} = 'active'`),
  ],
);
