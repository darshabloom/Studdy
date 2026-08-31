import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import {
  canTutorReceivePayments,
  connectedAccountStatusFor,
  NO_CONNECTED_ACCOUNT,
  type CapabilityStatus,
  type ConnectedAccountState,
  type ConnectedAccountStatus,
} from '@studdy/domain/payments';
import { createDatabaseClient } from '../client';
import { connectedAccounts, paymentEvents } from '../schema/index';

/**
 * Connected-account persistence — everything Studdy remembers about whether a
 * tutor can be paid.
 *
 * TWO RULES HOLD THROUGHOUT THIS FILE.
 *
 * 1. **The provider is authoritative.** Nothing here accepts a payability value
 *    from a caller who did not get it from Stripe. There is no function to
 *    "mark a tutor ready"; readiness is computed from provider state by the
 *    domain rule and nowhere else.
 * 2. **A tutor is scoped to their own row, always.** Every read and write is
 *    keyed by `tutor_profile_id` or by a `provider_account_id` that arrived
 *    inside a signature-verified event. There is no path that takes a tutor id
 *    and an account id from the same request.
 */

/** What a tutor's own screen is allowed to know. NO provider account id. */
export interface TutorPayoutStatusView {
  readonly status: ConnectedAccountStatus;
  readonly canReceivePayments: boolean;
  readonly detailsSubmitted: boolean;
  /** Requirement identifiers, so the tutor can be told what is outstanding. */
  readonly currentlyDue: readonly string[];
  readonly pastDue: readonly string[];
  readonly disabledReason: string | null;
  readonly currentDeadline: Date | null;
  readonly onboardedAt: Date | null;
  readonly providerSyncedAt: Date | null;
}

/** The internal record, including the identifier no browser may see. */
export interface ConnectedAccountRecord extends TutorPayoutStatusView {
  readonly id: string;
  readonly tutorProfileId: string;
  readonly provider: string;
  readonly providerAccountId: string;
  readonly accountTypeCode: string;
}

interface Row {
  id: string;
  tutorProfileId: string;
  provider: string;
  providerAccountId: string;
  accountTypeCode: string;
  statusCode: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  transfersCapabilityCode: string;
  detailsSubmitted: boolean;
  requirementsCurrentlyDue: unknown;
  requirementsPastDue: unknown;
  requirementsDisabledReason: string | null;
  requirementsCurrentDeadline: Date | null;
  onboardedAt: Date | null;
  providerSyncedAt: Date | null;
}

function identifiers(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Rebuild the domain state from a row, so readiness has ONE definition. */
export function stateFromRow(row: Row): ConnectedAccountState {
  return {
    chargesEnabled: row.chargesEnabled,
    payoutsEnabled: row.payoutsEnabled,
    transfersCapability: row.transfersCapabilityCode as CapabilityStatus,
    detailsSubmitted: row.detailsSubmitted,
    currentlyDue: identifiers(row.requirementsCurrentlyDue),
    pastDue: identifiers(row.requirementsPastDue),
    disabledReason: row.requirementsDisabledReason,
  };
}

function toRecord(row: Row): ConnectedAccountRecord {
  const state = stateFromRow(row);
  return {
    id: row.id,
    tutorProfileId: row.tutorProfileId,
    provider: row.provider,
    providerAccountId: row.providerAccountId,
    accountTypeCode: row.accountTypeCode,
    status: row.statusCode as ConnectedAccountStatus,
    // Recomputed from the stored provider fields rather than read from
    // status_code. The stored status is a denormalisation for filtering; the
    // rule is the source of truth, and if they ever disagree the rule wins.
    canReceivePayments: canTutorReceivePayments(state),
    detailsSubmitted: row.detailsSubmitted,
    currentlyDue: state.currentlyDue,
    pastDue: state.pastDue,
    disabledReason: state.disabledReason,
    currentDeadline: row.requirementsCurrentDeadline,
    onboardedAt: row.onboardedAt,
    providerSyncedAt: row.providerSyncedAt,
  };
}

const columns = {
  id: connectedAccounts.id,
  tutorProfileId: connectedAccounts.tutorProfileId,
  provider: connectedAccounts.provider,
  providerAccountId: connectedAccounts.providerAccountId,
  accountTypeCode: connectedAccounts.accountTypeCode,
  statusCode: connectedAccounts.statusCode,
  chargesEnabled: connectedAccounts.chargesEnabled,
  payoutsEnabled: connectedAccounts.payoutsEnabled,
  transfersCapabilityCode: connectedAccounts.transfersCapabilityCode,
  detailsSubmitted: connectedAccounts.detailsSubmitted,
  requirementsCurrentlyDue: connectedAccounts.requirementsCurrentlyDue,
  requirementsPastDue: connectedAccounts.requirementsPastDue,
  requirementsDisabledReason: connectedAccounts.requirementsDisabledReason,
  requirementsCurrentDeadline: connectedAccounts.requirementsCurrentDeadline,
  onboardedAt: connectedAccounts.onboardedAt,
  providerSyncedAt: connectedAccounts.providerSyncedAt,
};

/** The live connected account for a tutor, or null. Scoped by tutor, always. */
export async function connectedAccountForTutor(
  tutorProfileId: string,
): Promise<ConnectedAccountRecord | null> {
  const { sql: client, db } = createDatabaseClient();
  try {
    const [row] = await db
      .select(columns)
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.tutorProfileId, tutorProfileId),
          isNull(connectedAccounts.archivedAt),
        ),
      )
      .limit(1);
    return row === undefined ? null : toRecord(row as Row);
  } finally {
    await client.end();
  }
}

