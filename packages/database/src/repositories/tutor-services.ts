import { and, asc, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import { canTutorReceivePayments, type CapabilityStatus } from '@studdy/domain/payments';
import {
  ARCHIVABLE_SERVICE_STATUSES,
  EDITABLE_SERVICE_STATUSES,
  PUBLISHABLE_SERVICE_STATUSES,
  REVIEWABLE_SERVICE_STATUSES,
  REVISABLE_SERVICE_STATUSES,
  SERVICE_CURRENCY_CODE,
  TUTOR_SERVICE_RULE_KEYS,
  isServiceStatus,
  publicationReadiness,
  publicationRequiresPayouts,
  type PublicationBlocker,
  type ServiceFormatCode,
  type ServiceStatus,
  type ValidatedTutorService,
} from '@studdy/domain/tutors';
import { createDatabaseClient } from '../client';
import {
  auditEvents,
  connectedAccounts,
  domainEvents,
  outboxEntries,
  ruleSettings,
  serviceReviews,
  services,
  serviceVersions,
  statusTransitions,
  subjects,
  tutorProfiles,
} from '../schema/index';
import { publiclyListedTutor } from './tutor-visibility';

/**
 * TUTOR-MANAGED SERVICES — drafting, review, and going on sale.
 *
 * `services.ts` beside this file is the BOOKING side: what a family may buy. This
 * file is the supply side: how a service comes to exist and who lets it be sold.
 * Nothing here can put a service on sale except `publishService`, which is one
 * transaction and re-asks every precondition under a lock.
 *
 * THREE CALLERS, THREE TRUSTS.
 *
 *   The tutor functions take the tutor profile id resolved from the SESSION and
 *   fold it into the WHERE clause, so a reference belonging to another tutor
 *   matches zero rows. "Not yours" and "does not exist" are the same answer.
 *
 *   The reviewer functions take an `actorUserId` for the audit trail but do NOT
 *   decide who may review. That is the web layer's `requireStaff`, which also
 *   re-checks MFA; a repository that guessed at roles would be a second, divergent
 *   source of that decision.
 *
 *   The public read applies the same listing allow-list as discovery, so a
 *   service is exactly as visible here as its tutor is findable.
 *
 * Every state change is `UPDATE ... WHERE status_code IN (<what may move here>)`
 * on a row locked for the decision, so a tutor and a reviewer acting at once
 * serialise and the loser is told the service has moved on.
 *
 * A REVIEWED SERVICE IS NEVER EDITED IN PLACE. `startServiceRevision` copies it
 * into a new draft that is reviewed like any other; publishing the copy retires
 * the original in the same transaction. Rows a booking priced against are never
 * rewritten.
 */

type Db = ReturnType<typeof createDatabaseClient>['db'];
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** How many live services one tutor may hold. A guard against runaway creation. */
export const TUTOR_SERVICE_LIMIT = 20;

/** Version states that are part of a service as it stands. */
const LIVE_VERSION_STATUSES = ['draft', 'current'];

export interface TutorServiceOption {
  readonly durationMinutes: number;
  readonly priceAmountMinor: bigint;
  readonly currencyCode: string;
}

export interface TutorServiceRecord {
  readonly reference: string;
  readonly status: ServiceStatus;
  readonly subjectId: string;
  readonly subjectDisplayName: string;
  readonly displayName: string;
  readonly description: string | null;
  readonly yearLevelFrom: number | null;
  readonly yearLevelTo: number | null;
  readonly formatCode: ServiceFormatCode;
  /** Shortest first. */
  readonly options: readonly TutorServiceOption[];
  readonly publishedAt: Date | null;
  readonly updatedAt: Date;
  /** The reviewed service this draft will replace when published, if any. */
  readonly replacesReference: string | null;
  /** A draft of changes to THIS service that is still in progress, if any. */
  readonly revisionReference: string | null;
  /** What the reviewer wrote for the tutor, shown only while changes are requested. */
  readonly reviewerMessage: string | null;
}

function asFormat(value: string | undefined): ServiceFormatCode {
  if (value === 'in_person' || value === 'either') return value;
  // 'any' is the older spelling of "not restricted".
  return value === 'any' ? 'either' : 'online';
}

function asStatus(value: string): ServiceStatus {
  // The CHECK constraint makes anything else unrepresentable; `archived` is the
  // safe reading of a value this build does not know.
  return isServiceStatus(value) ? value : 'archived';
}

interface ServiceRow {
  readonly id: string;
  readonly reference: string;
  readonly statusCode: string;
  readonly subjectId: string;
  readonly subjectDisplayName: string;
  readonly displayName: string;
  readonly description: string | null;
  readonly yearLevelFrom: number | null;
  readonly yearLevelTo: number | null;
  readonly publishedAt: Date | null;
  readonly updatedAt: Date;
  readonly replacesServiceId: string | null;
}

const serviceColumns = {
  id: services.id,
  reference: services.reference,
  statusCode: services.statusCode,
  subjectId: services.subjectId,
  subjectDisplayName: subjects.displayName,
  displayName: services.displayName,
  description: services.description,
  yearLevelFrom: services.yearLevelFrom,
  yearLevelTo: services.yearLevelTo,
  publishedAt: services.publishedAt,
  updatedAt: services.updatedAt,
  replacesServiceId: services.replacesServiceId,
};

/** Attach options, revision links and the tutor-facing reviewer message to service rows. */
async function hydrate(
  reader: Db | Tx,
  rows: readonly ServiceRow[],
): Promise<TutorServiceRecord[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);

  const versionRows = await reader
    .select({
      serviceId: serviceVersions.serviceId,
      durationMinutes: serviceVersions.durationMinutes,
      priceAmountMinor: serviceVersions.priceAmountMinor,
      currencyCode: serviceVersions.currencyCode,
      formatCode: serviceVersions.formatCode,
    })
    .from(serviceVersions)
    .where(
      and(
        inArray(serviceVersions.serviceId, ids),
        inArray(serviceVersions.statusCode, LIVE_VERSION_STATUSES),
        isNull(serviceVersions.archivedAt),
      ),
    )
    .orderBy(asc(serviceVersions.durationMinutes), asc(serviceVersions.priceAmountMinor));

  // Which reviewed services these drafts replace, and which drafts replace these.
  const replacedIds = rows
    .map((row) => row.replacesServiceId)
    .filter((id): id is string => id !== null);
  const replaced =
    replacedIds.length === 0
      ? []
      : await reader
          .select({ id: services.id, reference: services.reference })
          .from(services)
          .where(inArray(services.id, replacedIds));
  const revisions = await reader
    .select({ replaces: services.replacesServiceId, reference: services.reference })
    .from(services)
    .where(
      and(
        inArray(services.replacesServiceId, ids),
        ne(services.statusCode, 'archived'),
        isNull(services.archivedAt),
      ),
    );

  // The latest changes-requested message, for the services that are in that state.
  const awaitingChanges = rows
    .filter((row) => row.statusCode === 'changes_requested')
    .map((row) => row.id);
  const messages =
    awaitingChanges.length === 0
      ? []
      : await reader
          .select({ serviceId: serviceReviews.serviceId, message: serviceReviews.tutorMessage })
          .from(serviceReviews)
          .where(
            and(
              inArray(serviceReviews.serviceId, awaitingChanges),
              eq(serviceReviews.outcomeCode, 'changes_requested'),
            ),
          )
          .orderBy(desc(serviceReviews.decidedAt));

  return rows.map((row) => {
    const versions = versionRows.filter((version) => version.serviceId === row.id);
    return {
      reference: row.reference,
      status: asStatus(row.statusCode),
      subjectId: row.subjectId,
      subjectDisplayName: row.subjectDisplayName,
      displayName: row.displayName,
      description: row.description,
      yearLevelFrom: row.yearLevelFrom,
      yearLevelTo: row.yearLevelTo,
      formatCode: asFormat(versions[0]?.formatCode),
      options: versions.map((version) => ({
        durationMinutes: version.durationMinutes,
        priceAmountMinor: version.priceAmountMinor,
        currencyCode: version.currencyCode,
      })),
      publishedAt: row.publishedAt,
      updatedAt: row.updatedAt,
      replacesReference:
        replaced.find((candidate) => candidate.id === row.replacesServiceId)?.reference ?? null,
      revisionReference:
        revisions.find((candidate) => candidate.replaces === row.id)?.reference ?? null,
      // `messages` is newest first, so the first match is the latest decision.
      reviewerMessage:
        messages.find((candidate) => candidate.serviceId === row.id)?.message ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// The tutor's own services
// ---------------------------------------------------------------------------

/** Every service this tutor holds that has not been removed, newest change first. */
export async function listServicesForTutor(
  tutorProfileId: string,
): Promise<readonly TutorServiceRecord[]> {
  const { sql: client, db } = createDatabaseClient();
  try {
    const rows = await db
      .select(serviceColumns)
      .from(services)
      .innerJoin(subjects, eq(services.subjectId, subjects.id))
      .where(
        and(
          eq(services.tutorProfileId, tutorProfileId),
          ne(services.statusCode, 'archived'),
          isNull(services.archivedAt),
        ),
      )
      .orderBy(desc(services.updatedAt));
    return await hydrate(db, rows);
  } finally {
    await client.end();
  }
}

/** One of this tutor's services, or null. Scoped by tutor in the query itself. */
export async function serviceForTutor(input: {
  readonly tutorProfileId: string;
  readonly reference: string;
}): Promise<TutorServiceRecord | null> {
  const { sql: client, db } = createDatabaseClient();
  try {
    const rows = await db
      .select(serviceColumns)
      .from(services)
      .innerJoin(subjects, eq(services.subjectId, subjects.id))
      .where(
        and(
          eq(services.tutorProfileId, input.tutorProfileId),
          eq(services.reference, input.reference),
          ne(services.statusCode, 'archived'),
          isNull(services.archivedAt),
        ),
      )
      .limit(1);
    return (await hydrate(db, rows))[0] ?? null;
  } finally {
    await client.end();
  }
}

interface TutorCommand {
  readonly tutorProfileId: string;
  readonly actorUserId: string;
  readonly correlationId: string;
  readonly now?: Date;
}

async function insertVersions(
  tx: Tx,
  serviceId: string,
  service: Pick<ValidatedTutorService, 'options' | 'formatCode'>,
): Promise<void> {
  await tx.insert(serviceVersions).values(
    service.options.map((option, index) => ({
      serviceId,
      versionNumber: index + 1,
      durationMinutes: option.durationMinutes,
      priceAmountMinor: option.priceAmountMinor,
      currencyCode: SERVICE_CURRENCY_CODE,
      formatCode: service.formatCode,
      statusCode: 'draft',
    })),
  );
}

async function recordTransition(
  tx: Tx,
  input: {
    readonly serviceId: string;
    readonly from: string | null;
    readonly to: ServiceStatus;
    readonly reasonCode: string;
    readonly actorUserId: string;
    readonly correlationId: string;
    readonly now: Date;
    readonly riskLevel?: 'low' | 'medium' | 'high';
    readonly detail?: Record<string, unknown>;
  },
): Promise<void> {
  await tx.insert(statusTransitions).values({
    entityType: 'service',
    entityId: input.serviceId,
    fromStatusCode: input.from,
    toStatusCode: input.to,
    actorUserId: input.actorUserId,
    reasonCode: input.reasonCode,
    correlationId: input.correlationId,
    occurredAt: input.now,
  });
  await tx.insert(auditEvents).values({
    category: 'business',
    action: `service.${input.reasonCode}`,
    entityType: 'service',
    entityId: input.serviceId,
    actorUserId: input.actorUserId,
    correlationId: input.correlationId,
    occurredAt: input.now,
    newValue: { status: input.to, ...(input.detail ?? {}) },
    riskLevel: input.riskLevel ?? 'low',
  });
  await tx.insert(domainEvents).values({
    eventType: `service.${input.reasonCode}`,
    entityType: 'service',
    entityId: input.serviceId,
    payload: { serviceId: input.serviceId, ...(input.detail ?? {}) },
    correlationId: input.correlationId,
    occurredAt: input.now,
  });
  /*
   * The three moments somebody other than the actor has to hear about, queued in
   * the same transaction as the change they describe. Ids only: the outbox is a
   * durable record and carries no name or address.
   */
  if (NOTIFIED_REASON_CODES.includes(input.reasonCode)) {
    await tx.insert(outboxEntries).values({
      eventType: `service.${input.reasonCode}`,
      payload: { serviceId: input.serviceId },
      // One per decision: a service can be sent and decided more than once.
      idempotencyKey: `service.${input.reasonCode}:${input.serviceId}:${input.correlationId}`,
      correlationId: input.correlationId,
    });
  }
}

/** Service transitions that owe somebody an email. See `RECIPIENTS_BY_EVENT`. */
const NOTIFIED_REASON_CODES: readonly string[] = ['submitted', 'approved', 'changes_requested'];

export type CreateServiceResult =
  { readonly status: 'created'; readonly reference: string } | { readonly status: 'limit_reached' };

/** A new draft. Not on sale, not in review, and visible to nobody but its tutor. */
export async function createTutorService(
  input: TutorCommand & { readonly service: ValidatedTutorService },
): Promise<CreateServiceResult> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx): Promise<CreateServiceResult> => {
      // Serialise this tutor's creations on their profile row, so the cap holds.
      await tx
        .select({ id: tutorProfiles.id })
        .from(tutorProfiles)
        .where(eq(tutorProfiles.id, input.tutorProfileId))
        .for('update');
      const existing = await tx
        .select({ id: services.id })
        .from(services)
        .where(
          and(
            eq(services.tutorProfileId, input.tutorProfileId),
            ne(services.statusCode, 'archived'),
            isNull(services.archivedAt),
          ),
        );
      if (existing.length >= TUTOR_SERVICE_LIMIT) return { status: 'limit_reached' };

      const [created] = await tx
        .insert(services)
        .values({
          tutorProfileId: input.tutorProfileId,
          subjectId: input.service.subjectId,
          displayName: input.service.displayName,
          description: input.service.description,
          yearLevelFrom: input.service.yearLevelFrom,
          yearLevelTo: input.service.yearLevelTo,
          statusCode: 'draft',
        })
        .returning({ id: services.id, reference: services.reference });
      if (created === undefined) throw new Error('service insert returned no row');
      await insertVersions(tx, created.id, input.service);
      await recordTransition(tx, {
        serviceId: created.id,
        from: null,
        to: 'draft',
        reasonCode: 'created',
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        now,
      });
      return { status: 'created', reference: created.reference };
    });
  } finally {
    await client.end();
  }
}

