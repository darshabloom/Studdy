import { randomUUID } from 'node:crypto';
import { approveTutorService, createDatabaseClient } from '@studdy/database';

/**
 * What the tutor-onboarding journey needs from OUTSIDE the browser.
 *
 * Two steps of that journey belong to somebody other than the tutor, and neither
 * can be driven through a page here: a Studdy reviewer approving the service (the
 * manager workspace demands a TOTP code) and Stripe confirming the tutor can be
 * paid (Stripe's hosted onboarding). Both are done directly against the database,
 * through the same repository function the reviewer's action calls and the same
 * rows the Stripe webhook writes, so everything on either side of them is still
 * exercised for real.
 */

export interface OnboardingTutor {
  readonly userId: string;
  readonly tutorProfileId: string;
  readonly reference: string;
}

async function findTutor(email: string): Promise<OnboardingTutor> {
  const { sql } = createDatabaseClient();
  try {
    const [row] = await sql`
      select profile.id::text as id, profile.reference, profile.user_id::text as user_id
      from tutors.tutor_profiles as profile
      join identity.auth_identity_links as link on link.user_id = profile.user_id
      where link.authentication_email = ${email}
      limit 1`;
    if (row === undefined)
      throw new Error(`No seeded tutor profile for ${email}. Run pnpm db:seed.`);
    return {
      userId: row['user_id'] as string,
      tutorProfileId: row['id'] as string,
      reference: row['reference'] as string,
    };
  } finally {
    await sql.end();
  }
}

/**
 * Put the tutor back to exactly how approval leaves one: an approved, listed
 * profile with no service, no availability and no payouts. Whatever an earlier,
 * possibly failed, run left behind is removed, so the journey survives a retry.
 */
export async function resetOnboardingTutor(email: string): Promise<OnboardingTutor> {
  const tutor = await findTutor(email);
  const { sql } = createDatabaseClient();
  try {
    const serviceIds = (
      await sql`select id::text as id from services.services where tutor_profile_id = ${tutor.tutorProfileId}::uuid`
    ).map((row) => row['id'] as string);
    await sql`delete from services.service_reviews where service_id = any(${serviceIds}::uuid[])`;
    await sql`delete from services.service_versions where service_id = any(${serviceIds}::uuid[])`;
    await sql`update services.services set replaces_service_id = null where id = any(${serviceIds}::uuid[])`;
    await sql`delete from services.services where id = any(${serviceIds}::uuid[])`;
    await sql`delete from payments.connected_accounts where tutor_profile_id = ${tutor.tutorProfileId}::uuid`;
    await sql`delete from availability.availability_rules where tutor_profile_id = ${tutor.tutorProfileId}::uuid`;
    await sql`
      update tutors.tutor_profiles
      set status_code = 'approved',
          visibility_state_code = 'public_recommended',
          visibility_before_pause_code = null,
          offers_online = true,
          offers_in_person = false
      where id = ${tutor.tutorProfileId}::uuid`;
    return tutor;
  } finally {
    await sql.end();
  }
}

/** A Studdy reviewer approves the one service this tutor has waiting. */
export async function approvePendingService(email: string): Promise<void> {
  const tutor = await findTutor(email);
  const { sql } = createDatabaseClient();
  let reference: string;
  let reviewerId: string;
  try {
    const [service] = await sql`
      select reference from services.services
      where tutor_profile_id = ${tutor.tutorProfileId}::uuid and status_code = 'pending_approval'
      limit 1`;
    if (service === undefined) throw new Error('The tutor has no service waiting for review.');
    reference = service['reference'] as string;
    const [reviewer] = await sql`
      select user_id::text as user_id from identity.auth_identity_links
      where authentication_email = 'manager@local.studdy.test' limit 1`;
    if (reviewer === undefined) throw new Error('The seeded platform manager is missing.');
    reviewerId = reviewer['user_id'] as string;
  } finally {
    await sql.end();
  }
  const result = await approveTutorService({
    reference,
    actorUserId: reviewerId,
    correlationId: randomUUID(),
  });
  if (result.status !== 'done') throw new Error(`Approval was refused: ${result.status}`);
}

/** Stripe reports the tutor can be paid: the rows its webhook would have written. */
export async function makeTutorPayable(email: string): Promise<void> {
  const tutor = await findTutor(email);
  const { sql } = createDatabaseClient();
  try {
    await sql`
      insert into payments.connected_accounts
        (tutor_profile_id, provider, provider_account_id, dashboard_code,
         configuration_code, country_code, status_code,
         transfers_capability_code, payouts_capability_code)
      values (${tutor.tutorProfileId}::uuid, 'stripe', ${'acct_e2e_' + randomUUID().slice(0, 12)},
              'express', 'recipient', 'NZ', 'complete', 'active', 'active')`;
  } finally {
    await sql.end();
  }
}
