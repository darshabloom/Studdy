import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { createDatabaseClient } from '../client';
import { connectedAccounts, paymentEvents, tutorProfiles } from '../schema/index';
import {
  applyProviderAccountState,
  canTutorReceivePaymentsById,
  connectedAccountExists,
  connectedAccountForTutor,
  recordConnectedAccount,
  recordProviderEvent,
  tutorPayoutStatus,
  type ProviderAccountSnapshot,
} from '../repositories/connected-accounts';

/**
 * Connect onboarding's database-level guarantees.
 *
 * NO STRIPE KEY IS NEEDED, and no network call is made. Everything Stripe would
 * return is represented as a snapshot, which is the shape the adapter produces —
 * so these tests exercise the real persistence and readiness paths while
 * staying runnable in CI with nothing configured.
 *
 * What is asserted here is what only the database can enforce: that a tutor
 * cannot end up with two connected accounts, that an event can only ever move
 * the row that owns its account id, that a replayed event changes nothing, and
 * that a stale one cannot roll payability backwards.
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

/** A not-yet-verified Stripe account, as the adapter would report it. */
function pendingSnapshot(providerAccountId: string): ProviderAccountSnapshot {
  return {
    providerAccountId,
    chargesEnabled: false,
    payoutsEnabled: false,
    transfersCapability: 'pending',
    detailsSubmitted: false,
    currentlyDue: ['individual.id_number'],
    pastDue: [],
    disabledReason: null,
    currentDeadline: null,
  };
}

/** A fully verified, payable account. */
function readySnapshot(providerAccountId: string): ProviderAccountSnapshot {
  return {
    providerAccountId,
    chargesEnabled: true,
    payoutsEnabled: true,
    transfersCapability: 'active',
    detailsSubmitted: true,
    currentlyDue: [],
    pastDue: [],
    disabledReason: null,
    currentDeadline: null,
  };
}