/** Lock one of this tutor's services for a decision about it. */
async function lockOwnService(tx: Tx, tutorProfileId: string, reference: string) {
  const [row] = await tx
    .select()
    .from(services)
    .where(
      and(
        eq(services.tutorProfileId, tutorProfileId),
        eq(services.reference, reference),
        isNull(services.archivedAt),
      ),
    )
    .for('update')
    .limit(1);
  return row ?? null;
}

export type TutorServiceActionResult =
  { readonly status: 'done' } | { readonly status: 'not_found' | 'not_allowed' };

/**
 * Change a service that has not been reviewed yet (a draft, or one sent back).
 *
 * Its options are replaced outright. Nothing can reference them: a service in
 * these states has never been on sale, so no request or booking was ever priced
 * against one of its versions. The foreign key would refuse the delete if that
 * ever stopped being true, which is the failure wanted.
 */
export async function updateTutorService(
  input: TutorCommand & { readonly reference: string; readonly service: ValidatedTutorService },
): Promise<TutorServiceActionResult> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx): Promise<TutorServiceActionResult> => {
      const service = await lockOwnService(tx, input.tutorProfileId, input.reference);
      if (service === null) return { status: 'not_found' };
      if (!(EDITABLE_SERVICE_STATUSES as readonly string[]).includes(service.statusCode)) {
        return { status: 'not_allowed' };
      }

      await tx
        .update(services)
        .set({
          subjectId: input.service.subjectId,
          displayName: input.service.displayName,
          description: input.service.description,
          yearLevelFrom: input.service.yearLevelFrom,
          yearLevelTo: input.service.yearLevelTo,
          updatedAt: now,
        })
        .where(eq(services.id, service.id));
      await tx
        .delete(serviceVersions)
        .where(
          and(eq(serviceVersions.serviceId, service.id), eq(serviceVersions.statusCode, 'draft')),
        );
      await insertVersions(tx, service.id, input.service);
      return { status: 'done' };
    });
  } finally {
    await client.end();
  }
}

