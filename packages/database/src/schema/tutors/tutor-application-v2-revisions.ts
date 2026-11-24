import { sql } from 'drizzle-orm';
import { check, integer, jsonb, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tutorsSchema } from '../shared/schemas';
import { tutorApplications } from './tutor-applications';

/**
 * Append-only v2 Tutor Application submissions.
 *
 * Separate from the legacy revision table, whose required public headline,
 * global year range and email-only references conflict with approved v2 data.
 * Contains private DOB/referee declarations: server-only, no browser grants.
 * A reviewer and the approval operation must explicitly support v2 before
 * any applicant-facing submission feature can be enabled.
 */
export const tutorApplicationV2Revisions = tutorsSchema.table(
  'tutor_application_v2_revisions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => tutorApplications.id, { onDelete: 'restrict' }),
    revisionNumber: integer('revision_number').notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    snapshot: jsonb('snapshot').notNull(),
    tutorAgreementVersion: text('tutor_agreement_version').notNull(),
    codeOfConductVersion: text('code_of_conduct_version').notNull(),
    privacyNoticeVersion: text('privacy_notice_version').notNull(),
    guardianConsentReference: text('guardian_consent_reference'),
  },
  (table) => [
    uniqueIndex('tutor_application_v2_revision_number_unique_idx').on(
      table.applicationId,
      table.revisionNumber,
    ),
    check('tutor_application_v2_revision_number_check', sql`${table.revisionNumber} >= 1`),
    check(
      'tutor_application_v2_revision_snapshot_check',
      sql`${table.snapshot} ->> 'schemaVersion' = '2'`,
    ),
  ],
);
