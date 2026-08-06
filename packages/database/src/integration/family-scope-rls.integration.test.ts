import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createDatabaseClient } from '../client';
import {
  createDependentStudent,
  createSubjectSection,
  ensureFamilyAccountForGuardian,
  ensureIndependentStudentProfile,
  listSubjects,
} from '../repositories/students';
import { addToShortlist } from '../repositories/discovery';
import { searchPublicTutors } from '../repositories/discovery';
import { authIdentityLinks, users } from '../schema/index';

/**
 * RLS negatives for family scope and the public tutor boundary
 * (Database spec §13.6; brief §8). Roles are switched inside a transaction
 * with JWT claims set, mirroring how PostgREST executes browser queries.
 */

async function databaseAvailable(): Promise<boolean> {
  try {
    const { sql } = createDatabaseClient();
    await sql`select 1`;
    await sql.end();
    return true;
  } catch {
    return false;
  }
}

const available = await databaseAvailable();

function claims(authId: string): string {
  return JSON.stringify({ sub: authId, role: 'authenticated' });
}

interface Actor {
  userId: string;
  authId: string;
}

async function createActor(label: string): Promise<Actor> {
  const { sql, db } = createDatabaseClient();
  try {
    const [user] = await db
      .insert(users)
      .values({
        displayName: label,
        countryCode: 'NZ',
        timeZone: 'Pacific/Auckland',
        locale: 'en-NZ',
      })
      .returning({ id: users.id });
    if (user === undefined) throw new Error('insert failed');
    const authId = randomUUID();
    await db.insert(authIdentityLinks).values({
      userId: user.id,
      providerSubjectId: authId,
      authenticationEmail: `rls.${authId.slice(0, 8)}@local.studdy.test`,
    });
    return { userId: user.id, authId };
  } finally {
    await sql.end();
  }
}

async function guardianWithStudent(
  label: string,
): Promise<Actor & { studentProfileId: string; subjectSectionId: string }> {
  const actor = await createActor(label);
  const familyAccountId = await ensureFamilyAccountForGuardian({
    studdyUserId: actor.userId,
    displayName: `${label} family`,
    countryCode: 'NZ',
    currencyCode: 'NZD',
  });
  const studentProfileId = await createDependentStudent({
    familyAccountId,
    actorUserId: actor.userId,
    preferredName: label,
    familyName: null,
    schoolYearCode: 'year_8',
    schoolOrProviderName: null,
  });
  const allSubjects = await listSubjects();
  const subject = allSubjects[0];
  if (subject === undefined) throw new Error('subjects not seeded');
  const { subjectSectionId } = await createSubjectSection({
    studentProfileId,
    actorUserId: actor.userId,
    subjectId: subject.subjectId,
    schoolYearCode: 'year_8',
    formatPreferenceCode: 'either',
    goals: null,
  });
  return { ...actor, studentProfileId, subjectSectionId };
}