/** Guarded status move for one locked service. False when it had already moved. */
async function move(
  tx: Tx,
  serviceId: string,
  from: readonly ServiceStatus[],
  set: Partial<typeof services.$inferInsert>,
): Promise<boolean> {
  const [moved] = await tx
    .update(services)
    .set(set)
    .where(and(eq(services.id, serviceId), inArray(services.statusCode, [...from])))
    .returning({ id: services.id });
  return moved !== undefined;
}

/** Send a draft, or a service that was sent back, to Studdy for review. */
export async function submitTutorService(
  input: TutorCommand & { readonly reference: string },
): Promise<TutorServiceActionResult> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx): Promise<TutorServiceActionResult> => {
      const service = await lockOwnService(tx, input.tutorProfileId, input.reference);
      if (service === null) return { status: 'not_found' };
      const moved = await move(tx, service.id, EDITABLE_SERVICE_STATUSES, {
        statusCode: 'pending_approval',
        updatedAt: now,
      });
      if (!moved) return { status: 'not_allowed' };

      await tx.insert(serviceReviews).values({
        serviceId: service.id,
        submittedAt: now,
        submittedByUserId: input.actorUserId,
        outcomeCode: 'pending',
      });
      await recordTransition(tx, {
        serviceId: service.id,
        from: service.statusCode,
        to: 'pending_approval',
        reasonCode: 'submitted',
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        now,
      });
      return { status: 'done' };
    });
  } finally {
    await client.end();
  }
}