/**
 * THE TUTOR-FACING PROJECTION. Never returns `provider_account_id`.
 *
 * A tutor has no use for their `acct_` id — Studdy talks to Stripe on their
 * behalf — and an identifier a screen never needs is one that cannot leak from
 * a screen. A tutor with no account gets the not-onboarded shape rather than
 * null, so callers have one thing to render.
 */
export async function tutorPayoutStatus(tutorProfileId: string): Promise<TutorPayoutStatusView> {
  const record = await connectedAccountForTutor(tutorProfileId);
  if (record === null) {
    return {
      status: 'not_onboarded',
      canReceivePayments: false,
      detailsSubmitted: false,
      currentlyDue: [],
      pastDue: [],
      disabledReason: null,
      currentDeadline: null,
      onboardedAt: null,
      providerSyncedAt: null,
    };
  }
  const {
    id: _id,
    tutorProfileId: _tutor,
    provider: _provider,
    providerAccountId: _accountId,
    accountTypeCode: _type,
    ...view
  } = record;
  return view;
}

/**
 * THE READINESS QUESTION, asked of the database.
 *
 * The one function the rest of Studdy calls to decide whether a tutor may be
 * offered for a paid booking. It reads provider state and applies the domain
 * rule; it never reads `status_code`.
 */
export async function canTutorReceivePaymentsById(tutorProfileId: string): Promise<boolean> {
  const record = await connectedAccountForTutor(tutorProfileId);
  return record !== null && record.canReceivePayments;
}

export interface ProviderAccountSnapshot {
  readonly providerAccountId: string;
  readonly chargesEnabled: boolean;
  readonly payoutsEnabled: boolean;
  readonly transfersCapability: CapabilityStatus;
  readonly detailsSubmitted: boolean;
  readonly currentlyDue: readonly string[];
  readonly pastDue: readonly string[];
  readonly disabledReason: string | null;
  readonly currentDeadline: Date | null;
}

function statusFor(snapshot: ProviderAccountSnapshot): ConnectedAccountStatus {
  return connectedAccountStatusFor({
    chargesEnabled: snapshot.chargesEnabled,
    payoutsEnabled: snapshot.payoutsEnabled,
    transfersCapability: snapshot.transfersCapability,
    detailsSubmitted: snapshot.detailsSubmitted,
    currentlyDue: snapshot.currentlyDue,
    pastDue: snapshot.pastDue,
    disabledReason: snapshot.disabledReason,
  });
}

/**
 * Record a connected account Studdy just created at the provider.
 *
 * IDEMPOTENT BY CONSTRAINT, not by a prior read. `ON CONFLICT DO NOTHING`
 * against the one-live-account-per-tutor index means two concurrent "start
 * onboarding" clicks cannot produce two rows: the loser inserts nothing and
 * reads the winner's row. A check-then-insert would leave exactly the race this
 * avoids.
 */
