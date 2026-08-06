import { and, eq, isNull, or } from 'drizzle-orm';
import { createDatabaseClient } from '../client';
import {
  familyAccounts,
  familyMemberships,
  studentProfiles,
  studentSubjectSections,
  subjectSectionShortlistEntries,
  subjects,
} from '../schema/index';

/**
 * Family and student repository. Ordinary CRUD carries provenance through
 * created_by/updated_by and timestamps — no audit event is written for
 * routine profile or subject-section creation (approved 6 Aug 2026).
 */

export interface StudentRecord {
  readonly studentProfileId: string;
  readonly reference: string;
  readonly preferredName: string;
  readonly familyName: string | null;
  readonly schoolYearCode: string | null;
  readonly schoolOrProviderName: string | null;
  readonly independenceStatusCode: 'dependent' | 'independent';
}

export interface SubjectSectionRecord {
  readonly subjectSectionId: string;
  readonly studentProfileId: string;
  readonly subjectId: string;
  readonly subjectCode: string;
  readonly subjectDisplayName: string;
  readonly schoolYearCode: string | null;
  readonly formatPreferenceCode: string;
  readonly goals: string | null;
  readonly shortlistCount: number;
}

export interface SubjectOption {
  readonly subjectId: string;
  readonly code: string;
  readonly displayName: string;
}

export async function listSubjects(): Promise<readonly SubjectOption[]> {
  const { sql, db } = createDatabaseClient();
  try {
    const rows = await db
      .select({ subjectId: subjects.id, code: subjects.code, displayName: subjects.displayName })
      .from(subjects)
      .where(eq(subjects.statusCode, 'active'))
      .orderBy(subjects.sortOrder, subjects.displayName);
    return rows;
  } finally {
    await sql.end();
  }
}

/**
 * Resolve the family account a guardian acts for, creating it on first use.
 * Idempotent: an existing active membership returns that family.
 */
export async function ensureFamilyAccountForGuardian(input: {
  studdyUserId: string;
  displayName: string;
  countryCode: string;
  currencyCode: string;
}): Promise<string> {
  const { sql, db } = createDatabaseClient();
  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ familyAccountId: familyMemberships.familyAccountId })
        .from(familyMemberships)
        .where(
          and(
            eq(familyMemberships.userId, input.studdyUserId),
            eq(familyMemberships.statusCode, 'active'),
            isNull(familyMemberships.endedAt),
          ),
        );
      if (existing !== undefined) return existing.familyAccountId;

      const [account] = await tx
        .insert(familyAccounts)
        .values({
          displayName: input.displayName,
          primaryCountryCode: input.countryCode,
          defaultCurrencyCode: input.currencyCode,
        })
        .returning({ id: familyAccounts.id });
      if (account === undefined) throw new Error('family account insert returned no row');

      await tx.insert(familyMemberships).values({
        familyAccountId: account.id,
        userId: input.studdyUserId,
        membershipRoleCode: 'primary_guardian',
        isPrimaryGuardian: true,
      });
      return account.id;
    });
  } finally {
    await sql.end();
  }
}

export async function createDependentStudent(input: {
  familyAccountId: string;
  actorUserId: string;
  preferredName: string;
  familyName: string | null;
  schoolYearCode: string;
  schoolOrProviderName: string | null;
}): Promise<string> {
  const { sql, db } = createDatabaseClient();
  try {
    const [profile] = await db
      .insert(studentProfiles)
      .values({
        defaultFamilyAccountId: input.familyAccountId,
        preferredName: input.preferredName,
        familyName: input.familyName,
        schoolYearCode: input.schoolYearCode,
        schoolOrProviderName: input.schoolOrProviderName,
        independenceStatusCode: 'dependent',
        loginAccessStateCode: 'parent_managed',
        createdByUserId: input.actorUserId,
        updatedByUserId: input.actorUserId,
      })
      .returning({ id: studentProfiles.id });
    if (profile === undefined) throw new Error('student profile insert returned no row');
    return profile.id;
  } finally {
    await sql.end();
  }
}

/**
 * Create (or return) the independent student's own profile. Idempotent on
 * user_id so a repeated setup submission cannot create a second profile.
 */
export async function ensureIndependentStudentProfile(input: {
  studdyUserId: string;
  preferredName: string;
  familyName: string | null;
  schoolYearCode: string;
  schoolOrProviderName: string | null;
}): Promise<string> {
  const { sql, db } = createDatabaseClient();
  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: studentProfiles.id })
        .from(studentProfiles)
        .where(
          and(
            eq(studentProfiles.userId, input.studdyUserId),
            eq(studentProfiles.statusCode, 'active'),
          ),
        );
      if (existing !== undefined) return existing.id;

      const [profile] = await tx
        .insert(studentProfiles)
        .values({
          userId: input.studdyUserId,
          preferredName: input.preferredName,
          familyName: input.familyName,
          schoolYearCode: input.schoolYearCode,
          schoolOrProviderName: input.schoolOrProviderName,
          independenceStatusCode: 'independent',
          loginAccessStateCode: 'independent_access_active',
          createdByUserId: input.studdyUserId,
          updatedByUserId: input.studdyUserId,
        })
        .returning({ id: studentProfiles.id });
      if (profile === undefined) throw new Error('student profile insert returned no row');
      return profile.id;
    });
  } finally {
    await sql.end();
  }
}