/** Take a service back out of review, to keep editing it. */
export async function withdrawTutorServiceSubmission(
  input: TutorCommand & { readonly reference: string },
): Promise<TutorServiceActionResult> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx): Promise<TutorServiceActionResult> => {
      const service = await lockOwnService(tx, input.tutorProfileId, input.reference);
      if (service === null) return { status: 'not_found' };
      const moved = await move(tx, service.id, REVIEWABLE_SERVICE_STATUSES, {
        statusCode: 'draft',
        updatedAt: now,
      });
      if (!moved) return { status: 'not_allowed' };

      await tx
        .update(serviceReviews)
        .set({ outcomeCode: 'withdrawn', updatedAt: now })
        .where(
          and(eq(serviceReviews.serviceId, service.id), eq(serviceReviews.outcomeCode, 'pending')),
        );
      await recordTransition(tx, {
        serviceId: service.id,
        from: service.statusCode,
        to: 'draft',
        reasonCode: 'submission_withdrawn',
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        now,
      });
      return { status: 'done' };
    });
  } finally {
    await client.end();
  }
}

export type PublishServiceResult =
  | { readonly status: 'published' }
  | { readonly status: 'not_found' }
  | { readonly status: 'not_ready'; readonly blockers: readonly PublicationBlocker[] };

async function payoutsRequiredToPublish(reader: Db | Tx): Promise<boolean> {
  const [row] = await reader
    .select({ value: ruleSettings.value })
    .from(ruleSettings)
    .where(
      and(
        eq(ruleSettings.settingKey, TUTOR_SERVICE_RULE_KEYS.publicationRequiresPayouts),
        eq(ruleSettings.statusCode, 'current'),
      ),
    )
    .limit(1);
  return publicationRequiresPayouts(row?.value);
}

