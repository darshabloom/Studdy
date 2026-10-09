import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import type { ApplicationCheckCode, ValidatedTutorApplication } from '@studdy/domain/tutors';
import { createDatabaseClient } from '../client';
import {
  applicationForApplicant,
  applicationForReview,
  approveApplication,
  recordApplicationCheck,
  rejectApplication,
  requestApplicationChanges,
  reviewQueue,
  saveApplicationDraft,
  startTutorApplication,
  submitApplication,
  withdrawApplication,
} from '../repositories/tutor-applications';

/**
 * TUTOR APPLICATIONS — applying, being reviewed, and becoming a tutor, against a
 * real Postgres.
 *
 * WHAT IS ASSERTED IS WHAT THE DECISION TURNS ON: that nobody holds two live
 * applications, that submission freezes an immutable revision, that approval is
 * ONE transaction which creates the profile, role and labels together and refuses
 * unless every required check is verified (read under the lock, so the gate cannot
 * be raced), that two reviewers acting at once produce one tutor, that an
 * applicant never sees a reviewer's note, and that the database itself refuses the
 * states the code would never write.
 *
 * Reviewers are plain users here: this repository deliberately does not decide who
 * may review — that is `requireStaff`'s job and is proved in its own unit tests.
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

const ALL_CHECKS: readonly ApplicationCheckCode[] = [
  'identity',
  'safeguarding',
  'references',
  'interview',
];

const STAFF_NOTE = 'SECRET STAFF NOTE about the applicant';

describe.skipIf(!available)('tutor applications (integration)', () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    const { sql } = createDatabaseClient();
    try {
      if (createdUserIds.length > 0) {
        const userIds = createdUserIds;
        const apps = (
          await sql`select id::text as id from tutors.tutor_applications where applicant_user_id = any(${userIds}::uuid[])`
        ).map((row) => row['id'] as string);
        const profiles = (
          await sql`select id::text as id from tutors.tutor_profiles where user_id = any(${userIds}::uuid[])`
        ).map((row) => row['id'] as string);
        const revisions = (
          await sql`select id::text as id from tutors.tutor_application_revisions where application_id = any(${apps}::uuid[])`
        ).map((row) => row['id'] as string);
        const assignments = (
          await sql`select id::text as id from identity.user_role_assignments where user_id = any(${userIds}::uuid[])`
        ).map((row) => row['id'] as string);

        await sql`delete from tutors.tutor_verifications where tutor_profile_id = any(${profiles}::uuid[])`;
        await sql`delete from tutors.tutor_application_checks where application_id = any(${apps}::uuid[])`;
        await sql`delete from tutors.tutor_application_revision_references where revision_id = any(${revisions}::uuid[])`;
        await sql`delete from tutors.tutor_application_revision_subjects where revision_id = any(${revisions}::uuid[])`;
        await sql`delete from tutors.tutor_application_revisions where id = any(${revisions}::uuid[])`;
        await sql`delete from tutors.tutor_applications where id = any(${apps}::uuid[])`;
        await sql`delete from tutors.tutor_profiles where id = any(${profiles}::uuid[])`;

        await sql`delete from audit.status_transitions where entity_id = any(${apps})`;
        await sql`delete from audit.status_transitions where entity_id = any(${assignments})`;
        await sql`delete from audit.audit_events where entity_id = any(${apps})`;
        await sql`delete from audit.domain_events where entity_id = any(${apps})`;
        await sql`delete from audit.domain_events where entity_id = any(${assignments})`;

        await sql`delete from identity.user_role_assignments where user_id = any(${userIds}::uuid[])`;
        await sql`delete from identity.auth_identity_links where user_id = any(${userIds}::uuid[])`;
        await sql`delete from identity.users where id = any(${userIds}::uuid[])`;
        createdUserIds.length = 0;
      }
      await sql`delete from platform.rule_settings
                where setting_key = 'tutors.required_application_checks'
                  and provenance_note = 'integration test'`;
    } finally {
      await sql.end();
    }
  });

  const makeUser = async (label: string, roleCode?: string): Promise<string> => {
    const { sql } = createDatabaseClient();
    try {
      const [user] = await sql`
        insert into identity.users (display_name, preferred_name, family_name, country_code, time_zone, locale)
        values (${'Test ' + label}, 'Aroha', 'Ngata', 'NZ', 'Pacific/Auckland', 'en-NZ')
        returning id::text as id`;
      const id = user!['id'] as string;
      createdUserIds.push(id);
      await sql`
        insert into identity.auth_identity_links (user_id, provider_subject_id, authentication_email)
        values (${id}::uuid, ${randomUUID()}, ${`applicant.${label}.${randomUUID().slice(0, 6)}@example.test`})`;
      if (roleCode !== undefined) {
        await sql`
          insert into identity.user_role_assignments
            (user_id, role_definition_id, status_code, workspace_enabled, assignment_reason_code)
          values (${id}::uuid, (select id from permissions.role_definitions where code = ${roleCode}),
                  'active', true, 'integration_test')`;
      }
      return id;
    } finally {
      await sql.end();
    }
  };

  const subjectIds = async (count = 2): Promise<string[]> => {
    const { sql } = createDatabaseClient();
    try {
      const rows = await sql`
        select id::text as id from platform.subjects where status_code = 'active' order by code limit ${count}`;
      return rows.map((row) => row['id'] as string);
    } finally {
      await sql.end();
    }
  };

  const validApplication = (
    subjects: readonly string[],
    overrides: Partial<ValidatedTutorApplication> = {},
  ): ValidatedTutorApplication => ({
    legalFirstName: 'Aroha',
    legalFamilyName: 'Ngata',
    preferredFirstName: 'Aro',
    phone: '021 123 4567',
    headline: 'Patient maths tutor for years 7 to 10',
    teachingApproach: 'I start from what the student already knows and build up with examples.',
    experienceSummary: 'Five years as a secondary maths teacher and three years tutoring.',
    qualificationsSummary: 'BSc Mathematics',
    subjectIds: subjects,
    yearLevelFrom: 7,
    yearLevelTo: 10,
    offersOnline: true,
    offersInPerson: false,
    references: [
      { fullName: 'Hemi Walker', email: 'hemi@example.test', relationship: 'Former colleague' },
      { fullName: 'Mere Cook', email: 'mere@example.test', relationship: 'Parent of a student' },
    ],
    ...overrides,
  });

  /** A submitted application with a reference to review, for this applicant. */
  const submitted = async (
    overrides: Partial<ValidatedTutorApplication> = {},
  ): Promise<{ userId: string; reference: string; reviewerId: string }> => {
    const userId = await makeUser('applicant');
    const reviewerId = await makeUser('reviewer');
    const started = await startTutorApplication({ userId, correlationId: randomUUID() });
    if (started.status === 'already_a_tutor') throw new Error('unexpected');
    const result = await submitApplication({
      userId,
      application: validApplication(await subjectIds(), overrides),
      correlationId: randomUUID(),
    });
    expect(result).toEqual({ status: 'submitted', revisionNumber: 1 });
    return { userId, reference: started.reference, reviewerId };
  };

  const check = (
    reference: string,
    reviewerId: string,
    checkCode: ApplicationCheckCode,
    status: 'pending' | 'verified' | 'failed' = 'verified',
    note: string | null = null,
  ) =>
    recordApplicationCheck({
      reference,
      checkCode,
      status,
      note,
      actorUserId: reviewerId,
      correlationId: randomUUID(),
    });

  const verifyAll = async (reference: string, reviewerId: string, codes = ALL_CHECKS) => {
    for (const code of codes) await check(reference, reviewerId, code);
  };

  const approve = (reference: string, reviewerId: string) =>
    approveApplication({ reference, actorUserId: reviewerId, correlationId: randomUUID() });

  const rows = async <T extends Record<string, unknown>>(
    query: (sql: ReturnType<typeof createDatabaseClient>['sql']) => Promise<unknown>,
  ): Promise<T[]> => {
    const { sql } = createDatabaseClient();
    try {
      return (await query(sql)) as T[];
    } finally {
      await sql.end();
    }
  };

  // -------------------------------------------------------------------------

  describe('the applicant', () => {
    it('starts a draft, with a pending tutor role that grants nothing', async () => {
      const userId = await makeUser('start');
      const result = await startTutorApplication({ userId, correlationId: randomUUID() });
      expect(result.status).toBe('started');

      const [application] = await rows(
        (sql) => sql`
          select status_code, current_revision_number from tutors.tutor_applications
          where applicant_user_id = ${userId}::uuid`,
      );
      expect(application).toMatchObject({ status_code: 'draft', current_revision_number: 0 });

      const [role] = await rows(
        (sql) => sql`
          select a.status_code, a.workspace_enabled from identity.user_role_assignments a
          join permissions.role_definitions d on d.id = a.role_definition_id
          where a.user_id = ${userId}::uuid and d.code = 'tutor'`,
      );
      expect(role).toMatchObject({ status_code: 'pending', workspace_enabled: false });
    });

    it('prefills what Studdy already knows, so the form does not ask twice', async () => {
      const userId = await makeUser('prefill');
      await startTutorApplication({ userId, correlationId: randomUUID() });
      const application = await applicationForApplicant(userId);
      expect(application!.form.preferredFirstName).toBe('Aroha');
      expect(application!.form.legalFamilyName).toBe('Ngata');
      expect(application!.status).toBe('draft');
      expect(application!.editable).toBe(true);
    });

    it('is idempotent: a second start returns the same application', async () => {
      const userId = await makeUser('twice');
      const first = await startTutorApplication({ userId, correlationId: randomUUID() });
      const second = await startTutorApplication({ userId, correlationId: randomUUID() });
      expect(first.status).toBe('started');
      expect(second.status).toBe('existing');
      expect(
        'reference' in first && 'reference' in second && first.reference === second.reference,
      ).toBe(true);
    });

    /** Nobody can hold two live applications. */
    it('creates exactly one application under simultaneous starts', async () => {
      const userId = await makeUser('race');
      await Promise.all([
        startTutorApplication({ userId, correlationId: randomUUID() }),
        startTutorApplication({ userId, correlationId: randomUUID() }),
        startTutorApplication({ userId, correlationId: randomUUID() }),
      ]);
      const found = await rows(
        (sql) =>
          sql`select id from tutors.tutor_applications where applicant_user_id = ${userId}::uuid`,
      );
      expect(found).toHaveLength(1);
    });

    it('refuses someone who is already an active tutor', async () => {
      const userId = await makeUser('tutor', 'tutor');
      expect(await startTutorApplication({ userId, correlationId: randomUUID() })).toEqual({
        status: 'already_a_tutor',
      });
    });

    it('saves a draft without validating it, and finds it again', async () => {
      const userId = await makeUser('draft');
      await startTutorApplication({ userId, correlationId: randomUUID() });
      const form = {
        ...(await applicationForApplicant(userId))!.form,
        headline: 'Half-written and that is fine',
      };

      expect(await saveApplicationDraft({ userId, draft: form })).toBe('saved');
      expect((await applicationForApplicant(userId))!.form.headline).toBe(
        'Half-written and that is fine',
      );
    });

    it('reports no application when there is none to save into', async () => {
      const userId = await makeUser('nothing');
      const form = (await import('@studdy/domain/tutors')).EMPTY_TUTOR_APPLICATION;
      expect(await saveApplicationDraft({ userId, draft: form })).toBe('not_found');
    });

    /** What an applicant sees is scoped to them by the query itself. */
    it('shows nobody else’s application', async () => {
      const mine = await makeUser('mine');
      const theirs = await makeUser('theirs');
      await startTutorApplication({ userId: mine, correlationId: randomUUID() });
      expect(await applicationForApplicant(theirs)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------

  describe('submitting', () => {
    it('freezes an immutable revision, with its subjects and referees', async () => {
      const { userId, reference } = await submitted();

      const application = await applicationForApplicant(userId);
      expect(application).toMatchObject({
        reference,
        status: 'submitted',
        currentRevisionNumber: 1,
        editable: false,
      });
      expect(application!.form.headline).toBe('Patient maths tutor for years 7 to 10');
      expect(application!.form.subjectIds).toHaveLength(2);
      expect(application!.form.references.map((entry) => entry.email)).toEqual([
        'hemi@example.test',
        'mere@example.test',
      ]);

      const [revision] = await rows(
        (sql) => sql`
          select r.revision_number, r.preferred_first_name, r.declarations_version,
                 (r.declarations_accepted_at is not null) as accepted
          from tutors.tutor_application_revisions r
          join tutors.tutor_applications a on a.id = r.application_id
          where a.reference = ${reference}`,
      );
      expect(revision).toMatchObject({
        revision_number: 1,
        preferred_first_name: 'Aro',
        declarations_version: 'v1',
        accepted: true,
      });
    });

    it('creates the four checks as pending, and clears the working draft', async () => {
      const { reference } = await submitted();
      const checks = await rows(
        (sql) => sql`
          select c.check_code, c.status_code from tutors.tutor_application_checks c
          join tutors.tutor_applications a on a.id = c.application_id
          where a.reference = ${reference} order by c.check_code`,
      );
      expect(checks.map((row) => row['check_code'])).toEqual([
        'identity',
        'interview',
        'references',
        'safeguarding',
      ]);
      expect(checks.every((row) => row['status_code'] === 'pending')).toBe(true);

      const [draft] = await rows(
        (sql) =>
          sql`select draft is null as cleared from tutors.tutor_applications where reference = ${reference}`,
      );
      expect(draft!['cleared']).toBe(true);
    });

    it('records the submission in the status history and as an event', async () => {
      const { reference } = await submitted();
      const transitions = await rows(
        (sql) => sql`
          select t.from_status_code, t.to_status_code from audit.status_transitions t
          join tutors.tutor_applications a on a.id::text = t.entity_id
          where a.reference = ${reference} and t.entity_type = 'tutor_application'
          order by t.occurred_at, t.to_status_code`,
      );
      expect(transitions.map((row) => row['to_status_code']).sort()).toEqual([
        'draft',
        'submitted',
      ]);
      const events = await rows(
        (sql) => sql`
          select e.event_type from audit.domain_events e
          join tutors.tutor_applications a on a.id::text = e.entity_id
          where a.reference = ${reference}`,
      );
      expect(events.map((row) => row['event_type'])).toContain('tutor_application.submitted');
    });

    it('cannot be edited, saved over or resubmitted once submitted', async () => {
      const { userId } = await submitted();
      const form = (await applicationForApplicant(userId))!.form;
      expect(await saveApplicationDraft({ userId, draft: form })).toBe('not_editable');
      expect(
        await submitApplication({
          userId,
          application: validApplication(await subjectIds()),
          correlationId: randomUUID(),
        }),
      ).toEqual({ status: 'not_editable' });
    });

    it('writes exactly one revision under simultaneous submissions', async () => {
      const userId = await makeUser('double');
      await startTutorApplication({ userId, correlationId: randomUUID() });
      const application = validApplication(await subjectIds());
      const results = await Promise.all([
        submitApplication({ userId, application, correlationId: randomUUID() }),
        submitApplication({ userId, application, correlationId: randomUUID() }),
      ]);
      expect(results.filter((result) => result.status === 'submitted')).toHaveLength(1);
      const revisions = await rows(
        (sql) => sql`
          select r.id from tutors.tutor_application_revisions r
          join tutors.tutor_applications a on a.id = r.application_id
          where a.applicant_user_id = ${userId}::uuid`,
      );
      expect(revisions).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------

  describe('withdrawing', () => {
    it('ends the application and the pending tutor role, and allows a fresh start', async () => {
      const { userId } = await submitted();

      expect(await withdrawApplication({ userId, correlationId: randomUUID() })).toBe('withdrawn');
      expect((await applicationForApplicant(userId))!.status).toBe('withdrawn');

      const [role] = await rows(
        (sql) => sql`
          select a.status_code, a.workspace_enabled from identity.user_role_assignments a
          join permissions.role_definitions d on d.id = a.role_definition_id
          where a.user_id = ${userId}::uuid and d.code = 'tutor'`,
      );
      expect(role).toMatchObject({ status_code: 'ended', workspace_enabled: false });

      // Withdrawn is history, so a new application can begin.
      const again = await startTutorApplication({ userId, correlationId: randomUUID() });
      expect(again.status).toBe('started');
    });

    it('is refused for an approved application', async () => {
      const { userId, reference, reviewerId } = await submitted();
      await verifyAll(reference, reviewerId);
      await approve(reference, reviewerId);
      expect(await withdrawApplication({ userId, correlationId: randomUUID() })).toBe(
        'not_withdrawable',
      );
    });

    it('reports nothing to withdraw when there is no application', async () => {
      const userId = await makeUser('none');
      expect(await withdrawApplication({ userId, correlationId: randomUUID() })).toBe('not_found');
    });
  });

  // -------------------------------------------------------------------------

  describe('the review queue and the checks', () => {
    it('lists a submitted application by the name the applicant chose, not their legal name', async () => {
      const { reference } = await submitted();
      const queue = await reviewQueue({ limit: 500 });
      const entry = queue.find((candidate) => candidate.reference === reference);
      expect(entry).toBeDefined();
      expect(entry!.preferredFirstName).toBe('Aro');
      expect(entry!.status).toBe('submitted');
      expect(entry!.verifiedChecks).toBe(0);
      expect(JSON.stringify(entry)).not.toContain('Ngata');
    });

    it('does not list a draft', async () => {
      const userId = await makeUser('draftonly');
      const started = await startTutorApplication({ userId, correlationId: randomUUID() });
      const queue = await reviewQueue({ limit: 500 });
      expect(
        'reference' in started && queue.some((entry) => entry.reference === started.reference),
      ).toBe(false);
    });

    it('records a verified check against who and when, and starts the review', async () => {
      const { reference, reviewerId } = await submitted();
      expect(
        await check(reference, reviewerId, 'identity', 'verified', 'Checked in person'),
      ).toEqual({
        status: 'done',
      });

      const review = await applicationForReview(reference);
      expect(review!.status).toBe('under_review');
      const identity = review!.checks.find((entry) => entry.code === 'identity');
      expect(identity).toMatchObject({ status: 'verified', note: 'Checked in person' });
      expect(identity!.checkedAt).toBeInstanceOf(Date);
    });

    /** The audit trail records the outcome of a check, never the reviewer's words about a person. */
    it('audits a check by its outcome, not its note, and a failure as high risk', async () => {
      const { reference, reviewerId } = await submitted();
      await check(reference, reviewerId, 'safeguarding', 'failed', STAFF_NOTE);

      const audit = await rows(
        (sql) => sql`
          select e.risk_level, e.new_value::text as new_value from audit.audit_events e
          join tutors.tutor_applications a on a.id::text = e.entity_id
          where a.reference = ${reference} and e.action = 'tutor_application.check_recorded'`,
      );
      expect(audit).toHaveLength(1);
      expect(audit[0]!['risk_level']).toBe('high');
      expect(String(audit[0]!['new_value'])).not.toContain(STAFF_NOTE);
      expect(String(audit[0]!['new_value'])).toContain('safeguarding');
    });

    it('can reset a check to pending, clearing who and when', async () => {
      const { reference, reviewerId } = await submitted();
      await check(reference, reviewerId, 'identity', 'verified');
      await check(reference, reviewerId, 'identity', 'pending');
      const identity = (await applicationForReview(reference))!.checks.find(
        (entry) => entry.code === 'identity',
      );
      expect(identity).toMatchObject({ status: 'pending', checkedAt: null });
    });

    it('refuses to record a check on an application that cannot be decided', async () => {
      const { userId, reference, reviewerId } = await submitted();
      await withdrawApplication({ userId, correlationId: randomUUID() });
      expect(await check(reference, reviewerId, 'identity')).toEqual({ status: 'not_decidable' });
    });

    it('reports an application that does not exist', async () => {
      const reviewerId = await makeUser('reviewer');
      expect(await check('APP-00000000', reviewerId, 'identity')).toEqual({ status: 'not_found' });
    });
  });

  // -------------------------------------------------------------------------

  describe('approval — one controlled transaction', () => {
    const profileFor = async (userId: string) =>
      (
        await rows(
          (sql) => sql`
            select id::text as id, reference, public_first_name, headline, status_code,
                   visibility_state_code, source_type_code, year_level_from, year_level_to,
                   offers_online, offers_in_person, is_new_to_studdy
            from tutors.tutor_profiles where user_id = ${userId}::uuid`,
        )
      )[0];

    it('refuses while any required check is not verified, and creates nothing', async () => {
      const { userId, reference, reviewerId } = await submitted();
      await verifyAll(reference, reviewerId, ['identity', 'safeguarding']);

      const result = await approve(reference, reviewerId);

      expect(result).toEqual({
        status: 'checks_incomplete',
        missing: ['references', 'interview'],
        failed: [],
      });
      expect(await profileFor(userId)).toBeUndefined();
      expect((await applicationForReview(reference))!.status).toBe('under_review');
      const [role] = await rows(
        (sql) => sql`
          select a.status_code from identity.user_role_assignments a
          join permissions.role_definitions d on d.id = a.role_definition_id
          where a.user_id = ${userId}::uuid and d.code = 'tutor'`,
      );
      expect(role!['status_code']).toBe('pending');
    });

    /** A failed check is a finding against the applicant, not merely "not yet". */
    it('names a failed check separately, and refuses', async () => {
      const { reference, reviewerId } = await submitted();
      await verifyAll(reference, reviewerId, ['identity', 'references', 'interview']);
      await check(reference, reviewerId, 'safeguarding', 'failed');
      expect(await approve(reference, reviewerId)).toEqual({
        status: 'checks_incomplete',
        missing: [],
        failed: ['safeguarding'],
      });
    });

    it('creates the profile, the role, the labels and the history together', async () => {
      const { userId, reference, reviewerId } = await submitted();
      await verifyAll(reference, reviewerId);

      const result = await approve(reference, reviewerId);
      expect(result.status).toBe('approved');
      if (result.status !== 'approved') return;

      // The profile, built from the exact revision approved.
      const profile = await profileFor(userId);
      expect(profile).toMatchObject({
        id: result.tutorProfileId,
        reference: result.tutorReference,
        public_first_name: 'Aro',
        headline: 'Patient maths tutor for years 7 to 10',
        status_code: 'approved',
        visibility_state_code: 'public_recommended',
        source_type_code: 'tutor_application',
        year_level_from: 7,
        year_level_to: 10,
        offers_online: true,
        offers_in_person: false,
        is_new_to_studdy: true,
      });

      // The role and workspace are now live.
      const [role] = await rows(
        (sql) => sql`
          select a.status_code, a.workspace_enabled from identity.user_role_assignments a
          join permissions.role_definitions d on d.id = a.role_definition_id
          where a.user_id = ${userId}::uuid and d.code = 'tutor'`,
      );
      expect(role).toMatchObject({ status_code: 'active', workspace_enabled: true });

      // Public labels for identity, references and interview — and none for safeguarding.
      const labels = await rows(
        (sql) => sql`
          select label_code from tutors.tutor_verifications
          where tutor_profile_id = ${result.tutorProfileId}::uuid and status_code = 'active'
          order by label_code`,
      );
      expect(labels.map((row) => row['label_code'])).toEqual([
        'identity_verified',
        'interviewed',
        'references_completed',
      ]);

      // The application names the revision approved and the profile it made.
      const [application] = await rows(
        (sql) => sql`
          select status_code, approved_revision_number, tutor_profile_id::text as profile_id,
                 (decided_at is not null) as decided
          from tutors.tutor_applications where reference = ${reference}`,
      );
      expect(application).toMatchObject({
        status_code: 'approved',
        approved_revision_number: 1,
        profile_id: result.tutorProfileId,
        decided: true,
      });

      // The record of what happened.
      const audit = await rows(
        (sql) => sql`
          select e.risk_level from audit.audit_events e
          join tutors.tutor_applications a on a.id::text = e.entity_id
          where a.reference = ${reference} and e.action = 'tutor_application.approved'`,
      );
      expect(audit).toHaveLength(1);
      expect(audit[0]!['risk_level']).toBe('high');
      const events = await rows(
        (sql) => sql`
          select e.event_type from audit.domain_events e
          join tutors.tutor_applications a on a.id::text = e.entity_id
          where a.reference = ${reference}`,
      );
      expect(events.map((row) => row['event_type'])).toContain('tutor.approved');
    });

    /** Approval makes a person a tutor. It does not put anything on sale. */
    it('does not list the tutor in discovery, because they have no published service', async () => {
      const { reference, reviewerId } = await submitted();
      await verifyAll(reference, reviewerId);
      const result = await approve(reference, reviewerId);
      if (result.status !== 'approved') throw new Error('expected approval');

      const listed = await rows(
        (sql) =>
          sql`select 1 from public.public_tutor_search where tutor_reference = ${result.tutorReference}`,
      );
      expect(listed).toHaveLength(0);
    });

    it('lets exactly one of several simultaneous approvals through, and makes one tutor', async () => {
      const { userId, reference, reviewerId } = await submitted();
      await verifyAll(reference, reviewerId);

      const results = await Promise.all([
        approve(reference, reviewerId),
        approve(reference, reviewerId),
        approve(reference, reviewerId),
      ]);

      expect(results.filter((result) => result.status === 'approved')).toHaveLength(1);
      for (const result of results) {
        if (result.status !== 'approved') expect(result.status).toBe('not_decidable');
      }
      const profiles = await rows(
        (sql) => sql`select id from tutors.tutor_profiles where user_id = ${userId}::uuid`,
      );
      expect(profiles).toHaveLength(1);
    });

    it('refuses when the person already has a tutor profile, and changes nothing', async () => {
      const { userId, reference, reviewerId } = await submitted();
      await verifyAll(reference, reviewerId);
      await rows(
        (sql) => sql`
          insert into tutors.tutor_profiles (user_id, public_first_name, status_code)
          values (${userId}::uuid, 'Existing', 'active') returning id`,
      );

      expect(await approve(reference, reviewerId)).toEqual({ status: 'profile_exists' });
      expect((await applicationForReview(reference))!.status).toBe('under_review');
    });

    it('cannot be decided twice', async () => {
      const { reference, reviewerId } = await submitted();
      await verifyAll(reference, reviewerId);
      await approve(reference, reviewerId);

      expect((await approve(reference, reviewerId)).status).toBe('not_decidable');
      expect(
        await rejectApplication({
          reference,
          message: 'Too late',
          actorUserId: reviewerId,
          correlationId: randomUUID(),
        }),
      ).toEqual({ status: 'not_decidable' });
    });

    it('reports an application that does not exist', async () => {
      const reviewerId = await makeUser('reviewer');
      expect(await approve('APP-00000000', reviewerId)).toEqual({ status: 'not_found' });
    });
  });

  // -------------------------------------------------------------------------

  describe('the required checks are a rule, and it fails closed', () => {
    const setRule = async (value: unknown) => {
      await rows(
        (sql) => sql`
          insert into platform.rule_settings (setting_key, version_number, value, status_code, provenance_note)
          values ('tutors.required_application_checks', 1, ${JSON.stringify(value)}::jsonb, 'current',
                  'integration test')
          returning id`,
      );
    };

    it('asks only for what the rule asks for', async () => {
      await setRule(['identity']);
      const { userId, reference, reviewerId } = await submitted();
      await check(reference, reviewerId, 'identity');

      const result = await approve(reference, reviewerId);
      expect(result.status).toBe('approved');

      // And the public labels follow what was actually required and verified.
      const labels = await rows(
        (sql) => sql`
          select v.label_code from tutors.tutor_verifications v
          join tutors.tutor_profiles p on p.id = v.tutor_profile_id
          where p.user_id = ${userId}::uuid`,
      );
      expect(labels.map((row) => row['label_code'])).toEqual(['identity_verified']);
    });

    /** An empty rule would mean "approve anyone", and must never come from a typo. */
    it('falls back to all four checks for an empty or malformed rule', async () => {
      await setRule([]);
      const { reference, reviewerId } = await submitted();
      await check(reference, reviewerId, 'identity');

      expect(await approve(reference, reviewerId)).toMatchObject({ status: 'checks_incomplete' });
      expect((await applicationForReview(reference))!.requiredChecks).toEqual(ALL_CHECKS);
    });

    it('defaults to all four checks when there is no rule at all', async () => {
      const { reference } = await submitted();
      expect((await applicationForReview(reference))!.requiredChecks).toEqual(ALL_CHECKS);
    });
  });

  // -------------------------------------------------------------------------

  describe('changes and decline', () => {
    it('asks for changes, shows the applicant the message, and never the reviewer’s note', async () => {
      const { userId, reference, reviewerId } = await submitted();

      expect(
        await requestApplicationChanges({
          reference,
          message: 'Please say more about your experience.',
          internalNote: STAFF_NOTE,
          actorUserId: reviewerId,
          correlationId: randomUUID(),
        }),
      ).toEqual({ status: 'done' });

      const application = await applicationForApplicant(userId);
      expect(application).toMatchObject({
        status: 'changes_requested',
        applicantMessage: 'Please say more about your experience.',
        editable: true,
      });
      // The applicant's view has nowhere to put a reviewer's note.
      expect(JSON.stringify(application)).not.toContain(STAFF_NOTE);
      // The reviewer still sees it.
      expect((await applicationForReview(reference))!.internalNote).toBe(STAFF_NOTE);
    });

    it('lets the applicant edit and resubmit as a new revision, and approval names that one', async () => {
      const { userId, reference, reviewerId } = await submitted();
      await requestApplicationChanges({
        reference,
        message: 'Please improve the headline.',
        actorUserId: reviewerId,
        correlationId: randomUUID(),
      });

      const result = await submitApplication({
        userId,
        application: validApplication(await subjectIds(), {
          headline: 'Maths and physics tutor, years 7 to 13',
        }),
        correlationId: randomUUID(),
      });
      expect(result).toEqual({ status: 'submitted', revisionNumber: 2 });

      // The old message answered the old revision.
      expect((await applicationForApplicant(userId))!.applicantMessage).toBeNull();

      await verifyAll(reference, reviewerId);
      const approved = await approve(reference, reviewerId);
      if (approved.status !== 'approved') throw new Error('expected approval');

      const [application] = await rows(
        (sql) =>
          sql`select approved_revision_number from tutors.tutor_applications where reference = ${reference}`,
      );
      expect(application!['approved_revision_number']).toBe(2);
      const [profile] = await rows(
        (sql) =>
          sql`select headline from tutors.tutor_profiles where id = ${approved.tutorProfileId}::uuid`,
      );
      expect(profile!['headline']).toBe('Maths and physics tutor, years 7 to 13');
    });

    it('keeps both revisions as history', async () => {
      const { userId, reference, reviewerId } = await submitted();
      await requestApplicationChanges({
        reference,
        message: 'Again please.',
        actorUserId: reviewerId,
        correlationId: randomUUID(),
      });
      await submitApplication({
        userId,
        application: validApplication(await subjectIds()),
        correlationId: randomUUID(),
      });
      const revisions = await rows(
        (sql) => sql`
          select r.revision_number from tutors.tutor_application_revisions r
          join tutors.tutor_applications a on a.id = r.application_id
          where a.reference = ${reference} order by r.revision_number`,
      );
      expect(revisions.map((row) => row['revision_number'])).toEqual([1, 2]);
    });

    it('declines, tells the applicant, and ends their pending tutor role', async () => {
      const { userId, reference, reviewerId } = await submitted();

      expect(
        await rejectApplication({
          reference,
          message: 'We are not able to approve this application.',
          actorUserId: reviewerId,
          correlationId: randomUUID(),
        }),
      ).toEqual({ status: 'done' });

      expect(await applicationForApplicant(userId)).toMatchObject({
        status: 'rejected',
        applicantMessage: 'We are not able to approve this application.',
        editable: false,
      });
      const [role] = await rows(
        (sql) => sql`
          select a.status_code from identity.user_role_assignments a
          join permissions.role_definitions d on d.id = a.role_definition_id
          where a.user_id = ${userId}::uuid and d.code = 'tutor'`,
      );
      expect(role!['status_code']).toBe('ended');

      const audit = await rows(
        (sql) => sql`
          select e.risk_level from audit.audit_events e
          join tutors.tutor_applications a on a.id::text = e.entity_id
          where a.reference = ${reference} and e.action = 'tutor_application.rejected'`,
      );
      expect(audit[0]!['risk_level']).toBe('high');
    });

    it('lets someone who was declined apply again later', async () => {
      const { userId, reference, reviewerId } = await submitted();
      await rejectApplication({
        reference,
        message: 'Not this time.',
        actorUserId: reviewerId,
        correlationId: randomUUID(),
      });
      expect((await startTutorApplication({ userId, correlationId: randomUUID() })).status).toBe(
        'started',
      );
    });
  });

  // -------------------------------------------------------------------------

  describe('the database refuses what the code would never write', () => {
    it('refuses a second live application for one person', async () => {
      const userId = await makeUser('dup');
      await startTutorApplication({ userId, correlationId: randomUUID() });
      await expect(
        rows(
          (sql) => sql`
            insert into tutors.tutor_applications (applicant_user_id, status_code)
            values (${userId}::uuid, 'draft')`,
        ),
      ).rejects.toThrow(/tutor_application_live_per_applicant_unique_idx|duplicate key/);
    });

    it('refuses an approved application with no profile', async () => {
      const userId = await makeUser('noprofile');
      await expect(
        rows(
          (sql) => sql`
            insert into tutors.tutor_applications
              (applicant_user_id, status_code, current_revision_number, decided_at, decided_by_user_id)
            values (${userId}::uuid, 'approved', 1, now(), ${userId}::uuid)`,
        ),
      ).rejects.toThrow(/tutor_application_approved_complete_check/);
    });

    it('refuses a submitted application with no revision', async () => {
      const userId = await makeUser('norev');
      await expect(
        rows(
          (sql) => sql`
            insert into tutors.tutor_applications (applicant_user_id, status_code, current_revision_number)
            values (${userId}::uuid, 'submitted', 0)`,
        ),
      ).rejects.toThrow(/tutor_application_submitted_has_revision_check/);
    });

    it('refuses a check result that does not say who reached it', async () => {
      const { reference } = await submitted();
      await expect(
        rows(
          (sql) => sql`
            update tutors.tutor_application_checks set status_code = 'verified'
            where check_code = 'identity'
              and application_id = (select id from tutors.tutor_applications where reference = ${reference})`,
        ),
      ).rejects.toThrow(/tutor_application_check_attributed_check/);
    });

    it('refuses a revision with a nonsensical year range', async () => {
      const { reference } = await submitted();
      await expect(
        rows(
          (sql) => sql`
            insert into tutors.tutor_application_revisions
              (application_id, revision_number, legal_first_name, legal_family_name,
               preferred_first_name, headline, teaching_approach, experience_summary,
               year_level_from, year_level_to, offers_online, offers_in_person,
               declarations_version, declarations_accepted_at)
            select id, 9, 'a', 'b', 'c', 'h', 't', 'e', 10, 7, true, false, 'v1', now()
            from tutors.tutor_applications where reference = ${reference}`,
        ),
      ).rejects.toThrow(/tutor_application_revision_years_check/);
    });

    it('refuses a revision that offers no format', async () => {
      const { reference } = await submitted();
      await expect(
        rows(
          (sql) => sql`
            insert into tutors.tutor_application_revisions
              (application_id, revision_number, legal_first_name, legal_family_name,
               preferred_first_name, headline, teaching_approach, experience_summary,
               year_level_from, year_level_to, offers_online, offers_in_person,
               declarations_version, declarations_accepted_at)
            select id, 9, 'a', 'b', 'c', 'h', 't', 'e', 7, 10, false, false, 'v1', now()
            from tutors.tutor_applications where reference = ${reference}`,
        ),
      ).rejects.toThrow(/tutor_application_revision_format_check/);
    });

    it('refuses a second revision with the same number', async () => {
      const { reference } = await submitted();
      await expect(
        rows(
          (sql) => sql`
            insert into tutors.tutor_application_revisions
              (application_id, revision_number, legal_first_name, legal_family_name,
               preferred_first_name, headline, teaching_approach, experience_summary,
               year_level_from, year_level_to, offers_online, offers_in_person,
               declarations_version, declarations_accepted_at)
            select id, 1, 'a', 'b', 'c', 'h', 't', 'e', 7, 10, true, false, 'v1', now()
            from tutors.tutor_applications where reference = ${reference}`,
        ),
      ).rejects.toThrow(/tutor_application_revision_number_unique_idx|duplicate key/);
    });
  });
});
