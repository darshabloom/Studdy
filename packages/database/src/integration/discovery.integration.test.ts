import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDatabaseClient } from '../client';
import {
  addToShortlist,
  listShortlist,
  removeFromShortlist,
  searchPublicTutors,
} from '../repositories/discovery';
import {
  createDependentStudent,
  createSubjectSection,
  ensureFamilyAccountForGuardian,
  listAccessibleStudents,
  listSubjects,
} from '../repositories/students';
import { authIdentityLinks, subjects, users } from '../schema/index';

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

async function createGuardian(label: string): Promise<{ userId: string; authId: string }> {
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
      authenticationEmail: `${label.toLowerCase().replaceAll(' ', '.')}.${authId.slice(0, 8)}@local.studdy.test`,
    });
    return { userId: user.id, authId };
  } finally {
    await sql.end();
  }
}

async function familyWithSubjectSection(label: string): Promise<{
  userId: string;
  authId: string;
  studentProfileId: string;
  subjectSectionId: string;
}> {
  const guardian = await createGuardian(label);
  const familyAccountId = await ensureFamilyAccountForGuardian({
    studdyUserId: guardian.userId,
    displayName: `${label} family`,
    countryCode: 'NZ',
    currencyCode: 'NZD',
  });
  const studentProfileId = await createDependentStudent({
    familyAccountId,
    actorUserId: guardian.userId,
    preferredName: 'Test Student',
    familyName: null,
    schoolYearCode: 'year_9',
    schoolOrProviderName: null,
  });
  const allSubjects = await listSubjects();
  const maths = allSubjects.find((subject) => subject.code === 'mathematics') ?? allSubjects[0];
  if (maths === undefined) throw new Error('no subjects seeded — run pnpm db:seed');
  const { subjectSectionId } = await createSubjectSection({
    studentProfileId,
    actorUserId: guardian.userId,
    subjectId: maths.subjectId,
    schoolYearCode: 'year_9',
    formatPreferenceCode: 'either',
    goals: null,
  });
  return { ...guardian, studentProfileId, subjectSectionId };
}

describe.skipIf(!available)('public tutor discovery (integration)', () => {
  it('returns seeded tutors with correctly paired price and currency', async () => {
    const results = await searchPublicTutors({});
    expect(results.length).toBeGreaterThan(0);
    for (const tutor of results) {
      expect(tutor.currencyCode).toBe('NZD');
      expect(tutor.startingPriceAmountMinor).toBeGreaterThan(0n);
      expect(tutor.startingPriceDurationMinutes).toBeGreaterThan(0);
    }
  });

  it('never exposes a suspended tutor', async () => {
    const results = await searchPublicTutors({});
    expect(results.some((tutor) => tutor.firstName === 'Riley')).toBe(false);
  });

  it('filters by subject and by year level', async () => {
    const english = await searchPublicTutors({ subjectCode: 'english' });
    expect(english.length).toBeGreaterThan(0);
    expect(english.every((tutor) => tutor.subjectCode === 'english')).toBe(true);

    // Aroha teaches Years 7-10 only, so a Year 13 search must exclude her.
    const seniors = await searchPublicTutors({ subjectCode: 'mathematics', schoolYearNumber: 13 });
    expect(seniors.some((tutor) => tutor.firstName === 'Aroha')).toBe(false);
  });

  it('filters by maximum price', async () => {
    const cheap = await searchPublicTutors({ maxPriceAmountMinor: 4000n });
    expect(cheap.every((tutor) => tutor.startingPriceAmountMinor <= 4000n)).toBe(true);
  });
});