/** Stripe's own account state, never "they clicked". Read wherever it is asked. */
async function tutorCanReceivePayments(reader: Db | Tx, tutorProfileId: string): Promise<boolean> {
  const [account] = await reader
    .select({
      transfers: connectedAccounts.transfersCapabilityCode,
      payouts: connectedAccounts.payoutsCapabilityCode,
    })
    .from(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.tutorProfileId, tutorProfileId),
        isNull(connectedAccounts.archivedAt),
      ),
    )
    .limit(1);
  return (
    account !== undefined &&
    canTutorReceivePayments({
      transfersCapability: account.transfers as CapabilityStatus,
      payoutsCapability: account.payouts as CapabilityStatus,
      statusDetails: [],
    })
  );
}

/**
 * PUBLISH — the one transaction that puts a service on sale.
 *
 * Under a lock on the tutor's profile and on the service it re-reads everything
 * publication depends on (database spec §8.2): the profile may publish, the
 * service has been reviewed, it has a price, and, unless the rule has been
 * relaxed, the tutor can be paid. Then, together or not at all: the service is
 * published and its options become current; the reviewed service it replaces, if
 * any, is retired; and a tutor publishing for the first time becomes `active`.
 *
 * Republishing a service the tutor took down does not go back through review:
 * what was approved has not changed, because a reviewed service cannot be edited.
 */
export async function publishTutorService(
  input: TutorCommand & { readonly reference: string },
): Promise<PublishServiceResult> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx): Promise<PublishServiceResult> => {
      const [profile] = await tx
        .select({ id: tutorProfiles.id, statusCode: tutorProfiles.statusCode })
        .from(tutorProfiles)
        .where(and(eq(tutorProfiles.id, input.tutorProfileId), isNull(tutorProfiles.archivedAt)))
        .for('update')
        .limit(1);
      if (profile === undefined) return { status: 'not_found' };
      const service = await lockOwnService(tx, input.tutorProfileId, input.reference);
      if (service === null) return { status: 'not_found' };

      const versions = await tx
        .select({ id: serviceVersions.id })
        .from(serviceVersions)
        .where(
          and(
            eq(serviceVersions.serviceId, service.id),
            inArray(serviceVersions.statusCode, LIVE_VERSION_STATUSES),
            isNull(serviceVersions.archivedAt),
          ),
        );
      const readiness = publicationReadiness({
        profileStatus: profile.statusCode,
        serviceStatus: service.statusCode,
        pricedOptionCount: versions.length,
        payoutsRequired: await payoutsRequiredToPublish(tx),
        canReceivePayments: await tutorCanReceivePayments(tx, input.tutorProfileId),
      });
      if (!readiness.ready) return { status: 'not_ready', blockers: readiness.blockers };

      const moved = await move(tx, service.id, PUBLISHABLE_SERVICE_STATUSES, {
        statusCode: 'published',
        publishedAt: now,
        updatedAt: now,
      });
      if (!moved) return { status: 'not_ready', blockers: ['service_not_reviewed'] };
      await tx
        .update(serviceVersions)
        .set({ statusCode: 'current', updatedAt: now })
        .where(
          and(eq(serviceVersions.serviceId, service.id), eq(serviceVersions.statusCode, 'draft')),
        );

      // The reviewed service this one replaces leaves sale in the same breath, so
      // a family never sees the old and the new side by side.
      if (service.replacesServiceId !== null) {
        const [retired] = await tx
          .update(services)
          .set({ statusCode: 'archived', archivedAt: now, updatedAt: now })
          .where(
            and(
              eq(services.id, service.replacesServiceId),
              eq(services.tutorProfileId, input.tutorProfileId),
              inArray(services.statusCode, [...REVISABLE_SERVICE_STATUSES]),
            ),
          )
          .returning({ id: services.id, statusCode: services.statusCode });
        if (retired !== undefined) {
          await recordTransition(tx, {
            serviceId: retired.id,
            from: null,
            to: 'archived',
            reasonCode: 'replaced',
            actorUserId: input.actorUserId,
            correlationId: input.correlationId,
            now,
            detail: { replacedByServiceId: service.id },
          });
        }
      }

      if (profile.statusCode === 'approved') {
        const [activated] = await tx
          .update(tutorProfiles)
          .set({ statusCode: 'active', updatedAt: now })
          .where(and(eq(tutorProfiles.id, profile.id), eq(tutorProfiles.statusCode, 'approved')))
          .returning({ id: tutorProfiles.id });
        if (activated !== undefined) {
          await tx.insert(statusTransitions).values({
            entityType: 'tutor_profile',
            entityId: profile.id,
            fromStatusCode: 'approved',
            toStatusCode: 'active',
            actorUserId: input.actorUserId,
            reasonCode: 'first_service_published',
            correlationId: input.correlationId,
            occurredAt: now,
          });
        }
      }

      await recordTransition(tx, {
        serviceId: service.id,
        from: service.statusCode,
        to: 'published',
        reasonCode: 'published',
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        now,
        riskLevel: 'medium',
      });
      return { status: 'published' };
    });
  } finally {
    await client.end();
  }
}

/**
 * Take a service off sale. New families can no longer ask for it.
 *
 * REQUESTS AND BOOKINGS ALREADY MADE ARE UNTOUCHED. They hold their own service
 * version, so a lesson a family has asked or paid for goes ahead on the terms it
 * was agreed on.
 */
