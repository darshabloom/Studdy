import { and, eq, inArray, isNull, ne } from 'drizzle-orm';
import {
  TUTOR_WORKSPACE_PROFILE_STATUSES,
  isListedVisibility,
  isTutorProfileComplete,
  PUBLISHING_PROFILE_STATUSES,
  type TutorSetupFacts,
  type ValidatedTutorProfile,
} from '@studdy/domain/tutors';
import { createDatabaseClient } from '../client';
import {
  auditEvents,
  availabilityRules,
  domainEvents,
  services,
  serviceVersions,
  statusTransitions,
  tutorProfiles,
  tutorVerifications,
} from '../schema/index';
import { tutorPublicationFacts } from './tutor-services';

/**
 * A TUTOR'S OWN PROFILE — reading it, changing it, and pausing their listing.
 *
 * Every function takes the tutor profile id (or the user id) resolved from the
 * SESSION. There is no profile reference a tutor could supply to reach another
 * tutor's row.
 *
 * WHAT A TUTOR MAY CHANGE is the words and the scope families see: headline,
 * teaching approach, year levels, formats and how much room they have. Not their
 * name, their status, or any visibility state a person at Studdy set. The one
 * visibility move a tutor has is pausing and resuming THEIR OWN listing, and
 * resuming only ever restores what they paused from.
 */

export interface TutorOwnProfile {
  readonly tutorProfileId: string;
  readonly reference: string;
  readonly firstName: string;
  readonly headline: string | null;
  readonly teachingApproach: string | null;
  readonly yearLevelFrom: number | null;
  readonly yearLevelTo: number | null;
  readonly offersOnline: boolean;
  readonly offersInPerson: boolean;
  readonly availabilityLabelCode: string;
  readonly statusCode: string;
  /** Families can find this profile, given a published service. */
  readonly listed: boolean;
  /** The tutor paused their own listing, and may resume it. */
  readonly pausedByTutor: boolean;
  readonly verificationLabels: readonly string[];
}

/** The signed-in tutor's profile, or null when they have no working profile. */
export async function tutorOwnProfile(userId: string): Promise<TutorOwnProfile | null> {
  const { sql: client, db } = createDatabaseClient();
  try {
    const [row] = await db
      .select()
      .from(tutorProfiles)
      .where(
        and(
          eq(tutorProfiles.userId, userId),
          inArray(tutorProfiles.statusCode, [...TUTOR_WORKSPACE_PROFILE_STATUSES]),
          isNull(tutorProfiles.archivedAt),
        ),
      )
      .limit(1);
    if (row === undefined) return null;

    const labels = await db
      .select({ labelCode: tutorVerifications.labelCode })
      .from(tutorVerifications)
      .where(
        and(
          eq(tutorVerifications.tutorProfileId, row.id),
          eq(tutorVerifications.statusCode, 'active'),
          isNull(tutorVerifications.archivedAt),
        ),
      );

    return {
      tutorProfileId: row.id,
      reference: row.reference,
      firstName: row.publicFirstName,
      headline: row.headline,
      teachingApproach: row.teachingApproach,
      yearLevelFrom: row.yearLevelFrom,
      yearLevelTo: row.yearLevelTo,
      offersOnline: row.offersOnline,
      offersInPerson: row.offersInPerson,
      availabilityLabelCode: row.availabilityLabelCode,
      statusCode: row.statusCode,
      listed:
        (PUBLISHING_PROFILE_STATUSES as readonly string[]).includes(row.statusCode) &&
        isListedVisibility(row.visibilityStateCode),
      pausedByTutor: row.visibilityBeforePauseCode !== null,
      verificationLabels: labels.map((label) => label.labelCode).sort(),
    };
  } finally {
    await client.end();
  }
}

interface ProfileCommand {
  readonly tutorProfileId: string;
  readonly actorUserId: string;
  readonly correlationId: string;
  readonly now?: Date;
}

export type UpdateTutorProfileResult =
  | { readonly status: 'updated' }
  | { readonly status: 'not_found' }
  /** A live service is taught in a format this edit would stop offering. */
  | { readonly status: 'format_in_use'; readonly format: 'online' | 'in_person' };