describe.skipIf(!available)('shortlist (integration)', () => {
  it('saves tutors, caps at three, and survives removal', async () => {
    const family = await familyWithSubjectSection('Shortlist Guardian');
    const tutors = await searchPublicTutors({ subjectCode: 'mathematics' });
    const allTutors = await searchPublicTutors({});
    const references = [...new Set(allTutors.map((tutor) => tutor.tutorReference))];
    expect(references.length).toBeGreaterThanOrEqual(3);
    expect(tutors.length).toBeGreaterThan(0);

    for (const reference of references.slice(0, 3)) {
      const outcome = await addToShortlist({
        subjectSectionId: family.subjectSectionId,
        tutorReference: reference,
        actorUserId: family.userId,
      });
      expect(outcome.kind).toBe('added');
    }

    const saved = await listShortlist(family.subjectSectionId);
    expect(saved).toHaveLength(3);
    expect(saved.map((entry) => entry.position)).toEqual([1, 2, 3]);

    // A fourth is refused, not an error page.
    const fourth = references[3];
    if (fourth !== undefined) {
      const outcome = await addToShortlist({
        subjectSectionId: family.subjectSectionId,
        tutorReference: fourth,
        actorUserId: family.userId,
      });
      expect(outcome.kind).toBe('full');
    }

    // Removing frees the slot for someone else.
    const first = saved[0];
    if (first === undefined) throw new Error('expected a saved entry');
    await removeFromShortlist({
      subjectSectionId: family.subjectSectionId,
      entryId: first.entryId,
    });
    const afterRemoval = await listShortlist(family.subjectSectionId);
    expect(afterRemoval).toHaveLength(2);
  });

  it('adding the same tutor twice is idempotent', async () => {
    const family = await familyWithSubjectSection('Duplicate Guardian');
    const [tutor] = await searchPublicTutors({});
    if (tutor === undefined) throw new Error('no tutors seeded');
    const first = await addToShortlist({
      subjectSectionId: family.subjectSectionId,
      tutorReference: tutor.tutorReference,
      actorUserId: family.userId,
    });
    const second = await addToShortlist({
      subjectSectionId: family.subjectSectionId,
      tutorReference: tutor.tutorReference,
      actorUserId: family.userId,
    });
    expect(first.kind).toBe('added');
    expect(second.kind).toBe('already_present');
    expect(await listShortlist(family.subjectSectionId)).toHaveLength(1);
  });

  /**
   * The cap must hold when two requests race for the last slot. Application
   * code cannot guarantee this — the database does, via CHECK(position 1..3)
   * plus a partial unique index on (section, position) WHERE active.
   */
  it('cannot exceed three under concurrent inserts racing for the last slot', async () => {
    const family = await familyWithSubjectSection('Race Guardian');
    const allTutors = await searchPublicTutors({});
    const references = [...new Set(allTutors.map((tutor) => tutor.tutorReference))];
    expect(references.length).toBeGreaterThanOrEqual(3);

    // Fire every add simultaneously rather than sequentially.
    const outcomes = await Promise.all(
      references.map((reference) =>
        addToShortlist({
          subjectSectionId: family.subjectSectionId,
          tutorReference: reference,
          actorUserId: family.userId,
        }),
      ),
    );

    const saved = await listShortlist(family.subjectSectionId);
    expect(saved.length).toBeLessThanOrEqual(3);
    expect(new Set(saved.map((entry) => entry.position)).size).toBe(saved.length);
    expect(outcomes.filter((outcome) => outcome.kind === 'added').length).toBe(saved.length);
  });
});

describe.skipIf(!available)('family and student records (integration)', () => {
  it('creates a family lazily and lists only that family’s students', async () => {
    const familyA = await familyWithSubjectSection('Isolation Guardian A');
    const familyB = await familyWithSubjectSection('Isolation Guardian B');

    const visibleToA = await listAccessibleStudents(familyA.userId);
    const visibleToB = await listAccessibleStudents(familyB.userId);

    const idsA = visibleToA.students.map((student) => student.studentProfileId);
    const idsB = visibleToB.students.map((student) => student.studentProfileId);

    expect(idsA).toContain(familyA.studentProfileId);
    expect(idsA).not.toContain(familyB.studentProfileId);
    expect(idsB).toContain(familyB.studentProfileId);
    expect(idsB).not.toContain(familyA.studentProfileId);
  });

  it('creating the same subject twice returns the existing section', async () => {
    const family = await familyWithSubjectSection('Duplicate Subject Guardian');
    const { sql, db } = createDatabaseClient();
    let subjectId: string;
    try {
      const [maths] = await db.select().from(subjects).where(eq(subjects.code, 'mathematics'));
      if (maths === undefined) throw new Error('subjects not seeded');
      subjectId = maths.id;
    } finally {
      await sql.end();
    }
    const again = await createSubjectSection({
      studentProfileId: family.studentProfileId,
      actorUserId: family.userId,
      subjectId,
      schoolYearCode: 'year_9',
      formatPreferenceCode: 'either',
      goals: null,
    });
    expect(again.alreadyExisted).toBe(true);
    expect(again.subjectSectionId).toBe(family.subjectSectionId);
  });
});
