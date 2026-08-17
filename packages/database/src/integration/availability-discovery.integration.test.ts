import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDatabaseClient } from '../client';
import { bookableSlotsForSubjectSection } from '../repositories/availability';
import { studentSubjectSections, subjects } from '../schema/index';

/**
 * The family-facing availability surface (design §7).
 *
 * A signed-in family with a real student/subject context may see actual
 * bookable slots for any eligible tutor. These tests hold the shape of that
 * surface: derived positive slots only, scoped to the subject, at the tutor's
 * own lesson length rather than one the caller chose.
 *
 * Requires a seeded database (pnpm supabase:start && pnpm db:migrate && pnpm db:seed).
 */
const { sql, db } = createDatabaseClient();

let mathsSectionId: string;

beforeAll(async () => {
  const [maths] = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(eq(subjects.code, 'mathematics'));
  if (maths === undefined) throw new Error('no subjects seeded — run pnpm db:seed');

  const [section] = await db
    .select({ id: studentSubjectSections.id })
    .from(studentSubjectSections)
    .where(eq(studentSubjectSections.subjectId, maths.id));
  if (section !== undefined) {
    mathsSectionId = section.id;
    return;
  }

  // The seed does not guarantee a section for this subject; make one.
  const [created] = await sql<{ id: string }[]>`
    with student as (
      insert into students.student_profiles (preferred_name, independence_status_code)
      values ('Availability Fixture', 'dependent')
      returning id
    )
    insert into students.student_subject_sections (student_profile_id, subject_id, school_year_code)
    select student.id, ${maths.id}, 'Y9' from student
    returning id`;
  if (created === undefined) throw new Error('could not create a subject section fixture');
  mathsSectionId = created.id;
});

describe('bookable slots for a subject section', () => {
  const window = (): { from: Date; to: Date } => {
    const from = new Date();
    return { from, to: new Date(from.getTime() + 14 * 86_400_000) };
  };

  it('returns slots for the tutors who publish that subject', async () => {
    const results = await bookableSlotsForSubjectSection({
      subjectSectionId: mathsSectionId,
      ...window(),
    });
    expect(results.length).toBeGreaterThan(0);
    // Seeded maths tutors work weekday afternoons, so a fortnight has slots.
    expect(results.some((entry) => entry.slots.length > 0)).toBe(true);
  });

  it('carries nothing beyond the two instants', async () => {
    const results = await bookableSlotsForSubjectSection({
      subjectSectionId: mathsSectionId,
      ...window(),
    });

    for (const entry of results) {
      for (const slot of entry.slots) {
        expect(Object.keys(slot).sort()).toEqual(['endAt', 'startAt']);
      }
    }

    const serialised = JSON.stringify(results);
    expect(serialised).not.toContain('personal_commitment');
    expect(serialised).not.toContain('medical_appointment');
    expect(serialised).not.toContain('privateNote');
    expect(serialised).not.toContain('reason');
  });

  it('uses the tutor own lesson length rather than one the caller picked', async () => {
    // There is no duration parameter to pass: the surface reads it from the
    // tutor's current published service version. A caller cannot ask for
    // shorter lessons and be shown availability the tutor never offered.
    const results = await bookableSlotsForSubjectSection({
      subjectSectionId: mathsSectionId,
      ...window(),
    });
    for (const entry of results) {
      expect(entry.durationMinutes).toBeGreaterThan(0);
      for (const slot of entry.slots) {
        expect(slot.endAt.getTime() - slot.startAt.getTime()).toBe(entry.durationMinutes * 60_000);
      }
    }
  });

  it('restricts to the named tutors when asked', async () => {
    const all = await bookableSlotsForSubjectSection({
      subjectSectionId: mathsSectionId,
      ...window(),
    });
    const first = all[0];
    expect(first).toBeDefined();
    if (first === undefined) return;

    const narrowed = await bookableSlotsForSubjectSection({
      subjectSectionId: mathsSectionId,
      tutorReferences: [first.tutorReference],
      ...window(),
    });
    expect(narrowed.map((entry) => entry.tutorReference)).toEqual([first.tutorReference]);
  });

  it('excludes a tutor who is active but no longer publicly listed', async () => {
    // Status and visibility are independent axes. A tutor who stops taking new
    // students, or is quietly moderated, keeps status 'active' while their
    // visibility drops — and their reference stays valid and shareable. If
    // eligibility here checked only status, anyone holding that reference
    // could reach the tutor's calendar through a shortlist long after the
    // listing itself correctly refused them.
    const [tutor] = await sql<{ id: string; reference: string; visibility: string }[]>`
      insert into tutors.tutor_profiles
        (user_id, public_first_name, status_code, visibility_state_code, source_type_code)
      select id, 'Unlisted Fixture', 'active', 'unlisted', 'development_seed'
      from identity.users limit 1
      returning id, reference, visibility_state_code as visibility`;
    if (tutor === undefined) throw new Error('could not create an unlisted tutor fixture');

    try {
      const [subject] = await sql<{ id: string }[]>`
        select subject_id as id from students.student_subject_sections where id = ${mathsSectionId}`;
      const [service] = await sql<{ id: string }[]>`
        insert into services.services (tutor_profile_id, subject_id, display_name, status_code)
        values (${tutor.id}, ${subject!.id}, 'Unlisted service', 'published')
        returning id`;
      await sql`
        insert into services.service_versions
          (service_id, duration_minutes, price_amount_minor, currency_code, status_code)
        values (${service!.id}, 60, 4000, 'NZD', 'current')`;
      await sql`
        insert into availability.availability_rules
          (tutor_profile_id, day_of_week, local_start_time, local_end_time, iana_time_zone, effective_from)
        values (${tutor.id}, 1, '09:00', '17:00', 'Pacific/Auckland', '2026-01-01')`;

      const results = await bookableSlotsForSubjectSection({
        subjectSectionId: mathsSectionId,
        ...window(),
      });
      expect(results.map((entry) => entry.tutorReference)).not.toContain(tutor.reference);

      // Naming them directly must not work either.
      const named = await bookableSlotsForSubjectSection({
        subjectSectionId: mathsSectionId,
        tutorReferences: [tutor.reference],
        ...window(),
      });
      expect(named).toEqual([]);

      // Prove the fixture is otherwise complete, so the exclusion above is the
      // visibility predicate doing its job rather than a malformed offering:
      // list the same tutor publicly and they appear immediately.
      await sql`
        update tutors.tutor_profiles set visibility_state_code = 'public_recommended'
        where id = ${tutor.id}`;
      const nowListed = await bookableSlotsForSubjectSection({
        subjectSectionId: mathsSectionId,
        tutorReferences: [tutor.reference],
        ...window(),
      });
      expect(nowListed.map((entry) => entry.tutorReference)).toEqual([tutor.reference]);
      expect(nowListed[0]?.slots.length).toBeGreaterThan(0);
    } finally {
      await sql`delete from availability.availability_rules where tutor_profile_id = ${tutor.id}`;
      await sql`delete from services.service_versions where service_id in
        (select id from services.services where tutor_profile_id = ${tutor.id})`;
      await sql`delete from services.services where tutor_profile_id = ${tutor.id}`;
      await sql`delete from tutors.tutor_profiles where id = ${tutor.id}`;
    }
  });

  it('returns nothing for a section that does not exist', async () => {
    const results = await bookableSlotsForSubjectSection({
      subjectSectionId: '00000000-0000-4000-8000-000000000000',
      ...window(),
    });
    expect(results).toEqual([]);
  });
});