/**
 * Save a tutor's edit of their public profile.
 *
 * REFUSES TO DROP A FORMAT A LIVE SERVICE STILL USES. Discovery reads the format
 * from the profile and the booking journey reads it from the service; letting
 * them disagree would list a tutor as online-only while selling an in-person
 * lesson. The tutor changes the service first, which is reviewed.
 *
 * The old and new words are both written to the audit trail: this text is shown
 * to families without a second review, so what it said and when is kept.
 */
export async function updateTutorProfile(
  input: ProfileCommand & { readonly profile: ValidatedTutorProfile },
): Promise<UpdateTutorProfileResult> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx): Promise<UpdateTutorProfileResult> => {
      const [current] = await tx
        .select()
        .from(tutorProfiles)
        .where(
          and(
            eq(tutorProfiles.id, input.tutorProfileId),
            inArray(tutorProfiles.statusCode, [...TUTOR_WORKSPACE_PROFILE_STATUSES]),
            isNull(tutorProfiles.archivedAt),
          ),
        )
        .for('update')
        .limit(1);
      if (current === undefined) return { status: 'not_found' };

      const formats = await tx
        .selectDistinct({ formatCode: serviceVersions.formatCode })
        .from(serviceVersions)
        .innerJoin(services, eq(serviceVersions.serviceId, services.id))
        .where(
          and(
            eq(services.tutorProfileId, input.tutorProfileId),
            ne(services.statusCode, 'archived'),
            isNull(services.archivedAt),
            inArray(serviceVersions.statusCode, ['draft', 'current']),
          ),
        );
      const used = new Set(formats.map((row) => row.formatCode));
      const needsOnline = used.has('online') || used.has('either') || used.has('any');
      const needsInPerson = used.has('in_person') || used.has('either') || used.has('any');
      if (needsOnline && !input.profile.offersOnline) {
        return { status: 'format_in_use', format: 'online' };
      }
      if (needsInPerson && !input.profile.offersInPerson) {
        return { status: 'format_in_use', format: 'in_person' };
      }

      await tx
        .update(tutorProfiles)
        .set({
          headline: input.profile.headline,
          teachingApproach: input.profile.teachingApproach,
          yearLevelFrom: input.profile.yearLevelFrom,
          yearLevelTo: input.profile.yearLevelTo,
          offersOnline: input.profile.offersOnline,
          offersInPerson: input.profile.offersInPerson,
          availabilityLabelCode: input.profile.availabilityLabelCode,
          updatedAt: now,
        })
        .where(eq(tutorProfiles.id, current.id));

      await tx.insert(auditEvents).values({
        category: 'business',
        action: 'tutor_profile.updated',
        entityType: 'tutor_profile',
        entityId: current.id,
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        occurredAt: now,
        originalValue: {
          headline: current.headline,
          teachingApproach: current.teachingApproach,
          yearLevelFrom: current.yearLevelFrom,
          yearLevelTo: current.yearLevelTo,
          offersOnline: current.offersOnline,
          offersInPerson: current.offersInPerson,
          availabilityLabelCode: current.availabilityLabelCode,
        },
        newValue: { ...input.profile },
        riskLevel: 'medium',
      });
      await tx.insert(domainEvents).values({
        eventType: 'tutor_profile.updated',
        entityType: 'tutor_profile',
        entityId: current.id,
        payload: { tutorProfileId: current.id },
        correlationId: input.correlationId,
        occurredAt: now,
      });
      return { status: 'updated' };
    });
  } finally {
    await client.end();
  }
}

export type ListingResult = { readonly status: 'done' | 'not_found' | 'not_allowed' };

/**
 * Pause the tutor's own listing: they leave discovery and cannot be asked for new
 * lessons. Requests and bookings already made are untouched.
 *
 * Only from a LISTED state, and the state they were in is remembered so resuming
 * cannot be used to climb out of a reduced visibility a person at Studdy set.
 */
export async function pauseTutorListing(input: ProfileCommand): Promise<ListingResult> {
  return moveListing(input, 'pause');
}

/**
 * Resume a listing the tutor paused themselves.
 *
 * REFUSED UNLESS THE TUTOR WAS THE ONE WHO PAUSED. An `unlisted` profile with no
 * remembered state was unlisted by someone else, for a reason, and this is not a
 * way around it.
 */
export async function resumeTutorListing(input: ProfileCommand): Promise<ListingResult> {
  return moveListing(input, 'resume');
}