describe.skipIf(!available)('family scope RLS (integration)', () => {
  it('a guardian cannot read another family’s students, sections or shortlists', async () => {
    const familyA = await guardianWithStudent('Rls Family A');
    const familyB = await guardianWithStudent('Rls Family B');

    const [tutor] = await searchPublicTutors({});
    if (tutor === undefined) throw new Error('no tutors seeded');
    await addToShortlist({
      subjectSectionId: familyB.subjectSectionId,
      tutorReference: tutor.tutorReference,
      actorUserId: familyB.userId,
    });

    const { sql } = createDatabaseClient();
    try {
      const visible = await sql.begin(async (tx) => {
        await tx`select set_config('request.jwt.claims', ${claims(familyA.authId)}, true)`;
        await tx`set local role authenticated`;
        const students = await tx`select id from students.student_profiles`;
        const sections = await tx`select id from students.student_subject_sections`;
        const shortlists = await tx`select id from students.subject_section_shortlist_entries`;
        const families = await tx`select id from families.family_accounts`;
        return { students, sections, shortlists, families };
      });

      const studentIds = visible.students.map((row) => row['id']);
      expect(studentIds).toContain(familyA.studentProfileId);
      expect(studentIds).not.toContain(familyB.studentProfileId);

      const sectionIds = visible.sections.map((row) => row['id']);
      expect(sectionIds).toContain(familyA.subjectSectionId);
      expect(sectionIds).not.toContain(familyB.subjectSectionId);

      // Family B's shortlist entry must be invisible to family A.
      expect(visible.shortlists).toHaveLength(0);
      expect(visible.families).toHaveLength(1);
    } finally {
      await sql.end();
    }
  });

  it('an independent student’s records are not readable by an unrelated user', async () => {
    const independent = await createActor('Rls Independent');
    await ensureIndependentStudentProfile({
      studdyUserId: independent.userId,
      preferredName: 'Independent',
      familyName: null,
      schoolYearCode: 'year_13',
      schoolOrProviderName: null,
    });
    const other = await createActor('Rls Stranger');

    const { sql } = createDatabaseClient();
    try {
      const rows = await sql.begin(async (tx) => {
        await tx`select set_config('request.jwt.claims', ${claims(other.authId)}, true)`;
        await tx`set local role authenticated`;
        return await tx`select id from students.student_profiles`;
      });
      expect(rows).toHaveLength(0);
    } finally {
      await sql.end();
    }
  });

  it('an independent student reads their own profile', async () => {
    const independent = await createActor('Rls Self Reader');
    const profileId = await ensureIndependentStudentProfile({
      studdyUserId: independent.userId,
      preferredName: 'Self',
      familyName: null,
      schoolYearCode: 'year_12',
      schoolOrProviderName: null,
    });

    const { sql } = createDatabaseClient();
    try {
      const rows = await sql.begin(async (tx) => {
        await tx`select set_config('request.jwt.claims', ${claims(independent.authId)}, true)`;
        await tx`set local role authenticated`;
        return await tx`select id from students.student_profiles`;
      });
      expect(rows.map((row) => row['id'])).toEqual([profileId]);
    } finally {
      await sql.end();
    }
  });
});

describe.skipIf(!available)('public tutor boundary (integration)', () => {
  it('anonymous visitors cannot read the tutor tables directly', async () => {
    const { sql } = createDatabaseClient();
    try {
      for (const table of [
        'tutors.tutor_profiles',
        'tutors.tutor_verifications',
        'services.services',
      ]) {
        await expect(
          sql.begin(async (tx) => {
            await tx`set local role anon`;
            return await tx.unsafe(`select * from ${table} limit 1`);
          }),
        ).rejects.toThrow(/permission denied/);
      }
    } finally {
      await sql.end();
    }
  });

  it('anonymous visitors can read the public view, and it exposes approved fields only', async () => {
    const { sql } = createDatabaseClient();
    try {
      const rows = await sql.begin(async (tx) => {
        await tx`set local role anon`;
        return await tx`select * from public.public_tutor_search order by first_name`;
      });
      expect(rows.length).toBeGreaterThan(0);

      const columns = Object.keys(rows[0] ?? {});
      // Nothing internal or personally identifying may appear.
      for (const forbidden of [
        'user_id',
        'source_type_code',
        'status_code',
        'visibility_state_code',
        'family_name',
        'email',
        'phone',
        'id',
      ]) {
        expect(columns).not.toContain(forbidden);
      }
      expect(columns).toContain('first_name');
      expect(columns).toContain('starting_price_amount_minor');

      // The suspended fixture must not be reachable even anonymously.
      expect(rows.some((row) => row['first_name'] === 'Riley')).toBe(false);
    } finally {
      await sql.end();
    }
  });

  it('a signed-in user cannot read tutor identity linkage through the base table', async () => {
    const actor = await createActor('Rls Curious User');
    const { sql } = createDatabaseClient();
    try {
      await expect(
        sql.begin(async (tx) => {
          await tx`select set_config('request.jwt.claims', ${claims(actor.authId)}, true)`;
          await tx`set local role authenticated`;
          return await tx`select user_id from tutors.tutor_profiles limit 1`;
        }),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await sql.end();
    }
  });
});
