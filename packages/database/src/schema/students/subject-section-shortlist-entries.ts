import { sql } from 'drizzle-orm';
import { check, integer, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { studentsSchema } from '../shared/schemas';
import { users } from '../identity/users';
import { tutorProfiles } from '../tutors/tutor-profiles';
import { studentSubjectSections } from './student-subject-sections';

/**
 * `students.subject_section_shortlist_entries` — the saved shortlist of
 * candidate tutors for one subject need. Not a request: no Intended Lesson
 * Request, Tutor Request, hold or booking exists at this stage.
 *
 * THE THREE-TUTOR CAP IS ENFORCED BY THE DATABASE, not by application logic:
 *
 *   1. `position` is constrained to 1..3 by a CHECK; and
 *   2. (section, position) is unique among ACTIVE rows.
 *
 * Together these make a fourth active entry unrepresentable, so two
 * concurrent requests racing for the last slot cannot both succeed — the
 * loser receives a unique violation, which the repository maps to a
 * RESOURCE_CONFLICT domain error. No trigger, no advisory lock, no
 * read-then-write race.
 *
 * The cap deliberately matches the approved Tutor Request fan-out limit, so
 * a shortlist maps one-to-one onto the future request slice.
 */
export const subjectSectionShortlistEntries = studentsSchema.table(
  'subject_section_shortlist_entries',
  {
    ...standardColumns,
    studentSubjectSectionId: uuid('student_subject_section_id')
      .notNull()
      .references(() => studentSubjectSections.id, { onDelete: 'restrict' }),
    tutorProfileId: uuid('tutor_profile_id')
      .notNull()
      .references(() => tutorProfiles.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
    /** active | removed */
    statusCode: text('status_code').notNull().default('active'),
    addedByUserId: uuid('added_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    note: text('note'),
  },
  (table) => [
    check('subject_section_shortlist_position_range', sql`${table.position} between 1 and 3`),
    // status_code is free text; constrain it so an off-enum value cannot
    // silently escape the partial unique indexes and defeat the cap.
    check(
      'subject_section_shortlist_status_check',
      sql`${table.statusCode} in ('active', 'removed')`,
    ),
    uniqueIndex('shortlist_active_position_unique_idx')
      .on(table.studentSubjectSectionId, table.position)
      .where(sql`${table.statusCode} = 'active'`),
    uniqueIndex('shortlist_active_tutor_unique_idx')
      .on(table.studentSubjectSectionId, table.tutorProfileId)
      .where(sql`${table.statusCode} = 'active'`),
  ],
);