export async function recordConnectedAccount(input: {
  readonly tutorProfileId: string;
  readonly provider: string;
  readonly accountTypeCode: string;
  readonly snapshot: ProviderAccountSnapshot;
  readonly now?: Date;
}): Promise<ConnectedAccountRecord> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    const payable = canTutorReceivePayments({
      chargesEnabled: input.snapshot.chargesEnabled,
      payoutsEnabled: input.snapshot.payoutsEnabled,
      transfersCapability: input.snapshot.transfersCapability,
      detailsSubmitted: input.snapshot.detailsSubmitted,
      currentlyDue: input.snapshot.currentlyDue,
      pastDue: input.snapshot.pastDue,
      disabledReason: input.snapshot.disabledReason,
    });
    await db
      .insert(connectedAccounts)
      .values({
        tutorProfileId: input.tutorProfileId,
        provider: input.provider,
        providerAccountId: input.snapshot.providerAccountId,
        accountTypeCode: input.accountTypeCode,
        statusCode: statusFor(input.snapshot),
        chargesEnabled: input.snapshot.chargesEnabled,
        payoutsEnabled: input.snapshot.payoutsEnabled,
        transfersCapabilityCode: input.snapshot.transfersCapability,
        detailsSubmitted: input.snapshot.detailsSubmitted,
        requirementsCurrentlyDue: [...input.snapshot.currentlyDue],
        requirementsPastDue: [...input.snapshot.pastDue],
        requirementsDisabledReason: input.snapshot.disabledReason,
        requirementsCurrentDeadline: input.snapshot.currentDeadline,
        onboardingStartedAt: now,
        onboardedAt: payable ? now : null,
        providerSyncedAt: now,
      })
      .onConflictDoNothing();

    const [row] = await db
      .select(columns)
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.tutorProfileId, input.tutorProfileId),
          isNull(connectedAccounts.archivedAt),
        ),
      )
      .limit(1);
    if (row === undefined) {
      throw new Error('Connected account could not be recorded for this tutor.');
    }
    return toRecord(row as Row);
  } finally {
    await client.end();
  }
}

/**
 * Apply authoritative provider state to the row that owns the account id.
 *
 * THE ACCOUNT ID IS THE ONLY KEY. No tutor id is accepted, which is what makes
 * this safe to call from a webhook: an event can only ever move the row whose
 * `provider_account_id` matches, so a forged or misdirected event for an
 * unknown account updates ZERO rows rather than the wrong one.
 *
 * ORDERING GUARD. Webhook delivery is unordered and Stripe retries freely, so a
 * stale `account.updated` can arrive after a newer one. Applying it would roll
 * a tutor's payability backwards to a state they had already left. The update
 * is guarded on `last_provider_event_at`, so an older event changes nothing.
 *
 * Returns the number of rows updated: 0 means unknown account or stale event,
 * and the caller distinguishes them.
 */
export async function applyProviderAccountState(input: {
  readonly providerAccountId: string;
  readonly snapshot: ProviderAccountSnapshot;
  /** The provider event's own timestamp. Null for a direct read (always newest). */
  readonly eventCreatedAt: Date | null;
  readonly now?: Date;
}): Promise<number> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    const payable = canTutorReceivePayments({
      chargesEnabled: input.snapshot.chargesEnabled,
      payoutsEnabled: input.snapshot.payoutsEnabled,
      transfersCapability: input.snapshot.transfersCapability,
      detailsSubmitted: input.snapshot.detailsSubmitted,
      currentlyDue: input.snapshot.currentlyDue,
      pastDue: input.snapshot.pastDue,
      disabledReason: input.snapshot.disabledReason,
    });
    const eventAt = input.eventCreatedAt;

    /*
     * THE ORDERING GUARD, written with drizzle operators rather than a raw
     * `sql` fragment. Interpolating a Date into a raw template hands the driver
     * a value it cannot bind — it typechecks perfectly and fails at runtime,
     * which is a trap this repository has already been caught by once.
     */
    const freshness =
      eventAt === null
        ? undefined
        : or(
            isNull(connectedAccounts.lastProviderEventAt),
            lt(connectedAccounts.lastProviderEventAt, eventAt),
          );

    const updated = await db
      .update(connectedAccounts)
      .set({
        statusCode: statusFor(input.snapshot),
        chargesEnabled: input.snapshot.chargesEnabled,
        payoutsEnabled: input.snapshot.payoutsEnabled,
        transfersCapabilityCode: input.snapshot.transfersCapability,
        detailsSubmitted: input.snapshot.detailsSubmitted,
        requirementsCurrentlyDue: [...input.snapshot.currentlyDue],
        requirementsPastDue: [...input.snapshot.pastDue],
        requirementsDisabledReason: input.snapshot.disabledReason,
        requirementsCurrentDeadline: input.snapshot.currentDeadline,
        /*
         * Set once and never cleared: the first time a tutor became payable is
         * a historical fact, and a later restriction does not unmake it. The
         * timestamp is bound as an ISO string with an explicit cast, for the
         * same Date-binding reason as above.
         */
        ...(payable
          ? {
              onboardedAt: sql`coalesce(${connectedAccounts.onboardedAt}, ${now.toISOString()}::timestamptz)`,
            }
          : {}),
        providerSyncedAt: now,
        ...(eventAt === null ? {} : { lastProviderEventAt: eventAt }),
        updatedAt: now,
      })
      .where(
        and(
          eq(connectedAccounts.providerAccountId, input.providerAccountId),
          isNull(connectedAccounts.archivedAt),
          ...(freshness === undefined ? [] : [freshness]),
        ),
      )
      .returning({ id: connectedAccounts.id });
    return updated.length;
  } finally {
    await client.end();
  }
}