export async function unpublishTutorService(
  input: TutorCommand & { readonly reference: string },
): Promise<TutorServiceActionResult> {
  return simpleMove(input, ['published'], 'unpublished', 'unpublished', {});
}

/** Remove a service that is not on sale. It stays in the record; it leaves the list. */
export async function archiveTutorService(
  input: TutorCommand & { readonly reference: string },
): Promise<TutorServiceActionResult> {
  const now = input.now ?? new Date();
  return simpleMove({ ...input, now }, ARCHIVABLE_SERVICE_STATUSES, 'archived', 'archived', {
    archivedAt: now,
  });
}

async function simpleMove(
  input: TutorCommand & { readonly reference: string },
  from: readonly ServiceStatus[],
  to: ServiceStatus,
  reasonCode: string,
  extra: Partial<typeof services.$inferInsert>,
): Promise<TutorServiceActionResult> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx): Promise<TutorServiceActionResult> => {
      const service = await lockOwnService(tx, input.tutorProfileId, input.reference);
      if (service === null) return { status: 'not_found' };
      const moved = await move(tx, service.id, from, { statusCode: to, updatedAt: now, ...extra });
      if (!moved) return { status: 'not_allowed' };
      // A service leaving review by being removed closes its open review too.
      await tx
        .update(serviceReviews)
        .set({ outcomeCode: 'withdrawn', updatedAt: now })
        .where(
          and(eq(serviceReviews.serviceId, service.id), eq(serviceReviews.outcomeCode, 'pending')),
        );
      await recordTransition(tx, {
        serviceId: service.id,
        from: service.statusCode,
        to,
        reasonCode,
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        now,
      });
      return { status: 'done' };
    });
  } finally {
    await client.end();
  }
}

export type StartRevisionResult =
  | { readonly status: 'started' | 'existing'; readonly reference: string }
  | { readonly status: 'not_found' | 'not_allowed' | 'limit_reached' };

/**
 * Begin changing a REVIEWED service, by copying it into a new draft.
 *
 * The original is left exactly as it is, on sale if it was. One revision at a
 * time: asking again returns the draft already in progress rather than a second.
 */
export async function startServiceRevision(
  input: TutorCommand & { readonly reference: string },
): Promise<StartRevisionResult> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx): Promise<StartRevisionResult> => {
      const service = await lockOwnService(tx, input.tutorProfileId, input.reference);
      if (service === null) return { status: 'not_found' };
      if (!(REVISABLE_SERVICE_STATUSES as readonly string[]).includes(service.statusCode)) {
        return { status: 'not_allowed' };
      }

      const [existing] = await tx
        .select({ reference: services.reference })
        .from(services)
        .where(
          and(
            eq(services.replacesServiceId, service.id),
            ne(services.statusCode, 'archived'),
            isNull(services.archivedAt),
          ),
        )
        .limit(1);
      if (existing !== undefined) return { status: 'existing', reference: existing.reference };

      const live = await tx
        .select({ id: services.id })
        .from(services)
        .where(
          and(
            eq(services.tutorProfileId, input.tutorProfileId),
            ne(services.statusCode, 'archived'),
            isNull(services.archivedAt),
          ),
        );
      if (live.length >= TUTOR_SERVICE_LIMIT) return { status: 'limit_reached' };

      const [copy] = await tx
        .insert(services)
        .values({
          tutorProfileId: service.tutorProfileId,
          subjectId: service.subjectId,
          displayName: service.displayName,
          description: service.description,
          yearLevelFrom: service.yearLevelFrom,
          yearLevelTo: service.yearLevelTo,
          statusCode: 'draft',
          replacesServiceId: service.id,
        })
        .returning({ id: services.id, reference: services.reference });
      if (copy === undefined) throw new Error('service revision insert returned no row');

      const versions = await tx
        .select()
        .from(serviceVersions)
        .where(
          and(
            eq(serviceVersions.serviceId, service.id),
            inArray(serviceVersions.statusCode, LIVE_VERSION_STATUSES),
            isNull(serviceVersions.archivedAt),
          ),
        )
        .orderBy(asc(serviceVersions.durationMinutes));
      if (versions.length > 0) {
        await tx.insert(serviceVersions).values(
          versions.map((version, index) => ({
            serviceId: copy.id,
            versionNumber: index + 1,
            durationMinutes: version.durationMinutes,
            priceAmountMinor: version.priceAmountMinor,
            currencyCode: version.currencyCode,
            formatCode: version.formatCode,
            statusCode: 'draft',
          })),
        );
      }
      await recordTransition(tx, {
        serviceId: copy.id,
        from: null,
        to: 'draft',
        reasonCode: 'revision_started',
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        now,
        detail: { replacesServiceId: service.id },
      });
      return { status: 'started', reference: copy.reference };
    });
  } finally {
    await client.end();
  }
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

export interface ServiceReviewQueueEntry {
  readonly reference: string;
  readonly displayName: string;
  readonly subjectDisplayName: string;
  readonly tutorFirstName: string;
  readonly tutorReference: string;
  readonly submittedAt: Date | null;
  /** True when this is a change to a service that was reviewed before. */
  readonly isRevision: boolean;
}