/** Students this user may act for: own profile plus dependents in their families. */
export async function listAccessibleStudents(
  studdyUserId: string,
): Promise<{ familyAccountId: string | null; students: readonly StudentRecord[] }> {
  const { sql, db } = createDatabaseClient();
  try {
    const [membership] = await db
      .select({ familyAccountId: familyMemberships.familyAccountId })
      .from(familyMemberships)
      .where(
        and(
          eq(familyMemberships.userId, studdyUserId),
          eq(familyMemberships.statusCode, 'active'),
          isNull(familyMemberships.endedAt),
        ),
      );
    const familyAccountId = membership?.familyAccountId ?? null;

    const rows = await db
      .select({
        studentProfileId: studentProfiles.id,
        reference: studentProfiles.reference,
        preferredName: studentProfiles.preferredName,
        familyName: studentProfiles.familyName,
        schoolYearCode: studentProfiles.schoolYearCode,
        schoolOrProviderName: studentProfiles.schoolOrProviderName,
        independenceStatusCode: studentProfiles.independenceStatusCode,
      })
      .from(studentProfiles)
      .where(
        and(
          eq(studentProfiles.statusCode, 'active'),
          isNull(studentProfiles.archivedAt),
          familyAccountId === null
            ? eq(studentProfiles.userId, studdyUserId)
            : or(
                eq(studentProfiles.userId, studdyUserId),
                and(
                  eq(studentProfiles.defaultFamilyAccountId, familyAccountId),
                  eq(studentProfiles.independenceStatusCode, 'dependent'),
                ),
              ),
        ),
      )
      .orderBy(studentProfiles.createdAt);

    return {
      familyAccountId,
      students: rows.map((row) => ({
        ...row,
        independenceStatusCode: row.independenceStatusCode as 'dependent' | 'independent',
      })),
    };
  } finally {
    await sql.end();
  }
}

export async function listSubjectSections(
  studentProfileIds: readonly string[],
): Promise<readonly SubjectSectionRecord[]> {
  if (studentProfileIds.length === 0) return [];
  const { sql } = createDatabaseClient();
  try {
    const rows = await sql`
      select
        section.id                as subject_section_id,
        section.student_profile_id,
        section.subject_id,
        subject.code              as subject_code,
        subject.display_name      as subject_display_name,
        section.school_year_code,
        section.format_preference_code,
        section.goals,
        (
          select count(*)
          from students.subject_section_shortlist_entries as entry
          where entry.student_subject_section_id = section.id
            and entry.status_code = 'active'
        )::int                    as shortlist_count
      from students.student_subject_sections as section
      join platform.subjects as subject on subject.id = section.subject_id
      where section.student_profile_id = any(${[...studentProfileIds]}::uuid[])
        and section.status_code = 'active'
      order by section.created_at
    `;
    return rows.map((row) => ({
      subjectSectionId: row['subject_section_id'] as string,
      studentProfileId: row['student_profile_id'] as string,
      subjectId: row['subject_id'] as string,
      subjectCode: row['subject_code'] as string,
      subjectDisplayName: row['subject_display_name'] as string,
      schoolYearCode: row['school_year_code'] as string | null,
      formatPreferenceCode: row['format_preference_code'] as string,
      goals: row['goals'] as string | null,
      shortlistCount: row['shortlist_count'] as number,
    }));
  } finally {
    await sql.end();
  }
}

export async function createSubjectSection(input: {
  studentProfileId: string;
  actorUserId: string;
  subjectId: string;
  schoolYearCode: string;
  formatPreferenceCode: string;
  goals: string | null;
}): Promise<{ subjectSectionId: string; alreadyExisted: boolean }> {
  const { sql, db } = createDatabaseClient();
  try {
    const [existing] = await db
      .select({ id: studentSubjectSections.id })
      .from(studentSubjectSections)
      .where(
        and(
          eq(studentSubjectSections.studentProfileId, input.studentProfileId),
          eq(studentSubjectSections.subjectId, input.subjectId),
          eq(studentSubjectSections.statusCode, 'active'),
        ),
      );
    if (existing !== undefined) {
      return { subjectSectionId: existing.id, alreadyExisted: true };
    }

    const [section] = await db
      .insert(studentSubjectSections)
      .values({
        studentProfileId: input.studentProfileId,
        subjectId: input.subjectId,
        schoolYearCode: input.schoolYearCode,
        formatPreferenceCode: input.formatPreferenceCode,
        goals: input.goals,
        createdByUserId: input.actorUserId,
        updatedByUserId: input.actorUserId,
      })
      .returning({ id: studentSubjectSections.id });
    if (section === undefined) throw new Error('subject section insert returned no row');
    return { subjectSectionId: section.id, alreadyExisted: false };
  } finally {
    await sql.end();
  }
}

/** Server-side authorisation: may this user act on this subject section? */
export async function subjectSectionBelongsToUser(
  subjectSectionId: string,
  studdyUserId: string,
): Promise<boolean> {
  const { sql } = createDatabaseClient();
  try {
    const rows = await sql`
      select 1
      from students.student_subject_sections as section
      join students.student_profiles as profile on profile.id = section.student_profile_id
      left join families.family_memberships as membership
        on membership.family_account_id = profile.default_family_account_id
       and membership.user_id = ${studdyUserId}
       and membership.status_code = 'active'
       and membership.ended_at is null
      where section.id = ${subjectSectionId}
        and section.status_code = 'active'
        and profile.status_code = 'active'
        and (
          profile.user_id = ${studdyUserId}
          or (profile.independence_status_code = 'dependent' and membership.id is not null)
        )
      limit 1
    `;
    return rows.length > 0;
  } finally {
    await sql.end();
  }
}

export { subjectSectionShortlistEntries };