describe.skipIf(!available)('stripe connect onboarding (integration)', () => {
  let tutorA: string;
  let tutorB: string;
  const createdEventIds: string[] = [];

  beforeAll(async () => {
    const { sql, db } = createDatabaseClient();
    try {
      const rows = await db.select({ id: tutorProfiles.id }).from(tutorProfiles).limit(2);
      if (rows.length < 2) throw new Error('seed must provide at least two tutor profiles');
      tutorA = rows[0]!.id;
      tutorB = rows[1]!.id;
    } finally {
      await sql.end();
    }
  });

  beforeEach(async () => {
    const { sql, db } = createDatabaseClient();
    try {
      await db.delete(paymentEvents);
      await db
        .delete(connectedAccounts)
        .where(inArray(connectedAccounts.tutorProfileId, [tutorA, tutorB]));
    } finally {
      await sql.end();
    }
    createdEventIds.length = 0;
  });

  afterAll(async () => {
    const { sql, db } = createDatabaseClient();
    try {
      await db.delete(paymentEvents);
      await db
        .delete(connectedAccounts)
        .where(inArray(connectedAccounts.tutorProfileId, [tutorA, tutorB]));
    } finally {
      await sql.end();
    }
  });

  describe('first onboarding', () => {
    it('creates exactly one connected account for the tutor', async () => {
      const record = await recordConnectedAccount({
        tutorProfileId: tutorA,
        provider: 'stripe',
        accountTypeCode: 'express',
        snapshot: pendingSnapshot('acct_first'),
      });

      expect(record.providerAccountId).toBe('acct_first');
      expect(record.accountTypeCode).toBe('express');
      expect(record.status).toBe('pending');
      expect(record.canReceivePayments).toBe(false);

      const { sql, db } = createDatabaseClient();
      try {
        const rows = await db
          .select({ id: connectedAccounts.id })
          .from(connectedAccounts)
          .where(eq(connectedAccounts.tutorProfileId, tutorA));
        expect(rows).toHaveLength(1);
      } finally {
        await sql.end();
      }
    });

    it('records the moment onboarding started, and no completion yet', async () => {
      await recordConnectedAccount({
        tutorProfileId: tutorA,
        provider: 'stripe',
        accountTypeCode: 'express',
        snapshot: pendingSnapshot('acct_started'),
      });
      const record = await connectedAccountForTutor(tutorA);
      expect(record?.onboardedAt).toBeNull();
      expect(record?.providerSyncedAt).not.toBeNull();
    });

    /**
     * THE IDEMPOTENCY GUARANTEE, at the database rather than in a code path.
     * A tutor who double-clicks, or a retried request, must not end up with two
     * Stripe accounts — the second would be invisible and never transferred to.
     */
    it('reuses the existing account when start is pressed again', async () => {
      const first = await recordConnectedAccount({
        tutorProfileId: tutorA,
        provider: 'stripe',
        accountTypeCode: 'express',
        snapshot: pendingSnapshot('acct_reuse'),
      });
      const second = await recordConnectedAccount({
        tutorProfileId: tutorA,
        provider: 'stripe',
        accountTypeCode: 'express',
        snapshot: pendingSnapshot('acct_would_be_duplicate'),
      });

      expect(second.id).toBe(first.id);
      expect(second.providerAccountId).toBe('acct_reuse');

      const { sql, db } = createDatabaseClient();
      try {
        const rows = await db
          .select({ id: connectedAccounts.id })
          .from(connectedAccounts)
          .where(eq(connectedAccounts.tutorProfileId, tutorA));
        expect(rows).toHaveLength(1);
      } finally {
        await sql.end();
      }
    });

    it('survives two concurrent starts without creating two accounts', async () => {
      const results = await Promise.allSettled([
        recordConnectedAccount({
          tutorProfileId: tutorA,
          provider: 'stripe',
          accountTypeCode: 'express',
          snapshot: pendingSnapshot('acct_race_one'),
        }),
        recordConnectedAccount({
          tutorProfileId: tutorA,
          provider: 'stripe',
          accountTypeCode: 'express',
          snapshot: pendingSnapshot('acct_race_two'),
        }),
      ]);
      expect(results.some((r) => r.status === 'fulfilled')).toBe(true);

      const { sql, db } = createDatabaseClient();
      try {
        const rows = await db
          .select({ id: connectedAccounts.id })
          .from(connectedAccounts)
          .where(eq(connectedAccounts.tutorProfileId, tutorA));
        expect(rows).toHaveLength(1);
      } finally {
        await sql.end();
      }
    });
  });

  describe('readiness derives from provider state, never from Studdy', () => {
    it('is not payable while transfers are only pending', async () => {
      await recordConnectedAccount({
        tutorProfileId: tutorA,
        provider: 'stripe',
        accountTypeCode: 'express',
        snapshot: pendingSnapshot('acct_pending'),
      });
      expect(await canTutorReceivePaymentsById(tutorA)).toBe(false);
    });

    it('becomes payable when the provider says transfers are active and payouts enabled', async () => {
      await recordConnectedAccount({
        tutorProfileId: tutorA,
        provider: 'stripe',
        accountTypeCode: 'express',
        snapshot: pendingSnapshot('acct_becomes_ready'),
      });
      await applyProviderAccountState({
        providerAccountId: 'acct_becomes_ready',
        snapshot: readySnapshot('acct_becomes_ready'),
        eventCreatedAt: null,
      });
      expect(await canTutorReceivePaymentsById(tutorA)).toBe(true);
      const record = await connectedAccountForTutor(tutorA);
      expect(record?.status).toBe('complete');
      expect(record?.onboardedAt).not.toBeNull();
    });

    /**
     * Studdy uses separate charges and transfers, so the connected account
     * never creates a charge. Refusing a tutor because `charges_enabled` is
     * false would block a perfectly payable person for a capability Studdy
     * does not use.
     */
    it('does not require charges_enabled on the connected account', async () => {
      await recordConnectedAccount({
        tutorProfileId: tutorA,
        provider: 'stripe',
        accountTypeCode: 'express',
        snapshot: { ...readySnapshot('acct_no_charges'), chargesEnabled: false },
      });
      expect(await canTutorReceivePaymentsById(tutorA)).toBe(true);
    });

    it('reports a tutor with no account as not payable', async () => {
      expect(await canTutorReceivePaymentsById(tutorB)).toBe(false);
      const view = await tutorPayoutStatus(tutorB);
      expect(view.status).toBe('not_onboarded');
      expect(view.canReceivePayments).toBe(false);
    });

    it('never leaks the provider account id into the tutor projection', async () => {
      await recordConnectedAccount({
        tutorProfileId: tutorA,
        provider: 'stripe',
        accountTypeCode: 'express',
        snapshot: readySnapshot('acct_secret_id'),
      });
      const view = await tutorPayoutStatus(tutorA);
      expect(JSON.stringify(view)).not.toContain('acct_secret_id');
      expect(Object.keys(view)).not.toContain('providerAccountId');
    });
  });

  describe('account.updated events', () => {
    const eventFor = (accountId: string, id: string, createdAt: Date) => ({
      provider: 'stripe',
      providerEventId: id,
      eventType: 'account.updated',
      redactedPayload: { providerAccountId: accountId },
      providerAccountId: accountId,
      snapshot: readySnapshot(accountId),
      eventCreatedAt: createdAt,
    });

    beforeEach(async () => {
      await recordConnectedAccount({
        tutorProfileId: tutorA,
        provider: 'stripe',
        accountTypeCode: 'express',
        snapshot: pendingSnapshot('acct_events'),
      });
    });

    it('applies a valid event and makes the tutor payable', async () => {
      const outcome = await recordProviderEvent(eventFor('acct_events', 'evt_1', new Date()));
      expect(outcome).toBe('applied');
      expect(await canTutorReceivePaymentsById(tutorA)).toBe(true);
    });

    /** Stripe retries delivery freely; a duplicate must be a no-op, not an error. */
    it('treats a duplicate delivery as harmless', async () => {
      const event = eventFor('acct_events', 'evt_duplicate', new Date());
      expect(await recordProviderEvent(event)).toBe('applied');
      expect(await recordProviderEvent(event)).toBe('duplicate');

      const { sql, db } = createDatabaseClient();
      try {
        const rows = await db
          .select({ id: paymentEvents.id })
          .from(paymentEvents)
          .where(eq(paymentEvents.providerEventId, 'evt_duplicate'));
        expect(rows).toHaveLength(1);
      } finally {
        await sql.end();
      }
    });

    /**
     * AN EVENT FOR AN UNKNOWN ACCOUNT MUST TOUCH NOTHING. This is the isolation
     * guarantee: routing is by `provider_account_id`, so an event naming an
     * account Studdy does not hold matches zero rows rather than the wrong one.
     */
    it('cannot alter another tutor from an unknown provider account', async () => {
      await recordConnectedAccount({
        tutorProfileId: tutorB,
        provider: 'stripe',
        accountTypeCode: 'express',
        snapshot: pendingSnapshot('acct_tutor_b'),
      });

      const outcome = await recordProviderEvent(
        eventFor('acct_not_ours', 'evt_unknown', new Date()),
      );
      expect(outcome).toBe('ignored');

      expect(await canTutorReceivePaymentsById(tutorA)).toBe(false);
      expect(await canTutorReceivePaymentsById(tutorB)).toBe(false);
      expect(await connectedAccountExists('acct_not_ours')).toBe(false);
    });

    it('applies an event only to the account that owns it', async () => {
      await recordConnectedAccount({
        tutorProfileId: tutorB,
        provider: 'stripe',
        accountTypeCode: 'express',
        snapshot: pendingSnapshot('acct_tutor_b_iso'),
      });

      await recordProviderEvent(eventFor('acct_events', 'evt_only_a', new Date()));

      expect(await canTutorReceivePaymentsById(tutorA)).toBe(true);
      expect(await canTutorReceivePaymentsById(tutorB)).toBe(false);
    });

    /**
     * WEBHOOK DELIVERY IS NOT ORDERED. A stale event arriving after a newer one
     * must not roll a tutor's payability backwards to a state they have left.
     */
    it('ignores an event older than the one already applied', async () => {
      const newer = new Date();
      const older = new Date(newer.getTime() - 60_000);

      await recordProviderEvent(eventFor('acct_events', 'evt_newer', newer));
      expect(await canTutorReceivePaymentsById(tutorA)).toBe(true);

      const stale = {
        ...eventFor('acct_events', 'evt_older', older),
        snapshot: pendingSnapshot('acct_events'),
      };
      expect(await recordProviderEvent(stale)).toBe('ignored');
      expect(await canTutorReceivePaymentsById(tutorA)).toBe(true);
    });

    it('records the event in the shared provider-event ledger, unattached to a payment', async () => {
      await recordProviderEvent(eventFor('acct_events', 'evt_ledger', new Date()));
      const { sql, db } = createDatabaseClient();
      try {
        const [row] = await db
          .select({
            provider: paymentEvents.provider,
            eventType: paymentEvents.eventType,
            statusCode: paymentEvents.statusCode,
            paymentId: paymentEvents.paymentId,
          })
          .from(paymentEvents)
          .where(eq(paymentEvents.providerEventId, 'evt_ledger'));
        expect(row?.provider).toBe('stripe');
        expect(row?.eventType).toBe('account.updated');
        expect(row?.statusCode).toBe('applied');
        // Nullable by design: a Connect event concerns no payment.
        expect(row?.paymentId).toBeNull();
      } finally {
        await sql.end();
      }
    });

    /** A restriction after completion must be reflected, not sticky-optimistic. */
    it('moves a payable tutor to restricted when Stripe disables the account', async () => {
      await recordProviderEvent(eventFor('acct_events', 'evt_ready', new Date()));
      expect(await canTutorReceivePaymentsById(tutorA)).toBe(true);

      await recordProviderEvent({
        ...eventFor('acct_events', 'evt_restricted', new Date(Date.now() + 60_000)),
        snapshot: {
          ...readySnapshot('acct_events'),
          payoutsEnabled: false,
          transfersCapability: 'inactive',
          disabledReason: 'requirements.past_due',
          pastDue: ['individual.verification.document'],
        },
      });

      const record = await connectedAccountForTutor(tutorA);
      expect(record?.status).toBe('restricted');
      expect(record?.canReceivePayments).toBe(false);
      // The historical fact that they once completed is not erased.
      expect(record?.onboardedAt).not.toBeNull();
    });
  });
});