/** Whether Studdy knows this provider account at all. Distinguishes 0-row cases. */
export async function connectedAccountExists(providerAccountId: string): Promise<boolean> {
  const { sql: client, db } = createDatabaseClient();
  try {
    const [row] = await db
      .select({ id: connectedAccounts.id })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.providerAccountId, providerAccountId))
      .limit(1);
    return row !== undefined;
  } finally {
    await client.end();
  }
}

export type ProviderEventOutcome = 'applied' | 'duplicate' | 'ignored';

/**
 * Record a provider event and apply it, exactly once.
 *
 * WHY `payments.payment_events` RATHER THAN A NEW TABLE. That table was built
 * in slice 3 as the provider-event ledger and the idempotency spine, not as a
 * payment-only log: `provider` and `event_type` are generic columns, and
 * `payment_id` is nullable precisely so an event Studdy cannot attach to a
 * payment is still stored rather than lost. A Connect event is exactly that
 * case. Standing up a parallel `connect_events` table would duplicate the
 * unique-constraint idempotency mechanism, and two half-used ledgers is a worse
 * answer than one used properly.
 *
 * IDEMPOTENCY IS THE UNIQUE INDEX, not a prior lookup. Stripe retries delivery
 * freely and duplicates are the normal case; the insert collides and the caller
 * returns success without applying anything twice.
 *
 * THE PAYLOAD IS REDACTED, and this is a deliberate departure from that table's
 * "kept whole" contract. A raw `account.updated` carries the full Account
 * object, which for an Express account includes the tutor's name, date of
 * birth, address and document details. Studdy has no use for any of it, and
 * storing identity data it never reads would create a liability in exchange for
 * nothing. What is kept is the decision-relevant projection: capability states,
 * the payability flags, and requirement IDENTIFIERS.
 */
export async function recordProviderEvent(input: {
  readonly provider: string;
  readonly providerEventId: string;
  readonly eventType: string;
  /** Already redacted by the caller. Never a raw provider payload. */
  readonly redactedPayload: unknown;
  readonly providerAccountId: string;
  readonly snapshot: ProviderAccountSnapshot;
  readonly eventCreatedAt: Date;
  readonly now?: Date;
}): Promise<ProviderEventOutcome> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    const inserted = await db
      .insert(paymentEvents)
      .values({
        provider: input.provider,
        providerEventId: input.providerEventId,
        eventType: input.eventType,
        payload: input.redactedPayload as never,
        statusCode: 'received',
        receivedAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: paymentEvents.id });

    // Already seen. Stripe is retrying; say yes and change nothing.
    if (inserted.length === 0) return 'duplicate';
    const eventId = inserted[0]!.id;

    const updatedRows = await applyProviderAccountState({
      providerAccountId: input.providerAccountId,
      snapshot: input.snapshot,
      eventCreatedAt: input.eventCreatedAt,
      now,
    });

    const outcome: ProviderEventOutcome = updatedRows > 0 ? 'applied' : 'ignored';
    await db
      .update(paymentEvents)
      .set({
        statusCode: updatedRows > 0 ? 'applied' : 'ignored',
        processedAt: now,
        // A reason, never a payload dump. An event for an account Studdy does
        // not know is normal on a shared Stripe account, not an error.
        errorNote:
          updatedRows > 0
            ? null
            : 'No live connected account matched, or a newer event was already applied.',
        updatedAt: now,
      })
      .where(eq(paymentEvents.id, eventId));

    return outcome;
  } finally {
    await client.end();
  }
}

export { NO_CONNECTED_ACCOUNT };