/** Services waiting on a reviewer, oldest submission first. */
export async function serviceReviewQueue(
  options: { readonly limit?: number } = {},
): Promise<readonly ServiceReviewQueueEntry[]> {
  const { sql: client, db } = createDatabaseClient();
  try {
    const rows = await db
      .select({
        reference: services.reference,
        displayName: services.displayName,
        subjectDisplayName: subjects.displayName,
        tutorFirstName: tutorProfiles.publicFirstName,
        tutorReference: tutorProfiles.reference,
        submittedAt: serviceReviews.submittedAt,
        replacesServiceId: services.replacesServiceId,
      })
      .from(services)
      .innerJoin(subjects, eq(services.subjectId, subjects.id))
      .innerJoin(tutorProfiles, eq(services.tutorProfileId, tutorProfiles.id))
      .leftJoin(
        serviceReviews,
        and(eq(serviceReviews.serviceId, services.id), eq(serviceReviews.outcomeCode, 'pending')),
      )
      .where(and(eq(services.statusCode, 'pending_approval'), isNull(services.archivedAt)))
      .orderBy(asc(serviceReviews.submittedAt))
      .limit(Math.min(options.limit ?? 100, 200));
    return rows.map((row) => ({
      reference: row.reference,
      displayName: row.displayName,
      subjectDisplayName: row.subjectDisplayName,
      tutorFirstName: row.tutorFirstName,
      tutorReference: row.tutorReference,
      submittedAt: row.submittedAt,
      isRevision: row.replacesServiceId !== null,
    }));
  } finally {
    await client.end();
  }
}

export interface ServiceReviewDetail {
  readonly service: TutorServiceRecord;
  readonly tutor: {
    readonly reference: string;
    readonly firstName: string;
    readonly headline: string | null;
    readonly yearLevelFrom: number | null;
    readonly yearLevelTo: number | null;
    readonly offersOnline: boolean;
    readonly offersInPerson: boolean;
  };
  /** The reviewed service this one would replace, to compare against. */
  readonly replaces: TutorServiceRecord | null;
  /** Earlier decisions on this service, newest first. Staff notes included. */
  readonly history: readonly {
    readonly outcome: string;
    readonly submittedAt: Date;
    readonly decidedAt: Date | null;
    readonly tutorMessage: string | null;
    readonly internalNote: string | null;
  }[];
}

/** Everything a reviewer needs to decide one service. */
export async function serviceForReview(reference: string): Promise<ServiceReviewDetail | null> {
  const { sql: client, db } = createDatabaseClient();
  try {
    const rows = await db
      .select({ ...serviceColumns, tutorProfileId: services.tutorProfileId })
      .from(services)
      .innerJoin(subjects, eq(services.subjectId, subjects.id))
      .where(and(eq(services.reference, reference), isNull(services.archivedAt)))
      .limit(1);
    const row = rows[0];
    if (row === undefined) return null;
    const [service] = await hydrate(db, [row]);
    if (service === undefined) return null;

    const [tutor] = await db
      .select({
        reference: tutorProfiles.reference,
        firstName: tutorProfiles.publicFirstName,
        headline: tutorProfiles.headline,
        yearLevelFrom: tutorProfiles.yearLevelFrom,
        yearLevelTo: tutorProfiles.yearLevelTo,
        offersOnline: tutorProfiles.offersOnline,
        offersInPerson: tutorProfiles.offersInPerson,
      })
      .from(tutorProfiles)
      .where(eq(tutorProfiles.id, row.tutorProfileId))
      .limit(1);
    if (tutor === undefined) return null;

    let replaces: TutorServiceRecord | null = null;
    if (row.replacesServiceId !== null) {
      const replacedRows = await db
        .select(serviceColumns)
        .from(services)
        .innerJoin(subjects, eq(services.subjectId, subjects.id))
        .where(eq(services.id, row.replacesServiceId))
        .limit(1);
      replaces = (await hydrate(db, replacedRows))[0] ?? null;
    }

    const history = await db
      .select({
        outcome: serviceReviews.outcomeCode,
        submittedAt: serviceReviews.submittedAt,
        decidedAt: serviceReviews.decidedAt,
        tutorMessage: serviceReviews.tutorMessage,
        internalNote: serviceReviews.internalNote,
      })
      .from(serviceReviews)
      .where(eq(serviceReviews.serviceId, row.id))
      .orderBy(desc(serviceReviews.submittedAt));

    return { service, tutor, replaces, history };
  } finally {
    await client.end();
  }
}

export type ServiceReviewResult = { readonly status: 'done' | 'not_found' | 'not_decidable' };

interface ReviewCommand {
  readonly reference: string;
  readonly actorUserId: string;
  readonly correlationId: string;
  readonly internalNote?: string | null;
  readonly now?: Date;
}

