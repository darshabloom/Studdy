import { sql } from 'drizzle-orm';
import { check, index, integer, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { bookingsSchema } from '../shared/schemas';
import { users } from '../identity/users';
import { tutorProfiles } from '../tutors/tutor-profiles';
import { serviceVersions } from '../services/services';
import { intendedLessonRequests } from './intended-lesson-requests';
import { generateTutorRequestReference } from './reference';

/**
 * `bookings.tutor_requests` (TR) — one per invited tutor.
 *
 * PRIVACY BOUNDARY. A tutor may learn ONLY about their own request. This row
 * holds `intended_lesson_request_id` and `position` because the transactional
 * close-out needs them, but the tutor-facing projection must never select
 * either, and neither may appear in a URL, error message, log line, API
 * response or anything reaching the browser. Tutors address their request by
 * `reference` (TREQ-), which is RANDOM rather than sequential so it cannot be
 * correlated with the ILR reference or with a sibling's reference.
 *
 * `status_code` deliberately has no value meaning "you lost": EVERY family-
 * side and system-side ending becomes `closed`, whatever the cause — family
 * withdrawal, competitor selection, expiry after another tutor accepted, or a
 * lapsed payment window. The real reason lives in the server-only
 * `close_reason_code`. Accept/decline arrive in the response slice.
 */
export const tutorRequests = bookingsSchema.table(
  'tutor_requests',
  {
    ...standardColumns,
    // Random, not sequential — see ./reference.ts for why. The database
    // column default (reviewed-sql/functions/0006) produces the same shape
    // for any writer that is not this application.
    // Previously read: the value comes from
    // bookings.generate_tutor_request_reference(), created in
    // reviewed-sql/functions/0006, which also installs it as the column
    // default (the function cannot exist before the generated migration
    // creates this table). The reference is RANDOM rather than sequential so
    // it cannot be correlated with the ILR reference, nor with a sibling's.
    reference: text('reference').notNull().unique().$defaultFn(generateTutorRequestReference),
    /** SERVER-ONLY. Never appears in any tutor-facing projection. */
    intendedLessonRequestId: uuid('intended_lesson_request_id')
      .notNull()
      .references(() => intendedLessonRequests.id, { onDelete: 'restrict' }),
    tutorProfileId: uuid('tutor_profile_id')
      .notNull()
      .references(() => tutorProfiles.id, { onDelete: 'restrict' }),
    /** The exact priced version the tutor is being asked about. */
    serviceVersionId: uuid('service_version_id')
      .notNull()
      .references(() => serviceVersions.id, { onDelete: 'restrict' }),
    /** SERVER-ONLY slot number within the fan-out. Never exposed to tutors. */
    position: integer('position').notNull(),
    /** sent | accepted | selected | declined | expired | acceptance_withdrawn | closed */
    statusCode: text('status_code').notNull().default('sent'),
    /**
     * Snapshotted response deadline (approved decision 5). Shown to the tutor;
     * unaffected by later configuration changes.
     */
    respondByAt: timestamp('respond_by_at', { withTimezone: true }).notNull(),
    deadlineRuleVersion: integer('deadline_rule_version').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    /**
     * SERVER-ONLY. Why the request closed. Never rendered to a tutor: a
     * reason distinguishing "another tutor was selected" from "the family
     * withdrew" would leak the existence of competitors.
     */
    closeReasonCode: text('close_reason_code'),
    /** Tutor-supplied decline reason, arriving with the response slice. */
    declineReasonCode: text('decline_reason_code'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    updatedByUserId: uuid('updated_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
  },
  (table) => [
    check(
      'tutor_request_status_check',
      sql`${table.statusCode} in ('sent', 'accepted', 'selected', 'declined', 'expired', 'acceptance_withdrawn', 'closed')`,
    ),
    check('tutor_request_position_range', sql`${table.position} between 1 and 3`),
    // Fan-out cap enforced by the database, mirroring the shortlist pattern:
    // a fourth live request per ILR is unrepresentable.
    uniqueIndex('tutor_request_live_position_unique_idx')
      .on(table.intendedLessonRequestId, table.position)
      .where(sql`${table.statusCode} in ('sent', 'accepted', 'selected')`),
    // One live request per tutor per ILR — no duplicate invitations.
    uniqueIndex('tutor_request_live_tutor_unique_idx')
      .on(table.intendedLessonRequestId, table.tutorProfileId)
      .where(sql`${table.statusCode} in ('sent', 'accepted', 'selected')`),
    index('tutor_request_tutor_idx').on(table.tutorProfileId),
    index('tutor_request_open_deadline_idx')
      .on(table.respondByAt)
      .where(sql`${table.statusCode} = 'sent'`),
  ],
);
