import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TUTOR_SERVICE_RULE_KEYS,
  tutorSetupChecklist,
  type ValidatedTutorProfile,
  type ValidatedTutorService,
} from '@studdy/domain/tutors';
import { createDatabaseClient } from '../client';
import { findPublicTutorByReference } from '../repositories/discovery';
import { tutorProfileForUser } from '../repositories/request-projections';
import { setRuleSetting } from '../repositories/rule-settings';
import { listBookableServices } from '../repositories/services';
import {
  pauseTutorListing,
  resumeTutorListing,
  tutorOwnProfile,
  tutorSetupFacts,
  updateTutorProfile,
} from '../repositories/tutor-profile';
import {
  approveTutorService,
  archiveTutorService,
  createTutorService,
  listPublicServicesForTutor,
  listServicesForTutor,
  publishTutorService,
  requestTutorServiceChanges,
  serviceForReview,
  serviceForTutor,
  serviceReviewQueue,
  startServiceRevision,
  submitTutorService,
  unpublishTutorService,
  updateTutorService,
  withdrawTutorServiceSubmission,
} from '../repositories/tutor-services';

/**
 * TUTOR-MANAGED SERVICES — from a draft to on sale, against a real Postgres.
 *
 * WHAT IS ASSERTED IS WHAT A FAMILY CAN AND CANNOT SEE, AND WHO CAN MOVE WHAT:
 * that nothing reaches discovery, the public profile or the booking journey until
 * a service has been reviewed AND its tutor has published it; that publishing is
 * refused for a tutor who cannot be paid unless that rule has been deliberately
 * relaxed; that one tutor cannot touch another's service by any route; that a
 * reviewed service changes only through a separately reviewed replacement which
 * retires the original in the same transaction; that a reviewer's own note never
 * reaches the tutor; and that a tutor can pause their own listing but cannot
 * relist themselves out of a state someone else put them in.
 *
 * Reviewers are plain users here: this repository deliberately does not decide
 * who may review. That is `requireStaff`'s job and is proved in its own tests.
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

const STAFF_NOTE = 'SECRET STAFF NOTE about this service';
const RULE_NOTE = 'tutor-services integration test';

describe.skipIf(!available)('tutor services (integration)', () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    const { sql } = createDatabaseClient();
    try {
      if (createdUserIds.length > 0) {
        const userIds = createdUserIds;
        const profiles = (
          await sql`select id::text as id from tutors.tutor_profiles where user_id = any(${userIds}::uuid[])`
        ).map((row) => row['id'] as string);
        const serviceIds = (
          await sql`select id::text as id from services.services where tutor_profile_id = any(${profiles}::uuid[])`
        ).map((row) => row['id'] as string);

        // Sending and deciding a service each queue an email; nothing here drains them.
        await sql`delete from audit.outbox_entries where payload->>'serviceId' = any(${serviceIds})`;
        await sql`delete from services.service_reviews where service_id = any(${serviceIds}::uuid[])`;
        await sql`delete from services.service_versions where service_id = any(${serviceIds}::uuid[])`;
        // A replacement points at the service it replaces; unlink before deleting.
        await sql`update services.services set replaces_service_id = null where id = any(${serviceIds}::uuid[])`;
        await sql`delete from services.services where id = any(${serviceIds}::uuid[])`;
        await sql`delete from payments.connected_accounts where tutor_profile_id = any(${profiles}::uuid[])`;
        await sql`delete from availability.availability_rules where tutor_profile_id = any(${profiles}::uuid[])`;

        await sql`delete from audit.status_transitions where entity_id = any(${serviceIds})`;
        await sql`delete from audit.status_transitions where entity_id = any(${profiles})`;
        await sql`delete from audit.status_transitions where actor_user_id = any(${userIds}::uuid[])`;
        await sql`delete from audit.audit_events where entity_id = any(${serviceIds})`;
        await sql`delete from audit.audit_events where entity_id = any(${profiles})`;
        await sql`delete from audit.audit_events where actor_user_id = any(${userIds}::uuid[])`;
        await sql`delete from audit.domain_events where entity_id = any(${serviceIds})`;
        await sql`delete from audit.domain_events where entity_id = any(${profiles})`;

        await sql`delete from tutors.tutor_profiles where id = any(${profiles}::uuid[])`;
        await sql`delete from identity.auth_identity_links where user_id = any(${userIds}::uuid[])`;
        await sql`delete from identity.users where id = any(${userIds}::uuid[])`;
        createdUserIds.length = 0;
      }
      await sql`delete from platform.rule_settings
                where setting_key = ${TUTOR_SERVICE_RULE_KEYS.publicationRequiresPayouts}
                  and provenance_note = ${RULE_NOTE}`;
      // Deleting the test's version may leave an older one marked superseded.
      await sql`update platform.rule_settings set status_code = 'current', superseded_at = null
                where setting_key = ${TUTOR_SERVICE_RULE_KEYS.publicationRequiresPayouts}
                  and version_number = (
                    select max(version_number) from platform.rule_settings
                    where setting_key = ${TUTOR_SERVICE_RULE_KEYS.publicationRequiresPayouts})`;
    } finally {
      await sql.end();
    }
  });

  const makeUser = async (label: string): Promise<string> => {
    const { sql } = createDatabaseClient();
    try {
      const [user] = await sql`
        insert into identity.users (display_name, preferred_name, family_name, country_code, time_zone, locale)
        values (${'Test ' + label}, 'Tama', 'Rangi', 'NZ', 'Pacific/Auckland', 'en-NZ')
        returning id::text as id`;
      const id = user!['id'] as string;
      createdUserIds.push(id);
      await sql`
        insert into identity.auth_identity_links (user_id, provider_subject_id, authentication_email)
        values (${id}::uuid, ${randomUUID()}, ${`tutor.${label}.${randomUUID().slice(0, 6)}@example.test`})`;
      return id;
    } finally {
      await sql.end();
    }
  };

  interface Tutor {
    readonly userId: string;
    readonly tutorProfileId: string;
    readonly reference: string;
  }

  /** A tutor exactly as approval leaves them: an approved, listed profile and nothing else. */
  const makeTutor = async (
    label = 'tutor',
    overrides: { status?: string; visibility?: string; inPerson?: boolean } = {},
  ): Promise<Tutor> => {
    const userId = await makeUser(label);
    const { sql } = createDatabaseClient();
    try {
      const [profile] = await sql`
        insert into tutors.tutor_profiles
          (user_id, public_first_name, headline, teaching_approach, status_code,
           visibility_state_code, source_type_code, year_level_from, year_level_to,
           offers_online, offers_in_person)
        values (${userId}::uuid, 'Tama', 'Biology made visual',
                'We build every process up as a diagram together.',
                ${overrides.status ?? 'approved'}, ${overrides.visibility ?? 'public_recommended'},
                'tutor_application', 7, 13, true, ${overrides.inPerson ?? false})
        returning id::text as id, reference`;
      return {
        userId,
        tutorProfileId: profile!['id'] as string,
        reference: profile!['reference'] as string,
      };
    } finally {
      await sql.end();
    }
  };

  const makePayable = async (tutor: Tutor): Promise<void> => {
    const { sql } = createDatabaseClient();
    try {
      await sql`
        insert into payments.connected_accounts
          (tutor_profile_id, provider, provider_account_id, dashboard_code,
           configuration_code, country_code, status_code,
           transfers_capability_code, payouts_capability_code)
        values (${tutor.tutorProfileId}::uuid, 'stripe', ${'acct_svc_' + randomUUID().slice(0, 12)},
                'express', 'recipient', 'NZ', 'complete', 'active', 'active')`;
    } finally {
      await sql.end();
    }
  };

  const subject = async (): Promise<{ id: string; code: string }> => {
    const { sql } = createDatabaseClient();
    try {
      const [row] = await sql`
        select id::text as id, code from platform.subjects
        where status_code = 'active' order by code limit 1`;
      return { id: row!['id'] as string, code: row!['code'] as string };
    } finally {
      await sql.end();
    }
  };

  const validService = async (
    overrides: Partial<ValidatedTutorService> = {},
  ): Promise<ValidatedTutorService> => ({
    subjectId: (await subject()).id,
    displayName: 'Year 11 to 13 biology',
    description: 'Weekly lessons that follow the school programme, drawn out step by step.',
    yearLevelFrom: 11,
    yearLevelTo: 13,
    formatCode: 'online',
    options: [
      { durationMinutes: 60, priceAmountMinor: 6500n },
      { durationMinutes: 90, priceAmountMinor: 9000n },
    ],
    ...overrides,
  });

  const as = (tutor: Tutor) => ({
    tutorProfileId: tutor.tutorProfileId,
    actorUserId: tutor.userId,
    correlationId: randomUUID(),
  });

  const draft = async (
    tutor: Tutor,
    overrides: Partial<ValidatedTutorService> = {},
  ): Promise<string> => {
    const created = await createTutorService({
      ...as(tutor),
      service: await validService(overrides),
    });
    if (created.status !== 'created') throw new Error('expected a created service');
    return created.reference;
  };

  /** A service that has been sent and approved, and not yet published. */
  const approved = async (tutor: Tutor, reviewerId: string): Promise<string> => {
    const reference = await draft(tutor);
    expect(await submitTutorService({ ...as(tutor), reference })).toEqual({ status: 'done' });
    expect(
      await approveTutorService({
        reference,
        actorUserId: reviewerId,
        correlationId: randomUUID(),
      }),
    ).toEqual({ status: 'done' });
    return reference;
  };

  /** A payable tutor with one published service. */
  const onSale = async (): Promise<{ tutor: Tutor; reviewerId: string; reference: string }> => {
    const tutor = await makeTutor();
    const reviewerId = await makeUser('reviewer');
    await makePayable(tutor);
    const reference = await approved(tutor, reviewerId);
    expect(await publishTutorService({ ...as(tutor), reference })).toEqual({
      status: 'published',
    });
    return { tutor, reviewerId, reference };
  };

  const statusOf = async (tutor: Tutor, reference: string): Promise<string | undefined> =>
    (await serviceForTutor({ tutorProfileId: tutor.tutorProfileId, reference }))?.status;

  // -------------------------------------------------------------------------

  describe('the workspace', () => {
    it('opens for a tutor who has been approved but has published nothing', async () => {
      // Approval creates the profile as `approved`. The workspace once required
      // `active`, which locked every newly approved tutor out of their own setup.
      const tutor = await makeTutor();
      expect(await tutorProfileForUser(tutor.userId)).toEqual({ id: tutor.tutorProfileId });
      expect((await tutorOwnProfile(tutor.userId))?.reference).toBe(tutor.reference);
    });

    it('stays shut for a suspended tutor', async () => {
      const tutor = await makeTutor('suspended', { status: 'suspended', visibility: 'suspended' });
      expect(await tutorProfileForUser(tutor.userId)).toBeNull();
      expect(await tutorOwnProfile(tutor.userId)).toBeNull();
    });
  });

  describe('a draft', () => {
    it('is visible to its tutor and to nobody else', async () => {
      const tutor = await makeTutor();
      const reference = await draft(tutor);

      const own = await serviceForTutor({ tutorProfileId: tutor.tutorProfileId, reference });
      expect(own?.status).toBe('draft');
      expect(own?.options.map((option) => option.durationMinutes)).toEqual([60, 90]);
      expect(own?.formatCode).toBe('online');

      expect(await listPublicServicesForTutor(tutor.reference)).toEqual([]);
      expect(await findPublicTutorByReference(tutor.reference)).toEqual([]);
      expect(await serviceReviewQueue()).not.toContainEqual(expect.objectContaining({ reference }));
    });

    it('cannot be published', async () => {
      const tutor = await makeTutor();
      await makePayable(tutor);
      const reference = await draft(tutor);
      expect(await publishTutorService({ ...as(tutor), reference })).toEqual({
        status: 'not_ready',
        blockers: ['service_not_reviewed'],
      });
      expect(await statusOf(tutor, reference)).toBe('draft');
    });

    it('can be edited, and its options are replaced rather than added to', async () => {
      const tutor = await makeTutor();
      const reference = await draft(tutor);
      expect(
        await updateTutorService({
          ...as(tutor),
          reference,
          service: await validService({
            displayName: 'Year 12 biology',
            options: [{ durationMinutes: 45, priceAmountMinor: 5000n }],
          }),
        }),
      ).toEqual({ status: 'done' });

      const own = await serviceForTutor({ tutorProfileId: tutor.tutorProfileId, reference });
      expect(own?.displayName).toBe('Year 12 biology');
      expect(own?.options).toEqual([
        { durationMinutes: 45, priceAmountMinor: 5000n, currencyCode: 'NZD' },
      ]);
    });

    it('can be removed', async () => {
      const tutor = await makeTutor();
      const reference = await draft(tutor);
      expect(await archiveTutorService({ ...as(tutor), reference })).toEqual({ status: 'done' });
      expect(await listServicesForTutor(tutor.tutorProfileId)).toEqual([]);
    });
  });

  describe('review', () => {
    it('queues a submitted service and freezes it against edits', async () => {
      const tutor = await makeTutor();
      const reference = await draft(tutor);
      expect(await submitTutorService({ ...as(tutor), reference })).toEqual({ status: 'done' });

      expect(await statusOf(tutor, reference)).toBe('pending_approval');
      expect(await serviceReviewQueue()).toContainEqual(
        expect.objectContaining({ reference, tutorReference: tutor.reference, isRevision: false }),
      );
      expect(
        await updateTutorService({ ...as(tutor), reference, service: await validService() }),
      ).toEqual({ status: 'not_allowed' });
      // Sending it twice is refused rather than queued twice.
      expect(await submitTutorService({ ...as(tutor), reference })).toEqual({
        status: 'not_allowed',
      });
    });

    it('approves without publishing: an approved service is still not on sale', async () => {
      const tutor = await makeTutor();
      await makePayable(tutor);
      const reference = await approved(tutor, await makeUser('reviewer'));

      expect(await statusOf(tutor, reference)).toBe('approved');
      expect(await listPublicServicesForTutor(tutor.reference)).toEqual([]);
      expect(await findPublicTutorByReference(tutor.reference)).toEqual([]);
    });

    it('shows the tutor the message written for them and never the staff note', async () => {
      const tutor = await makeTutor();
      const reviewerId = await makeUser('reviewer');
      const reference = await draft(tutor);
      await submitTutorService({ ...as(tutor), reference });
      expect(
        await requestTutorServiceChanges({
          reference,
          message: 'Please say which exam board you follow.',
          internalNote: STAFF_NOTE,
          actorUserId: reviewerId,
          correlationId: randomUUID(),
        }),
      ).toEqual({ status: 'done' });

      const own = await serviceForTutor({ tutorProfileId: tutor.tutorProfileId, reference });
      expect(own?.status).toBe('changes_requested');
      expect(own?.reviewerMessage).toBe('Please say which exam board you follow.');
      expect(
        JSON.stringify(own, (_, value) => (typeof value === 'bigint' ? String(value) : value)),
      ).not.toContain(STAFF_NOTE);
      // The reviewer, on the other hand, does see it.
      expect((await serviceForReview(reference))?.history[0]?.internalNote).toBe(STAFF_NOTE);

      // The tutor edits and sends it again, and it can then be approved.
      expect(
        await updateTutorService({ ...as(tutor), reference, service: await validService() }),
      ).toEqual({ status: 'done' });
      expect(await submitTutorService({ ...as(tutor), reference })).toEqual({ status: 'done' });
      expect(
        await approveTutorService({
          reference,
          actorUserId: reviewerId,
          correlationId: randomUUID(),
        }),
      ).toEqual({ status: 'done' });
      // The old message is not shown against an approved service.
      expect(
        (await serviceForTutor({ tutorProfileId: tutor.tutorProfileId, reference }))
          ?.reviewerMessage,
      ).toBeNull();
    });

    it('cannot decide a service the tutor has taken back', async () => {
      const tutor = await makeTutor();
      const reference = await draft(tutor);
      await submitTutorService({ ...as(tutor), reference });
      expect(await withdrawTutorServiceSubmission({ ...as(tutor), reference })).toEqual({
        status: 'done',
      });
      expect(await statusOf(tutor, reference)).toBe('draft');
      expect(
        await approveTutorService({
          reference,
          actorUserId: await makeUser('reviewer'),
          correlationId: randomUUID(),
        }),
      ).toEqual({ status: 'not_decidable' });
    });

    it('lets exactly one of two reviewers acting at once decide', async () => {
      const tutor = await makeTutor();
      const reference = await draft(tutor);
      await submitTutorService({ ...as(tutor), reference });
      const [first, second] = await Promise.all([
        approveTutorService({
          reference,
          actorUserId: await makeUser('reviewer-a'),
          correlationId: randomUUID(),
        }),
        requestTutorServiceChanges({
          reference,
          message: 'Please add more detail.',
          actorUserId: await makeUser('reviewer-b'),
          correlationId: randomUUID(),
        }),
      ]);
      expect([first.status, second.status].sort()).toEqual(['done', 'not_decidable']);
    });

    it('is not decidable for a reference that does not exist', async () => {
      expect(
        await approveTutorService({
          reference: 'SERVICE-00000000',
          actorUserId: await makeUser('reviewer'),
          correlationId: randomUUID(),
        }),
      ).toEqual({ status: 'not_found' });
    });
  });

  describe('publishing', () => {
    it('is refused for a tutor who cannot be paid, and names why', async () => {
      const tutor = await makeTutor();
      const reference = await approved(tutor, await makeUser('reviewer'));
      expect(await publishTutorService({ ...as(tutor), reference })).toEqual({
        status: 'not_ready',
        blockers: ['payouts_not_ready'],
      });
      expect(await findPublicTutorByReference(tutor.reference)).toEqual([]);
    });

    it('is allowed without payouts only when the rule has been switched off', async () => {
      const tutor = await makeTutor();
      const reference = await approved(tutor, await makeUser('reviewer'));
      await setRuleSetting(TUTOR_SERVICE_RULE_KEYS.publicationRequiresPayouts, false, RULE_NOTE);
      expect(await publishTutorService({ ...as(tutor), reference })).toEqual({
        status: 'published',
      });
    });

    it('puts the tutor in discovery, on their profile and in the booking journey', async () => {
      const { tutor } = await onSale();
      const { id: subjectId, code } = await subject();

      const rows = await findPublicTutorByReference(tutor.reference);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        firstName: 'Tama',
        subjectCode: code,
        // The cheapest option, and the SERVICE's year range rather than the profile's 7 to 13.
        startingPriceAmountMinor: 6500n,
        startingPriceDurationMinutes: 60,
        yearLevelFrom: 11,
        yearLevelTo: 13,
        isExampleProfile: false,
      });

      const [service] = await listPublicServicesForTutor(tutor.reference);
      expect(service).toMatchObject({
        displayName: 'Year 11 to 13 biology',
        description: 'Weekly lessons that follow the school programme, drawn out step by step.',
        formatCode: 'online',
      });
      expect(service?.options.map((option) => option.priceAmountMinor)).toEqual([6500n, 9000n]);

      const bookable = await listBookableServices({ tutorReference: tutor.reference, subjectId });
      expect(bookable?.versions.map((version) => version.durationMinutes)).toEqual([60, 90]);
    });

    it('makes a tutor publishing for the first time active', async () => {
      const { tutor } = await onSale();
      expect((await tutorOwnProfile(tutor.userId))?.statusCode).toBe('active');
    });

    it('can be undone and redone without another review', async () => {
      const { tutor, reference } = await onSale();
      const { id: subjectId } = await subject();

      expect(await unpublishTutorService({ ...as(tutor), reference })).toEqual({ status: 'done' });
      expect(await findPublicTutorByReference(tutor.reference)).toEqual([]);
      expect(await listPublicServicesForTutor(tutor.reference)).toEqual([]);
      expect(await listBookableServices({ tutorReference: tutor.reference, subjectId })).toBeNull();

      expect(await publishTutorService({ ...as(tutor), reference })).toEqual({
        status: 'published',
      });
      expect(await findPublicTutorByReference(tutor.reference)).toHaveLength(1);
    });

    it('cannot be removed while it is on sale', async () => {
      const { tutor, reference } = await onSale();
      expect(await archiveTutorService({ ...as(tutor), reference })).toEqual({
        status: 'not_allowed',
      });
      expect(await statusOf(tutor, reference)).toBe('published');
    });
  });

  describe("another tutor's service", () => {
    it('cannot be read, changed, sent, published, unpublished, revised or removed', async () => {
      const { reference } = await onSale();
      const other = await makeTutor('other');
      await makePayable(other);
      const input = { ...as(other), reference };

      expect(await serviceForTutor({ tutorProfileId: other.tutorProfileId, reference })).toBeNull();
      expect(await listServicesForTutor(other.tutorProfileId)).toEqual([]);
      expect(await updateTutorService({ ...input, service: await validService() })).toEqual({
        status: 'not_found',
      });
      expect(await submitTutorService(input)).toEqual({ status: 'not_found' });
      expect(await withdrawTutorServiceSubmission(input)).toEqual({ status: 'not_found' });
      expect(await publishTutorService(input)).toEqual({ status: 'not_found' });
      expect(await unpublishTutorService(input)).toEqual({ status: 'not_found' });
      expect(await startServiceRevision(input)).toEqual({ status: 'not_found' });
      expect(await archiveTutorService(input)).toEqual({ status: 'not_found' });
    });
  });

  describe('changing a reviewed service', () => {
    it('drafts a replacement, leaves the original on sale, and swaps them on publish', async () => {
      const { tutor, reviewerId, reference } = await onSale();

      const started = await startServiceRevision({ ...as(tutor), reference });
      expect(started.status).toBe('started');
      if (started.status !== 'started') return;
      const revision = started.reference;
      expect(revision).not.toBe(reference);

      // Asking again returns the draft in progress rather than making a second.
      expect(await startServiceRevision({ ...as(tutor), reference })).toEqual({
        status: 'existing',
        reference: revision,
      });

      // The copy starts as the original, and the two point at each other.
      const copy = await serviceForTutor({
        tutorProfileId: tutor.tutorProfileId,
        reference: revision,
      });
      expect(copy).toMatchObject({ status: 'draft', replacesReference: reference });
      expect(copy?.options.map((option) => option.priceAmountMinor)).toEqual([6500n, 9000n]);
      expect(
        (await serviceForTutor({ tutorProfileId: tutor.tutorProfileId, reference }))
          ?.revisionReference,
      ).toBe(revision);

      // A new price, reviewed like anything else. Until it is published, families
      // still see and are still charged the old one.
      await updateTutorService({
        ...as(tutor),
        reference: revision,
        service: await validService({
          options: [{ durationMinutes: 60, priceAmountMinor: 7000n }],
        }),
      });
      await submitTutorService({ ...as(tutor), reference: revision });
      expect(await serviceReviewQueue()).toContainEqual(
        expect.objectContaining({ reference: revision, isRevision: true }),
      );
      expect((await serviceForReview(revision))?.replaces?.reference).toBe(reference);
      await approveTutorService({
        reference: revision,
        actorUserId: reviewerId,
        correlationId: randomUUID(),
      });
      expect((await findPublicTutorByReference(tutor.reference))[0]?.startingPriceAmountMinor).toBe(
        6500n,
      );

      expect(await publishTutorService({ ...as(tutor), reference: revision })).toEqual({
        status: 'published',
      });
      // One service on sale, at the new price; the original is gone from the list.
      const rows = await findPublicTutorByReference(tutor.reference);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.startingPriceAmountMinor).toBe(7000n);
      expect(await listPublicServicesForTutor(tutor.reference)).toHaveLength(1);
      expect(
        (await listServicesForTutor(tutor.tutorProfileId)).map((service) => service.reference),
      ).toEqual([revision]);
    });

    it('is not offered for a service that has never been reviewed', async () => {
      const tutor = await makeTutor();
      const reference = await draft(tutor);
      expect(await startServiceRevision({ ...as(tutor), reference })).toEqual({
        status: 'not_allowed',
      });
    });
  });

  describe('the tutor’s own listing', () => {
    it('can be paused, which removes them from discovery, and resumed', async () => {
      const { tutor } = await onSale();
      expect(await pauseTutorListing(as(tutor))).toEqual({ status: 'done' });
      expect(await findPublicTutorByReference(tutor.reference)).toEqual([]);
      expect(await listPublicServicesForTutor(tutor.reference)).toEqual([]);
      expect(await tutorOwnProfile(tutor.userId)).toMatchObject({
        listed: false,
        pausedByTutor: true,
      });
      // Pausing twice is refused, so the remembered state cannot be overwritten.
      expect(await pauseTutorListing(as(tutor))).toEqual({ status: 'not_allowed' });

      expect(await resumeTutorListing(as(tutor))).toEqual({ status: 'done' });
      expect(await findPublicTutorByReference(tutor.reference)).toHaveLength(1);
      expect(await tutorOwnProfile(tutor.userId)).toMatchObject({
        listed: true,
        pausedByTutor: false,
      });
    });

    it('cannot be resumed out of a state someone else put it in', async () => {
      // Unlisted with nothing remembered: this was not the tutor's own pause.
      const tutor = await makeTutor('moderated', { visibility: 'unlisted' });
      expect(await resumeTutorListing(as(tutor))).toEqual({ status: 'not_allowed' });
      expect((await tutorOwnProfile(tutor.userId))?.listed).toBe(false);
    });

    it('resumes to the reduced visibility it was paused from, not to full', async () => {
      const tutor = await makeTutor('reduced', { visibility: 'public_reduced' });
      await pauseTutorListing(as(tutor));
      await resumeTutorListing(as(tutor));
      const { sql } = createDatabaseClient();
      try {
        const [row] = await sql`
          select visibility_state_code, visibility_before_pause_code
          from tutors.tutor_profiles where id = ${tutor.tutorProfileId}::uuid`;
        expect(row).toMatchObject({
          visibility_state_code: 'public_reduced',
          visibility_before_pause_code: null,
        });
      } finally {
        await sql.end();
      }
    });
  });

  describe('editing the profile', () => {
    const edit = (overrides: Partial<ValidatedTutorProfile> = {}): ValidatedTutorProfile => ({
      headline: 'Biology, drawn out step by step',
      teachingApproach: 'We build every process up as a diagram and then you teach it back to me.',
      yearLevelFrom: 9,
      yearLevelTo: 13,
      offersOnline: true,
      offersInPerson: false,
      availabilityLabelCode: 'limited',
      ...overrides,
    });

    it('changes what families read, and keeps what it said before', async () => {
      const { tutor } = await onSale();
      expect(await updateTutorProfile({ ...as(tutor), profile: edit() })).toEqual({
        status: 'updated',
      });
      expect((await findPublicTutorByReference(tutor.reference))[0]).toMatchObject({
        headline: 'Biology, drawn out step by step',
        availabilityLabelCode: 'limited',
      });

      const { sql } = createDatabaseClient();
      try {
        const [audit] = await sql`
          select original_value->>'headline' as before, new_value->>'headline' as after
          from audit.audit_events
          where entity_id = ${tutor.tutorProfileId} and action = 'tutor_profile.updated'`;
        expect(audit).toMatchObject({
          before: 'Biology made visual',
          after: 'Biology, drawn out step by step',
        });
      } finally {
        await sql.end();
      }
    });

    it('refuses to stop offering a format a live service is taught in', async () => {
      const tutor = await makeTutor('formats', { inPerson: true });
      await draft(tutor); // an online service
      expect(
        await updateTutorProfile({
          ...as(tutor),
          profile: edit({ offersOnline: false, offersInPerson: true }),
        }),
      ).toEqual({ status: 'format_in_use', format: 'online' });
      // Dropping the format no service uses is fine.
      expect(
        await updateTutorProfile({ ...as(tutor), profile: edit({ offersInPerson: false }) }),
      ).toEqual({ status: 'updated' });
    });
  });

  describe('the setup checklist', () => {
    it('follows a tutor from approved to bookable', async () => {
      const tutor = await makeTutor();
      const reviewerId = await makeUser('reviewer');
      const next = async () => {
        const facts = await tutorSetupFacts(tutor.tutorProfileId);
        if (facts === null) throw new Error('expected setup facts');
        return tutorSetupChecklist(facts);
      };

      expect(await next()).toMatchObject({ nextStep: 'service', bookable: false });

      const reference = await draft(tutor);
      expect((await next()).nextStep).toBe('review');

      await submitTutorService({ ...as(tutor), reference });
      expect((await next()).nextStep).toBe('availability');

      const { sql } = createDatabaseClient();
      try {
        await sql`
          insert into availability.availability_rules
            (tutor_profile_id, day_of_week, local_start_time, local_end_time, iana_time_zone, effective_from)
          values (${tutor.tutorProfileId}::uuid, 1, '16:00', '18:00', 'Pacific/Auckland', '2026-01-01')`;
      } finally {
        await sql.end();
      }
      expect((await next()).nextStep).toBe('payouts');

      await makePayable(tutor);
      expect(await next()).toMatchObject({ nextStep: null, waitingOnStuddy: true });

      await approveTutorService({
        reference,
        actorUserId: reviewerId,
        correlationId: randomUUID(),
      });
      expect((await next()).nextStep).toBe('publish');

      await publishTutorService({ ...as(tutor), reference });
      expect(await next()).toMatchObject({ bookable: true, percentComplete: 100 });
    });
  });

  describe('the database itself', () => {
    it('refuses a service status the application would never write', async () => {
      const tutor = await makeTutor();
      const { id: subjectId } = await subject();
      const { sql } = createDatabaseClient();
      try {
        await expect(
          sql`insert into services.services (tutor_profile_id, subject_id, display_name, status_code)
              values (${tutor.tutorProfileId}::uuid, ${subjectId}::uuid, 'Nope', 'live')`,
        ).rejects.toThrow();
      } finally {
        await sql.end();
      }
    });

    it('makes a service that says nothing about its status a draft, not on sale', async () => {
      const tutor = await makeTutor();
      const { id: subjectId } = await subject();
      const { sql } = createDatabaseClient();
      try {
        const [row] = await sql`
          insert into services.services (tutor_profile_id, subject_id, display_name)
          values (${tutor.tutorProfileId}::uuid, ${subjectId}::uuid, 'Defaulted')
          returning status_code`;
        expect(row!['status_code']).toBe('draft');
      } finally {
        await sql.end();
      }
    });

    it('lets no browser role read a review', async () => {
      const { sql } = createDatabaseClient();
      try {
        const rows = await sql`
          select grantee from information_schema.role_table_grants
          where table_schema = 'services' and table_name = 'service_reviews'
            and grantee in ('anon', 'authenticated')`;
        expect(rows).toHaveLength(0);
      } finally {
        await sql.end();
      }
    });
  });
});
