import { randomUUID } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ApplicationCheckCode, ValidatedTutorApplication } from '@studdy/domain/tutors';
import { createDatabaseClient } from '../client';
import { claimNotificationWork, type NotificationWorkItem } from '../repositories/notifications';
import {
  approveApplication,
  recordApplicationCheck,
  rejectApplication,
  requestApplicationChanges,
  startTutorApplication,
  submitApplication,
} from '../repositories/tutor-applications';
import {
  approveTutorService,
  createTutorService,
  requestTutorServiceChanges,
  submitTutorService,
} from '../repositories/tutor-services';

/**
 * TUTOR ONBOARDING EMAILS — who is told, and what they are told, against a real
 * Postgres.
 *
 * The copy is tested where the templates live. What is asserted HERE is what only
 * the database can prove: that each real repository call queues its event in the
 * same transaction, that the event resolves to the right PERSON (the applicant
 * who owns the application, the tutor who owns the service, operations, and
 * nobody else), and that the facts handed to a template contain none of what an
 * application holds that an email must never carry: a legal name, a phone number,
 * a referee's address, or a reviewer's words.
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

const OPS = 'ops@studdy.example';
const REVIEWER_WORDS = 'REVIEWER WORDS that belong behind a sign-in';
const ALL_CHECKS: readonly ApplicationCheckCode[] = [
  'identity',
  'safeguarding',
  'references',
  'interview',
];

describe.skipIf(!available)('tutor onboarding notifications (integration)', () => {
  /*
   * The drain claims whatever is pending, so the queue is cleared of anything an
   * earlier file left behind, exactly as the notifications suite does.
   */
  beforeAll(async () => {
    const { sql } = createDatabaseClient();
    try {
      await sql`
        update audit.outbox_entries
        set status_code = 'superseded', processed_at = now(), updated_at = now()
        where status_code = 'pending'`;
    } finally {
      await sql.end();
    }
  });

  const createdUserIds: string[] = [];

  afterEach(async () => {
    if (createdUserIds.length === 0) return;
    const { sql } = createDatabaseClient();
    try {
      const userIds = createdUserIds;
      const apps = (
        await sql`select id::text as id from tutors.tutor_applications where applicant_user_id = any(${userIds}::uuid[])`
      ).map((row) => row['id'] as string);
      const profiles = (
        await sql`select id::text as id from tutors.tutor_profiles where user_id = any(${userIds}::uuid[])`
      ).map((row) => row['id'] as string);
      const serviceIds = (
        await sql`select id::text as id from services.services where tutor_profile_id = any(${profiles}::uuid[])`
      ).map((row) => row['id'] as string);
      const revisions = (
        await sql`select id::text as id from tutors.tutor_application_revisions where application_id = any(${apps}::uuid[])`
      ).map((row) => row['id'] as string);
      const assignments = (
        await sql`select id::text as id from identity.user_role_assignments where user_id = any(${userIds}::uuid[])`
      ).map((row) => row['id'] as string);

      const entries = (
        await sql`
          select id::text as id from audit.outbox_entries
          where payload->>'applicationId' = any(${apps}) or payload->>'serviceId' = any(${serviceIds})`
      ).map((row) => row['id'] as string);
      await sql`delete from communications.notification_deliveries where outbox_entry_id = any(${entries}::uuid[])`;
      await sql`delete from audit.outbox_entries where id = any(${entries}::uuid[])`;

      await sql`delete from services.service_reviews where service_id = any(${serviceIds}::uuid[])`;
      await sql`delete from services.service_versions where service_id = any(${serviceIds}::uuid[])`;
      await sql`delete from services.services where id = any(${serviceIds}::uuid[])`;

      await sql`delete from tutors.tutor_verifications where tutor_profile_id = any(${profiles}::uuid[])`;
      await sql`delete from tutors.tutor_application_checks where application_id = any(${apps}::uuid[])`;
      await sql`delete from tutors.tutor_application_revision_references where revision_id = any(${revisions}::uuid[])`;
      await sql`delete from tutors.tutor_application_revision_subjects where revision_id = any(${revisions}::uuid[])`;
      await sql`delete from tutors.tutor_application_revisions where id = any(${revisions}::uuid[])`;
      await sql`delete from tutors.tutor_applications where id = any(${apps}::uuid[])`;
      await sql`delete from tutors.tutor_profiles where id = any(${profiles}::uuid[])`;

      const entityIds = [...apps, ...profiles, ...serviceIds, ...assignments];
      await sql`delete from audit.status_transitions where entity_id = any(${entityIds})`;
      await sql`delete from audit.status_transitions where actor_user_id = any(${userIds}::uuid[])`;
      await sql`delete from audit.audit_events where entity_id = any(${entityIds})`;
      await sql`delete from audit.audit_events where actor_user_id = any(${userIds}::uuid[])`;
      await sql`delete from audit.domain_events where entity_id = any(${entityIds})`;

      await sql`delete from identity.user_role_assignments where user_id = any(${userIds}::uuid[])`;
      await sql`delete from identity.auth_identity_links where user_id = any(${userIds}::uuid[])`;
      await sql`delete from identity.users where id = any(${userIds}::uuid[])`;
      createdUserIds.length = 0;
    } finally {
      await sql.end();
    }
  });

  const makeUser = async (label: string): Promise<{ id: string; email: string }> => {
    const { sql } = createDatabaseClient();
    try {
      const [user] = await sql`
        insert into identity.users (display_name, preferred_name, family_name, country_code, time_zone, locale)
        values (${'Test ' + label}, 'Aroha', 'Ngata', 'NZ', 'Pacific/Auckland', 'en-NZ')
        returning id::text as id`;
      const id = user!['id'] as string;
      createdUserIds.push(id);
      const email = `onboarding.${label}.${randomUUID().slice(0, 6)}@example.test`;
      await sql`
        insert into identity.auth_identity_links (user_id, provider_subject_id, authentication_email)
        values (${id}::uuid, ${randomUUID()}, ${email})`;
      return { id, email };
    } finally {
      await sql.end();
    }
  };

  const subjectIds = async (): Promise<string[]> => {
    const { sql } = createDatabaseClient();
    try {
      const rows = await sql`
        select id::text as id from platform.subjects where status_code = 'active' order by code limit 2`;
      return rows.map((row) => row['id'] as string);
    } finally {
      await sql.end();
    }
  };

  const application = (subjects: readonly string[]): ValidatedTutorApplication => ({
    legalFirstName: 'Arohanui',
    legalFamilyName: 'Ngatapuna',
    preferredFirstName: 'Aro',
    phone: '021 555 0142',
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
      { fullName: 'Hemi Walker', email: 'hemi.referee@example.test', relationship: 'Colleague' },
      { fullName: 'Mere Cook', email: 'mere.referee@example.test', relationship: 'Parent' },
    ],
  });

  /** A submitted application, its applicant and a reviewer. */
  const submitted = async () => {
    const applicant = await makeUser('applicant');
    const reviewer = await makeUser('reviewer');
    const started = await startTutorApplication({
      userId: applicant.id,
      correlationId: randomUUID(),
    });
    if (started.status === 'already_a_tutor') throw new Error('unexpected');
    const result = await submitApplication({
      userId: applicant.id,
      application: application(await subjectIds()),
      correlationId: randomUUID(),
    });
    expect(result.status).toBe('submitted');
    return { applicant, reviewer, reference: started.reference };
  };

  /** Everything the drain would send right now for one event type. */
  const claimed = async (eventType: string): Promise<readonly NotificationWorkItem[]> => {
    const { work } = await claimNotificationWork({ opsEmailAddress: OPS, limit: 50 });
    return work.filter((item) => item.eventType === eventType);
  };

  const flat = (value: unknown): string =>
    JSON.stringify(value, (_, inner: unknown) =>
      typeof inner === 'bigint' ? inner.toString() : inner,
    );

  // -------------------------------------------------------------------------

  describe('an application', () => {
    it('tells the applicant it arrived and operations that it needs review', async () => {
      const { applicant, reference } = await submitted();
      const work = await claimed('tutor_application.submitted');

      expect(work.map((item) => item.recipientRole).sort()).toEqual(['applicant', 'ops']);
      const toApplicant = work.find((item) => item.recipientRole === 'applicant');
      expect(toApplicant?.toAddress).toBe(applicant.email);
      expect(toApplicant?.templateCode).toBe('application_received_applicant');
      expect(toApplicant?.context.applicationReference).toBe(reference);
      // The name they chose to be known by, not the legal one.
      expect(toApplicant?.context.recipientFirstName).toBe('Aro');
      expect(work.find((item) => item.recipientRole === 'ops')?.toAddress).toBe(OPS);
    });

    it('hands a template none of what an application holds that an email must not carry', async () => {
      await submitted();
      const everything = flat(await claimed('tutor_application.submitted'));
      for (const secret of [
        'Arohanui',
        'Ngatapuna',
        '021 555 0142',
        'hemi.referee@example.test',
        'mere.referee@example.test',
        'Hemi Walker',
      ]) {
        expect(everything).not.toContain(secret);
      }
    });

    it('never addresses a referee', async () => {
      const { applicant } = await submitted();
      const addresses = (await claimed('tutor_application.submitted')).map(
        (item) => item.toAddress,
      );
      expect(addresses.sort()).toEqual([applicant.email, OPS].sort());
    });

    it('tells the applicant alone that changes were asked for, without the reviewer’s words', async () => {
      const { applicant, reviewer, reference } = await submitted();
      await claimed('tutor_application.submitted');
      await requestApplicationChanges({
        reference,
        message: REVIEWER_WORDS,
        internalNote: REVIEWER_WORDS,
        actorUserId: reviewer.id,
        correlationId: randomUUID(),
      });

      const work = await claimed('tutor_application.changes_requested');
      expect(work).toHaveLength(1);
      expect(work[0]).toMatchObject({
        recipientRole: 'applicant',
        toAddress: applicant.email,
        templateCode: 'application_changes_requested_applicant',
      });
      expect(flat(work)).not.toContain(REVIEWER_WORDS);
    });

    it('tells the applicant alone that it was declined, without the reason', async () => {
      const { applicant, reviewer, reference } = await submitted();
      await rejectApplication({
        reference,
        message: REVIEWER_WORDS,
        actorUserId: reviewer.id,
        correlationId: randomUUID(),
      });

      const work = await claimed('tutor_application.rejected');
      expect(work).toHaveLength(1);
      expect(work[0]).toMatchObject({
        recipientRole: 'applicant',
        toAddress: applicant.email,
        templateCode: 'application_declined_applicant',
      });
      expect(flat(work)).not.toContain(REVIEWER_WORDS);
    });

    it('tells the applicant they are approved, once and only once', async () => {
      const { applicant, reviewer, reference } = await submitted();
      for (const checkCode of ALL_CHECKS) {
        await recordApplicationCheck({
          reference,
          checkCode,
          status: 'verified',
          note: null,
          actorUserId: reviewer.id,
          correlationId: randomUUID(),
        });
      }
      const approved = await approveApplication({
        reference,
        actorUserId: reviewer.id,
        correlationId: randomUUID(),
      });
      expect(approved.status).toBe('approved');

      const work = await claimed('tutor.approved');
      expect(work).toHaveLength(1);
      expect(work[0]).toMatchObject({
        recipientRole: 'applicant',
        toAddress: applicant.email,
        templateCode: 'application_approved_applicant',
      });

      // A second approval is refused and queues nothing more.
      await approveApplication({
        reference,
        actorUserId: reviewer.id,
        correlationId: randomUUID(),
      });
      const { sql } = createDatabaseClient();
      try {
        const rows = await sql`
          select 1 from audit.outbox_entries e
          join tutors.tutor_applications a on a.id::text = e.payload->>'applicationId'
          where a.reference = ${reference} and e.event_type = 'tutor.approved'`;
        expect(rows).toHaveLength(1);
      } finally {
        await sql.end();
      }
    });
  });

  describe('the review of a service', () => {
    /** An approved tutor with a draft service, another tutor, and a reviewer. */
    const withService = async () => {
      const tutor = await makeUser('tutor');
      const bystander = await makeUser('bystander');
      const reviewer = await makeUser('reviewer');
      const { sql } = createDatabaseClient();
      let tutorProfileId: string;
      try {
        const profiles = await sql`
          insert into tutors.tutor_profiles
            (user_id, public_first_name, headline, teaching_approach, status_code,
             visibility_state_code, source_type_code, year_level_from, year_level_to)
          values
            (${tutor.id}::uuid, 'Tama', 'Biology made visual', 'We draw everything out.',
             'approved', 'public_recommended', 'tutor_application', 7, 13),
            (${bystander.id}::uuid, 'Rewi', 'Another tutor', 'Nothing to do with this.',
             'approved', 'public_recommended', 'tutor_application', 7, 13)
          returning id::text as id, user_id::text as user_id`;
        tutorProfileId = profiles.find((row) => row['user_id'] === tutor.id)!['id'] as string;
      } finally {
        await sql.end();
      }

      const command = { tutorProfileId, actorUserId: tutor.id, correlationId: randomUUID() };
      const created = await createTutorService({
        ...command,
        service: {
          subjectId: (await subjectIds())[0]!,
          displayName: 'Year 11 to 13 biology',
          description: 'Weekly lessons that follow the school programme, drawn out step by step.',
          yearLevelFrom: 11,
          yearLevelTo: 13,
          formatCode: 'online',
          options: [{ durationMinutes: 60, priceAmountMinor: 6500n }],
        },
      });
      if (created.status !== 'created') throw new Error('expected a created service');
      expect(await submitTutorService({ ...command, reference: created.reference })).toEqual({
        status: 'done',
      });
      return { tutor, bystander, reviewer, reference: created.reference };
    };

    it('tells operations, and not the tutor, that a service is waiting', async () => {
      const { reference } = await withService();
      const work = await claimed('service.submitted');
      expect(work).toHaveLength(1);
      expect(work[0]).toMatchObject({
        recipientRole: 'ops',
        toAddress: OPS,
        templateCode: 'service_submitted_ops',
      });
      expect(work[0]?.context).toMatchObject({
        serviceReference: reference,
        serviceDisplayName: 'Year 11 to 13 biology',
        tutorFirstName: 'Tama',
      });
    });

    it('tells the tutor who owns the service that it was approved, and nobody else', async () => {
      const { tutor, bystander, reviewer, reference } = await withService();
      await approveTutorService({
        reference,
        actorUserId: reviewer.id,
        correlationId: randomUUID(),
      });

      const work = await claimed('service.approved');
      expect(work).toHaveLength(1);
      expect(work[0]).toMatchObject({
        recipientRole: 'tutor',
        toAddress: tutor.email,
        templateCode: 'service_approved_tutor',
      });
      expect(flat(work)).not.toContain(bystander.email);
    });

    it('tells the tutor a change is needed, without the reviewer’s words', async () => {
      const { tutor, reviewer, reference } = await withService();
      await requestTutorServiceChanges({
        reference,
        message: REVIEWER_WORDS,
        internalNote: REVIEWER_WORDS,
        actorUserId: reviewer.id,
        correlationId: randomUUID(),
      });

      const work = await claimed('service.changes_requested');
      expect(work).toHaveLength(1);
      expect(work[0]).toMatchObject({ recipientRole: 'tutor', toAddress: tutor.email });
      expect(flat(work)).not.toContain(REVIEWER_WORDS);
    });

    it('queues nothing for the steps nobody else needs to hear about', async () => {
      // Creating a draft is the tutor's own business until they send it.
      const tutor = await makeUser('quiet');
      const { sql } = createDatabaseClient();
      try {
        const [profile] = await sql`
          insert into tutors.tutor_profiles
            (user_id, public_first_name, status_code, visibility_state_code, source_type_code)
          values (${tutor.id}::uuid, 'Kiri', 'approved', 'public_recommended', 'tutor_application')
          returning id::text as id`;
        const created = await createTutorService({
          tutorProfileId: profile!['id'] as string,
          actorUserId: tutor.id,
          correlationId: randomUUID(),
          service: {
            subjectId: (await subjectIds())[0]!,
            displayName: 'A quiet draft',
            description: 'A draft that has not been sent to anyone and so owes nobody an email.',
            yearLevelFrom: 9,
            yearLevelTo: 10,
            formatCode: 'online',
            options: [{ durationMinutes: 60, priceAmountMinor: 6000n }],
          },
        });
        expect(created.status).toBe('created');
        const rows = await sql`
          select 1 from audit.outbox_entries e
          join services.services s on s.id::text = e.payload->>'serviceId'
          where s.tutor_profile_id = ${profile!['id'] as string}::uuid`;
        expect(rows).toHaveLength(0);
      } finally {
        await sql.end();
      }
    });
  });
});
