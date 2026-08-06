import { sql } from 'drizzle-orm';
import { text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { studentsSchema } from '../shared/schemas';
import { users } from '../identity/users';
import { subjects } from '../platform/subjects';
import { studentProfiles } from './student-profiles';

/**
 * `students.student_subject_sections` — a subject-specific section within a
 * Student Profile (Data Model §28). One profile may hold many. This is the
 * anchor for tutor discovery and for the saved shortlist.
 */
export const studentSubjectSections = studentsSchema.table(
  'student_subject_sections',
  {
    ...standardColumns,
    studentProfileId: uuid('student_profile_id')
      .notNull()
      .references(() => studentProfiles.id, { onDelete: 'restrict' }),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'restrict' }),
    schoolYearCode: text('school_year_code'),
    /** online | in_person | either */
    formatPreferenceCode: text('format_preference_code').notNull().default('either'),
    goals: text('goals'),
    supportSummary: text('support_summary'),
    statusCode: text('status_code').notNull().default('active'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    updatedByUserId: uuid('updated_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
  },
  (table) => [
    // One live section per student per subject.
    uniqueIndex('student_subject_sections_live_unique_idx')
      .on(table.studentProfileId, table.subjectId)
      .where(sql`${table.statusCode} = 'active'`),
  ],
);
