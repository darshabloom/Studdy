import { sql } from 'drizzle-orm';
import { check, index, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { bookingsSchema } from '../shared/schemas';
import { users } from '../identity/users';
import { familyAccounts } from '../families/family-accounts';
import { studentSubjectSections } from '../students/student-subject-sections';

/**
 * `bookings.intended_lesson_requests` (ILR) — the underlying tutoring need.
 *
 * PRIVACY: no tutor ever sees this row, or its identifier, in any projection,
 * URL, error, log or API response. Tutor Requests carry the foreign key for
 * transactional integrity only (approved clarification, 7 Aug 2026); the
 * tutor-facing projection never selects it.
 *
 * One ILR fans out to up to N Tutor Requests (cap from
 * `platform.rule_settings['requests.fan_out_cap']`, initially 3).
 */
export const intendedLessonRequests = bookingsSchema.table(
  'intended_lesson_requests',
  {
    ...standardColumns,
    reference: text('reference')
      .notNull()
      .unique()
      .default(sql`'LR-' || lpad(nextval('platform.global_reference_seq')::text, 8, '0')`),
    studentSubjectSectionId: uuid('student_subject_section_id')
      .notNull()
      .references(() => studentSubjectSections.id, { onDelete: 'restrict' }),
    requestedByUserId: uuid('requested_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** Payer scope snapshot at creation; null for an independent student. */
    familyAccountId: uuid('family_account_id').references(() => familyAccounts.id, {
      onDelete: 'restrict',
    }),
    /** draft | awaiting_responses | ready_for_selection | fulfilled | closed */
    statusCode: text('status_code').notNull().default('awaiting_responses'),
    /** Why it closed, for the requesting family only — never shown to tutors. */
    closeReasonCode: text('close_reason_code'),

    /**
     * The intended lesson. The *times* live in `request_time_options`: a
     * request carries several acceptable times (D-3), not one, and a single
     * proposed instant here would be a second source of truth for a set that
     * can be partly taken, partly lapsed.
     */
    durationMinutes: integer('duration_minutes').notNull(),
    /** online | in_person */
    formatCode: text('format_code').notNull(),
    timeZone: text('time_zone').notNull(),
    /** Free text from the requester, shown to every invited tutor. */
    notesForTutors: text('notes_for_tutors'),

    /**
     * Snapshotted decision deadline (approved decision 5). Configuration may
     * change afterwards; this value does not.
     */
    decisionDeadlineAt: timestamp('decision_deadline_at', { withTimezone: true }).notNull(),
    /** The rule_settings version this request's deadlines were calculated from. */
    deadlineRuleVersion: integer('deadline_rule_version').notNull(),

    sentAt: timestamp('sent_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    updatedByUserId: uuid('updated_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
  },
  (table) => [
    check(
      'ilr_status_check',
      sql`${table.statusCode} in ('draft', 'awaiting_responses', 'ready_for_selection', 'fulfilled', 'closed')`,
    ),
    check('ilr_format_check', sql`${table.formatCode} in ('online', 'in_person')`),
    check('ilr_duration_positive_check', sql`${table.durationMinutes} > 0`),
    index('ilr_section_idx').on(table.studentSubjectSectionId),
    // Expiry sweeps scan open requests by deadline.
    index('ilr_open_deadline_idx')
      .on(table.decisionDeadlineAt)
      .where(sql`${table.statusCode} in ('awaiting_responses', 'ready_for_selection')`),
  ],
);
