import { sql } from 'drizzle-orm';
import { check, index, text, uuid } from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { studentsSchema } from '../shared/schemas';
import { users } from '../identity/users';
import { familyAccounts } from '../families/family-accounts';

/**
 * `students.student_profiles` — the student's permanent learning identity
 * (Data Model §27). Serves both paths:
 *
 *  - dependent: `user_id` may be null (profile exists before any login),
 *    `default_family_account_id` set, independence_status = 'dependent';
 *  - independent: `user_id` is the student's own Studdy User,
 *    independence_status = 'independent', family link optional.
 *
 * Ordinary CRUD provenance is carried by created_by/updated_by + timestamps;
 * no audit event is written for routine profile creation.
 */
export const studentProfiles = studentsSchema.table(
  'student_profiles',
  {
    ...standardColumns,
    reference: text('reference')
      .notNull()
      .unique()
      .default(sql`'STUDENT-' || lpad(nextval('platform.global_reference_seq')::text, 8, '0')`),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'restrict' }),
    defaultFamilyAccountId: uuid('default_family_account_id').references(() => familyAccounts.id, {
      onDelete: 'restrict',
    }),
    preferredName: text('preferred_name').notNull(),
    familyName: text('family_name'),
    statusCode: text('status_code').notNull().default('active'),
    /** dependent | independent */
    independenceStatusCode: text('independence_status_code').notNull().default('dependent'),
    /** no_login | parent_managed | dependent_login_active | independent_access_active */
    loginAccessStateCode: text('login_access_state_code').notNull().default('no_login'),
    schoolYearCode: text('school_year_code'),
    schoolOrProviderName: text('school_or_provider_name'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    updatedByUserId: uuid('updated_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
  },
  (table) => [
    check(
      'student_profiles_independence_status_check',
      sql`${table.independenceStatusCode} in ('dependent', 'independent')`,
    ),
    index('student_profiles_user_id_idx').on(table.userId),
    index('student_profiles_family_idx').on(table.defaultFamilyAccountId),
  ],
);
