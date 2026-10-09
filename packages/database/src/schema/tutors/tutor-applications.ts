import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { tutorsSchema } from '../shared/schemas';
import { users } from '../identity/users';
import { subjects } from '../platform/subjects';
import { tutorProfiles } from './tutor-profiles';

/**
 * `tutors.tutor_applications` — becoming a tutor, as a workflow record.
 *
 * AN APPLICATION IS NOT A PROFILE (database spec §6.1). An applicant has no public
 * presence, cannot be booked and holds no tutor workspace; approval is the one
 * controlled transaction that creates all three. Keeping the two apart is what
 * makes it structurally impossible for a half-finished application to appear in
 * discovery.
 *
 * THE DRAFT IS A WORKING COPY, A SUBMITTED REVISION IS HISTORY. While the
 * applicant is still writing, what they have typed lives in `draft`, which may be
 * partial and invalid so no work is ever lost. Submitting validates it and writes
 * an immutable `tutor_application_revisions` row — the thing a reviewer reads and
 * the thing an approval names. A resubmission after changes were requested is a
 * new revision; the old one is never edited.
 *
 * PERSONAL DATA, SERVER-ONLY. Legal names, a phone number and referees' email
 * addresses are in these tables. No browser role may reach any of them; the
 * applicant reads their own through a server projection scoped by user id, and a
 * reviewer through a server action that re-checks their role.
 */
export const tutorApplications = tutorsSchema.table(
  'tutor_applications',
  {
    ...standardColumns,
    reference: text('reference')
      .notNull()
      .unique()
      .default(sql`'APP-' || lpad(nextval('platform.global_reference_seq')::text, 8, '0')`),
    applicantUserId: uuid('applicant_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** draft | submitted | under_review | changes_requested | approved | rejected | withdrawn */
    statusCode: text('status_code').notNull().default('draft'),
    /** The applicant's working copy. Partial and unvalidated by design; NOT history. */
    draft: jsonb('draft'),
    /** 0 until the first submission. The latest immutable revision. */
    currentRevisionNumber: integer('current_revision_number').notNull().default(0),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    /** What the APPLICANT is told with a changes-requested or rejected decision. */
    applicantMessage: text('applicant_message'),
    /** Reviewers' own notes. NEVER shown to the applicant. */
    internalNote: text('internal_note'),
    /** The exact revision approval named. */
    approvedRevisionNumber: integer('approved_revision_number'),
    /** Set only by the approval transaction. */
    tutorProfileId: uuid('tutor_profile_id').references(() => tutorProfiles.id, {
      onDelete: 'restrict',
    }),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'tutor_application_status_check',
      sql`${table.statusCode} in ('draft', 'submitted', 'under_review', 'changes_requested', 'approved', 'rejected', 'withdrawn')`,
    ),
    check('tutor_application_revision_check', sql`${table.currentRevisionNumber} >= 0`),
    // Anything past draft has been submitted at least once, so has a revision.
    check(
      'tutor_application_submitted_has_revision_check',
      sql`${table.statusCode} in ('draft', 'withdrawn') or ${table.currentRevisionNumber} >= 1`,
    ),
    // An approved application names the revision approved and the profile it made.
    check(
      'tutor_application_approved_complete_check',
      sql`${table.statusCode} <> 'approved' or (${table.tutorProfileId} is not null and ${table.approvedRevisionNumber} is not null and ${table.decidedAt} is not null and ${table.decidedByUserId} is not null)`,
    ),
    // A decision records who and when.
    check(
      'tutor_application_decided_check',
      sql`${table.statusCode} not in ('rejected', 'changes_requested') or (${table.decidedAt} is not null and ${table.decidedByUserId} is not null)`,
    ),
    // ONE LIVE APPLICATION PER PERSON. Rejected and withdrawn ones are history,
    // so someone turned down can apply again later, but nobody can hold two.
    uniqueIndex('tutor_application_live_per_applicant_unique_idx')
      .on(table.applicantUserId)
      .where(
        sql`${table.statusCode} in ('draft', 'submitted', 'under_review', 'changes_requested', 'approved')`,
      ),
    // The review queue reads what is waiting, oldest first.
    index('tutor_application_review_queue_idx')
      .on(table.submittedAt)
      .where(sql`${table.statusCode} in ('submitted', 'under_review')`),
  ],
);

/**
 * `tutors.tutor_application_revisions` — what was submitted, frozen.
 *
 * IMMUTABLE. A row is written once, at submission, and never updated: no
 * `updated_at`, no record version. An approval names a revision number, so what a
 * reviewer decided on is what is on file, whatever the applicant wrote since.
 *
 * Deliberately holds no identity document, date of birth or vetting evidence.
 * Those are checked by a person outside the form and recorded as a check result.
 */