async function moveListing(
  input: ProfileCommand,
  direction: 'pause' | 'resume',
): Promise<ListingResult> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx): Promise<ListingResult> => {
      const [current] = await tx
        .select({
          id: tutorProfiles.id,
          visibility: tutorProfiles.visibilityStateCode,
          before: tutorProfiles.visibilityBeforePauseCode,
        })
        .from(tutorProfiles)
        .where(
          and(
            eq(tutorProfiles.id, input.tutorProfileId),
            inArray(tutorProfiles.statusCode, [...TUTOR_WORKSPACE_PROFILE_STATUSES]),
            isNull(tutorProfiles.archivedAt),
          ),
        )
        .for('update')
        .limit(1);
      if (current === undefined) return { status: 'not_found' };

      let to: string;
      if (direction === 'pause') {
        if (!isListedVisibility(current.visibility) || current.before !== null) {
          return { status: 'not_allowed' };
        }
        to = 'unlisted';
      } else {
        if (
          current.visibility !== 'unlisted' ||
          current.before === null ||
          !isListedVisibility(current.before)
        ) {
          return { status: 'not_allowed' };
        }
        to = current.before;
      }

      await tx
        .update(tutorProfiles)
        .set({
          visibilityStateCode: to,
          visibilityBeforePauseCode: direction === 'pause' ? current.visibility : null,
          updatedAt: now,
        })
        .where(eq(tutorProfiles.id, current.id));
      await tx.insert(statusTransitions).values({
        entityType: 'tutor_profile.visibility',
        entityId: current.id,
        fromStatusCode: current.visibility,
        toStatusCode: to,
        actorUserId: input.actorUserId,
        reasonCode: direction === 'pause' ? 'tutor_paused_listing' : 'tutor_resumed_listing',
        correlationId: input.correlationId,
        occurredAt: now,
      });
      await tx.insert(auditEvents).values({
        category: 'business',
        action:
          direction === 'pause' ? 'tutor_profile.listing_paused' : 'tutor_profile.listing_resumed',
        entityType: 'tutor_profile',
        entityId: current.id,
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        occurredAt: now,
        originalValue: { visibility: current.visibility },
        newValue: { visibility: to },
        riskLevel: 'medium',
      });
      return { status: 'done' };
    });
  } finally {
    await client.end();
  }
}

/**
 * The facts the setup checklist is a function of, for one tutor.
 *
 * Counts and booleans only. The checklist itself is `tutorSetupChecklist` in the
 * domain, so every screen that shows it derives the same answer from these.
 */
export async function tutorSetupFacts(tutorProfileId: string): Promise<TutorSetupFacts | null> {
  const { sql: client, db } = createDatabaseClient();
  let facts: Omit<TutorSetupFacts, 'payoutsRequiredToPublish' | 'canReceivePayments'>;
  try {
    const [profile] = await db
      .select()
      .from(tutorProfiles)
      .where(and(eq(tutorProfiles.id, tutorProfileId), isNull(tutorProfiles.archivedAt)))
      .limit(1);
    if (profile === undefined) return null;

    const serviceRows = await db
      .select({ statusCode: services.statusCode })
      .from(services)
      .where(
        and(
          eq(services.tutorProfileId, tutorProfileId),
          ne(services.statusCode, 'archived'),
          isNull(services.archivedAt),
        ),
      );
    const count = (status: string): number =>
      serviceRows.filter((row) => row.statusCode === status).length;

    const rules = await db
      .select({ id: availabilityRules.id })
      .from(availabilityRules)
      .where(
        and(
          eq(availabilityRules.tutorProfileId, tutorProfileId),
          eq(availabilityRules.statusCode, 'active'),
          isNull(availabilityRules.archivedAt),
        ),
      );

    facts = {
      profileComplete: isTutorProfileComplete(profile),
      profileEligible:
        (PUBLISHING_PROFILE_STATUSES as readonly string[]).includes(profile.statusCode) &&
        (isListedVisibility(profile.visibilityStateCode) ||
          profile.visibilityBeforePauseCode !== null),
      listingPaused: profile.visibilityBeforePauseCode !== null,
      services: {
        draft: count('draft'),
        pendingApproval: count('pending_approval'),
        changesRequested: count('changes_requested'),
        approved: count('approved'),
        published: count('published'),
        unpublished: count('unpublished'),
      },
      availabilityRuleCount: rules.length,
    };
  } finally {
    await client.end();
  }
  return { ...facts, ...(await tutorPublicationFacts(tutorProfileId)) };
}