async function decide(
  input: ReviewCommand,
  to: 'approved' | 'changes_requested',
  tutorMessage: string | null,
): Promise<ServiceReviewResult> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx): Promise<ServiceReviewResult> => {
      const [service] = await tx
        .select({ id: services.id, statusCode: services.statusCode })
        .from(services)
        .where(and(eq(services.reference, input.reference), isNull(services.archivedAt)))
        .for('update')
        .limit(1);
      if (service === undefined) return { status: 'not_found' };
      const moved = await move(tx, service.id, REVIEWABLE_SERVICE_STATUSES, {
        statusCode: to,
        updatedAt: now,
      });
      if (!moved) return { status: 'not_decidable' };

      await tx
        .update(serviceReviews)
        .set({
          outcomeCode: to,
          decidedAt: now,
          decidedByUserId: input.actorUserId,
          tutorMessage,
          internalNote: input.internalNote ?? null,
          updatedAt: now,
        })
        .where(
          and(eq(serviceReviews.serviceId, service.id), eq(serviceReviews.outcomeCode, 'pending')),
        );
      await recordTransition(tx, {
        serviceId: service.id,
        from: service.statusCode,
        to,
        reasonCode: to,
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        now,
        riskLevel: 'medium',
      });
      return { status: 'done' };
    });
  } finally {
    await client.end();
  }
}

/** Approve a service. It may now be published, by its tutor, when they choose. */
export async function approveTutorService(input: ReviewCommand): Promise<ServiceReviewResult> {
  return decide(input, 'approved', null);
}

/** Send a service back. `message` is shown to the TUTOR, so it is written for them. */
export async function requestTutorServiceChanges(
  input: ReviewCommand & { readonly message: string },
): Promise<ServiceReviewResult> {
  return decide(input, 'changes_requested', input.message);
}

// ---------------------------------------------------------------------------
// What a family sees
// ---------------------------------------------------------------------------

export interface PublicTutorService {
  readonly displayName: string;
  readonly description: string | null;
  readonly subjectDisplayName: string;
  readonly yearLevelFrom: number | null;
  readonly yearLevelTo: number | null;
  readonly formatCode: ServiceFormatCode;
  readonly options: readonly TutorServiceOption[];
}

/**
 * The services a listed tutor has on sale, for their public profile.
 *
 * THE SAME ALLOW-LIST AS DISCOVERY: a published service of a listed tutor, its
 * current versions, an active subject. An unknown reference, a paused tutor and a
 * tutor with nothing published all return the same empty list.
 */
export async function listPublicServicesForTutor(
  tutorReference: string,
): Promise<readonly PublicTutorService[]> {
  const { sql: client, db } = createDatabaseClient();
  try {
    const rows = await db
      .select(serviceColumns)
      .from(services)
      .innerJoin(subjects, eq(services.subjectId, subjects.id))
      .innerJoin(tutorProfiles, eq(services.tutorProfileId, tutorProfiles.id))
      .where(
        and(
          eq(tutorProfiles.reference, tutorReference),
          publiclyListedTutor(),
          eq(services.statusCode, 'published'),
          isNull(services.archivedAt),
          eq(subjects.statusCode, 'active'),
        ),
      )
      .orderBy(asc(subjects.displayName), asc(services.displayName));
    if (rows.length === 0) return [];

    const versions = await db
      .select({
        serviceId: serviceVersions.serviceId,
        durationMinutes: serviceVersions.durationMinutes,
        priceAmountMinor: serviceVersions.priceAmountMinor,
        currencyCode: serviceVersions.currencyCode,
        formatCode: serviceVersions.formatCode,
      })
      .from(serviceVersions)
      .where(
        and(
          inArray(
            serviceVersions.serviceId,
            rows.map((row) => row.id),
          ),
          eq(serviceVersions.statusCode, 'current'),
          isNull(serviceVersions.archivedAt),
        ),
      )
      .orderBy(asc(serviceVersions.durationMinutes), asc(serviceVersions.priceAmountMinor));

    return rows
      .map((row) => {
        const own = versions.filter((version) => version.serviceId === row.id);
        return {
          displayName: row.displayName,
          description: row.description,
          subjectDisplayName: row.subjectDisplayName,
          yearLevelFrom: row.yearLevelFrom,
          yearLevelTo: row.yearLevelTo,
          formatCode: asFormat(own[0]?.formatCode),
          options: own.map((version) => ({
            durationMinutes: version.durationMinutes,
            priceAmountMinor: version.priceAmountMinor,
            currencyCode: version.currencyCode,
          })),
        };
      })
      .filter((service) => service.options.length > 0);
  } finally {
    await client.end();
  }
}

// ---------------------------------------------------------------------------
// Facts for the setup checklist
// ---------------------------------------------------------------------------

/** Whether a tutor may publish before they can be paid, and whether they can be. */
export async function tutorPublicationFacts(tutorProfileId: string): Promise<{
  readonly payoutsRequiredToPublish: boolean;
  readonly canReceivePayments: boolean;
}> {
  const { sql: client, db } = createDatabaseClient();
  try {
    return {
      payoutsRequiredToPublish: await payoutsRequiredToPublish(db),
      canReceivePayments: await tutorCanReceivePayments(db, tutorProfileId),
    };
  } finally {
    await client.end();
  }
}