export const tutorApplicationRevisions = tutorsSchema.table(
  'tutor_application_revisions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => tutorApplications.id, { onDelete: 'restrict' }),
    revisionNumber: integer('revision_number').notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    legalFirstName: text('legal_first_name').notNull(),
    legalFamilyName: text('legal_family_name').notNull(),
    /** What families will see. Becomes `tutor_profiles.public_first_name`. */
    preferredFirstName: text('preferred_first_name').notNull(),
    phone: text('phone'),
    headline: text('headline').notNull(),
    teachingApproach: text('teaching_approach').notNull(),
    experienceSummary: text('experience_summary').notNull(),
    qualificationsSummary: text('qualifications_summary'),
    yearLevelFrom: integer('year_level_from').notNull(),
    yearLevelTo: integer('year_level_to').notNull(),
    offersOnline: boolean('offers_online').notNull(),
    offersInPerson: boolean('offers_in_person').notNull(),
    /** Which version of the declarations wording was accepted, and when. */
    declarationsVersion: text('declarations_version').notNull(),
    declarationsAcceptedAt: timestamp('declarations_accepted_at', {
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    uniqueIndex('tutor_application_revision_number_unique_idx').on(
      table.applicationId,
      table.revisionNumber,
    ),
    check('tutor_application_revision_number_check', sql`${table.revisionNumber} >= 1`),
    check(
      'tutor_application_revision_years_check',
      sql`${table.yearLevelFrom} between 1 and 13 and ${table.yearLevelTo} between 1 and 13 and ${table.yearLevelFrom} <= ${table.yearLevelTo}`,
    ),
    check(
      'tutor_application_revision_format_check',
      sql`${table.offersOnline} or ${table.offersInPerson}`,
    ),
  ],
);

/** The subjects a revision says the applicant teaches. */
export const tutorApplicationRevisionSubjects = tutorsSchema.table(
  'tutor_application_revision_subjects',
  {
    revisionId: uuid('revision_id')
      .notNull()
      .references(() => tutorApplicationRevisions.id, { onDelete: 'restrict' }),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'restrict' }),
  },
  (table) => [primaryKey({ columns: [table.revisionId, table.subjectId] })],
);

/** The referees a revision names. Their email addresses are personal data. */
export const tutorApplicationRevisionReferences = tutorsSchema.table(
  'tutor_application_revision_references',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    revisionId: uuid('revision_id')
      .notNull()
      .references(() => tutorApplicationRevisions.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
    fullName: text('full_name').notNull(),
    email: text('email').notNull(),
    relationship: text('relationship').notNull(),
  },
  (table) => [
    uniqueIndex('tutor_application_reference_position_unique_idx').on(
      table.revisionId,
      table.position,
    ),
    check('tutor_application_reference_position_check', sql`${table.position} between 1 and 3`),
  ],
);

/**
 * `tutors.tutor_application_checks` — what a person verified, one row per check.
 *
 * NEVER ONE GENERIC "VERIFIED" FLAG (database spec §6.4). Identity, safeguarding,
 * references and the interview are each recorded on their own, with who checked
 * and when, so "what do we actually know about this applicant" is a query.
 *
 * The note is the reviewer's own and staff-only. The evidence itself stays with
 * whoever checked it; Studdy holds the outcome.
 */
export const tutorApplicationChecks = tutorsSchema.table(
  'tutor_application_checks',
  {
    ...standardColumns,
    applicationId: uuid('application_id')
      .notNull()
      .references(() => tutorApplications.id, { onDelete: 'restrict' }),
    /** identity | safeguarding | references | interview */
    checkCode: text('check_code').notNull(),
    /** pending | verified | failed */
    statusCode: text('status_code').notNull().default('pending'),
    note: text('note'),
    checkedByUserId: uuid('checked_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    checkedAt: timestamp('checked_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('tutor_application_check_unique_idx').on(table.applicationId, table.checkCode),
    check(
      'tutor_application_check_code_check',
      sql`${table.checkCode} in ('identity', 'safeguarding', 'references', 'interview')`,
    ),
    check(
      'tutor_application_check_status_check',
      sql`${table.statusCode} in ('pending', 'verified', 'failed')`,
    ),
    // A result records who reached it and when.
    check(
      'tutor_application_check_attributed_check',
      sql`${table.statusCode} = 'pending' or (${table.checkedByUserId} is not null and ${table.checkedAt} is not null)`,
    ),
  ],
);
