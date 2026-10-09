import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabaseClient } from '../client';
import {
  beginRefund,
  recordRefundOutcome,
  refundReport,
  unsettledRefunds,
} from '../repositories/refunds';
import { paymentFixtures, type PaymentFixture } from './helpers/payment-fixtures';

/**
 * REFUNDS — giving a parent's money back, against a real Postgres.
 *
 * NO STRIPE IS NEEDED, which is the point of the boundary: the repository decides
 * and records, and the provider call is the web layer's job (proved separately in
 * `refunds.test.ts`). What is asserted here is what money depends on — that only
 * a payment that arrived with NO booking can be refunded, that two operators
 * clicking at once produce ONE refund, that the intent is on record before
 * anything is attempted, that an answer is recorded once and never walked
 * backwards, and that the family is told exactly once.
 *
 * Every payment here reaches its state through the REAL fulfilment command, not
 * by writing the flag: a late success is produced by a tutor with no payout
 * account, and a booking by a normal success.
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

interface RefundRow {
  reference: string;
  attempt: number;
  status_code: string;
  amount_minor: string;
  currency_code: string;
  provider: string | null;
  provider_refund_id: string | null;
  provider_status: string | null;
  failure_code: string | null;
  idempotency_key: string;
  completed: boolean;
}

describe.skipIf(!available)('refunds (integration)', () => {
  const fixtures = paymentFixtures(900);
  afterEach(async () => {
    await fixtures.cleanup();
  });

  const refundRows = async (paymentId: string): Promise<RefundRow[]> => {
    const { sql } = createDatabaseClient();
    try {
      return (await sql`
        select reference, attempt, status_code, amount_minor::text as amount_minor, currency_code,
               provider, provider_refund_id, provider_status, failure_code, idempotency_key,
               (completed_at is not null) as completed
        from payments.refunds
        where payment_id = ${paymentId}::uuid
        order by attempt`) as unknown as RefundRow[];
    } finally {
      await sql.end();
    }
  };

  const outboxFor = async (
    fixture: PaymentFixture,
    eventType: string,
  ): Promise<{ idempotency_key: string; payload: Record<string, unknown> }[]> => {
    const { sql } = createDatabaseClient();
    try {
      return (await sql`
        select idempotency_key, payload
        from audit.outbox_entries
        where event_type = ${eventType} and payload->>'paymentId' = ${fixture.paymentId}`) as unknown as {
        idempotency_key: string;
        payload: Record<string, unknown>;
      }[];
    } finally {
      await sql.end();
    }
  };

  const start = async (fixture: PaymentFixture) =>
    beginRefund({
      paymentReference: fixture.paymentReference,
      reasonCode: 'booking_not_confirmed',
      correlationId: randomUUID(),
    });

  const startedRefund = async (fixture: PaymentFixture) => {
    const result = await start(fixture);
    if (result.status !== 'started')
      throw new Error(`expected a started refund: ${result.refusal}`);
    return result.refund;
  };

  const answer = (
    refundId: string,
    providerStatus: string,
    overrides: { providerRefundId?: string | null; failureCode?: string | null } = {},
  ) =>
    recordRefundOutcome({
      refundId,
      providerStatus,
      providerRefundId: 'providerRefundId' in overrides ? overrides.providerRefundId! : 're_fix_1',
      failureCode: overrides.failureCode ?? null,
      correlationId: randomUUID(),
    });

  // -------------------------------------------------------------------------

  describe('beginRefund — the intent, written before anything is attempted', () => {
    it('writes a requested refund for a payment that succeeded and was flagged', async () => {
      const fixture = await fixtures.flaggedForRefund();
      const result = await start(fixture);

      expect(result.status).toBe('started');
      if (result.status !== 'started') return;
      expect(result.refund.amountMinor).toBe(4000n);
      expect(result.refund.currencyCode).toBe('NZD');
      expect(result.refund.attempt).toBe(1);
      expect(result.refund.idempotencyKey).toBe(`refund:${fixture.paymentId}:1`);
      expect(result.refund.providerPaymentIntentId).toBe(fixture.providerPaymentIntentId);
      expect(result.refund.paymentReference).toBe(fixture.paymentReference);

      const rows = await refundRows(fixture.paymentId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        status_code: 'requested',
        amount_minor: '4000',
        currency_code: 'NZD',
        provider: 'stripe',
        provider_refund_id: null,
        idempotency_key: `refund:${fixture.paymentId}:1`,
        completed: false,
      });
      expect(rows[0]!.reference).toMatch(/^RF-\d{8}$/);
    });

    it('records the intent in the status history and a high-risk audit event', async () => {
      const fixture = await fixtures.flaggedForRefund();
      const refund = await startedRefund(fixture);

      const { sql } = createDatabaseClient();
      try {
        const transitions = await sql`
          select from_status_code, to_status_code, reason_code
          from audit.status_transitions
          where entity_type = 'refund' and entity_id = ${refund.refundId}`;
        expect(transitions).toHaveLength(1);
        expect(transitions[0]!['from_status_code']).toBeNull();
        expect(transitions[0]!['to_status_code']).toBe('requested');
        expect(transitions[0]!['reason_code']).toBe('booking_not_confirmed');

        const audit = await sql`
          select risk_level, category from audit.audit_events
          where action = 'payment.refund_requested' and entity_id = ${fixture.paymentId}`;
        expect(audit).toHaveLength(1);
        expect(audit[0]!['risk_level']).toBe('high');
        expect(audit[0]!['category']).toBe('financial');
      } finally {
        await sql.end();
      }
    });

    /** The family is told AFTER the provider accepts, never when the intent is written. */
    it('tells the family nothing yet', async () => {
      const fixture = await fixtures.flaggedForRefund();
      await startedRefund(fixture);
      expect(await outboxFor(fixture, 'payment.refunded')).toHaveLength(0);
    });

    it('refuses a payment that does not exist', async () => {
      const result = await beginRefund({
        paymentReference: 'PAY-00000000',
        reasonCode: 'booking_not_confirmed',
        correlationId: randomUUID(),
      });
      expect(result).toEqual({
        status: 'refused',
        refusal: 'payment_not_found',
        paymentReference: null,
      });
    });

    it('refuses a payment that has not succeeded, and writes nothing', async () => {
      const fixture = await fixtures.awaitingPayment();
      const result = await start(fixture);
      expect(result).toMatchObject({ status: 'refused', refusal: 'payment_not_succeeded' });
      expect(await refundRows(fixture.paymentId)).toHaveLength(0);
    });

    /** THE SAFETY RULE: a booked lesson is never refunded through this path. */
    it('refuses a payment that was confirmed into a booking, and writes nothing', async () => {
      const fixture = await fixtures.confirmed();
      const result = await start(fixture);
      expect(result).toMatchObject({ status: 'refused', refusal: 'booking_confirmed' });
      expect(await refundRows(fixture.paymentId)).toHaveLength(0);
    });

    it('refuses a second refund while the first is in flight', async () => {
      const fixture = await fixtures.flaggedForRefund();
      await startedRefund(fixture);
      expect(await start(fixture)).toMatchObject({
        status: 'refused',
        refusal: 'refund_in_flight',
      });
      expect(await refundRows(fixture.paymentId)).toHaveLength(1);
    });

    /**
     * TWO OPERATORS AT ONCE. The payment row is locked for the decision, so the
     * second caller waits, then reads the first's row and refuses — rather than
     * both reading "no refund yet" and both writing one.
     */
    it('lets exactly one of several simultaneous requests start a refund', async () => {
      const fixture = await fixtures.flaggedForRefund();
      const results = await Promise.all([
        start(fixture),
        start(fixture),
        start(fixture),
        start(fixture),
      ]);

      expect(results.filter((result) => result.status === 'started')).toHaveLength(1);
      for (const result of results) {
        if (result.status === 'refused') expect(result.refusal).toBe('refund_in_flight');
      }
      expect(await refundRows(fixture.paymentId)).toHaveLength(1);
    });

    it('refuses a payment that has already been refunded', async () => {
      const fixture = await fixtures.flaggedForRefund();
      const refund = await startedRefund(fixture);
      await answer(refund.refundId, 'succeeded');
      expect(await start(fixture)).toMatchObject({
        status: 'refused',
        refusal: 'already_refunded',
      });
    });

    /** A refund that FAILED did not return the money, so another attempt is allowed. */
    it('allows a new attempt, with its own key, after a failed refund', async () => {
      const fixture = await fixtures.flaggedForRefund();
      const first = await startedRefund(fixture);
      await answer(first.refundId, 'failed', { providerRefundId: null, failureCode: 'x' });

      const second = await startedRefund(fixture);
      expect(second.attempt).toBe(2);
      expect(second.idempotencyKey).toBe(`refund:${fixture.paymentId}:2`);
      expect(second.amountMinor).toBe(4000n);
      expect(second.refundId).not.toBe(first.refundId);

      const rows = await refundRows(fixture.paymentId);
      expect(rows.map((row) => row.status_code)).toEqual(['failed', 'requested']);
    });
  });

  // -------------------------------------------------------------------------

  describe('recordRefundOutcome — the answer, recorded once', () => {
    it('settles a refund the provider completed, and tells the family once', async () => {
      const fixture = await fixtures.flaggedForRefund();
      const refund = await startedRefund(fixture);

      expect(await answer(refund.refundId, 'succeeded')).toBe('succeeded');

      const [row] = await refundRows(fixture.paymentId);
      expect(row).toMatchObject({
        status_code: 'succeeded',
        provider_refund_id: 're_fix_1',
        provider_status: 'succeeded',
        failure_code: null,
        completed: true,
      });

      const told = await outboxFor(fixture, 'payment.refunded');
      expect(told).toHaveLength(1);
      expect(told[0]!.idempotency_key).toBe(`payment.refunded:${refund.refundId}`);
      // Carries ids only, and the tutor request the family is resolved from.
      expect(told[0]!.payload).toEqual({
        tutorRequestId: fixture.tutorRequestId,
        paymentId: fixture.paymentId,
        refundId: refund.refundId,
      });

      const { sql } = createDatabaseClient();
      try {
        const transitions = await sql`
          select from_status_code, to_status_code from audit.status_transitions
          where entity_type = 'refund' and entity_id = ${refund.refundId}
          order by occurred_at, to_status_code`;
        expect(transitions.map((row) => row['to_status_code']).sort()).toEqual([
          'requested',
          'succeeded',
        ]);
      } finally {
        await sql.end();
      }
    });

    /** A redelivered or raced answer must change nothing and tell nobody twice. */
    it('is idempotent: a repeated answer changes nothing and sends nothing more', async () => {
      const fixture = await fixtures.flaggedForRefund();
      const refund = await startedRefund(fixture);

      expect(await answer(refund.refundId, 'succeeded')).toBe('succeeded');
      expect(await answer(refund.refundId, 'succeeded')).toBe('unchanged');
      // Even a contradictory late answer cannot walk a settled refund backwards.
      expect(await answer(refund.refundId, 'failed', { failureCode: 'late' })).toBe('unchanged');

      const [row] = await refundRows(fixture.paymentId);
      expect(row!.status_code).toBe('succeeded');
      expect(await outboxFor(fixture, 'payment.refunded')).toHaveLength(1);
      expect(await outboxFor(fixture, 'payment.refund_failed')).toHaveLength(0);
    });

    it('holds under simultaneous answers: one transition, one email', async () => {
      const fixture = await fixtures.flaggedForRefund();
      const refund = await startedRefund(fixture);

      const outcomes = await Promise.all([
        answer(refund.refundId, 'succeeded'),
        answer(refund.refundId, 'succeeded'),
        answer(refund.refundId, 'succeeded'),
      ]);

      expect(outcomes.filter((outcome) => outcome === 'succeeded')).toHaveLength(1);
      expect(await outboxFor(fixture, 'payment.refunded')).toHaveLength(1);
    });

    /** Accepted but not yet settled: the family is told on ACCEPTANCE, and only once. */
    it('tells the family when the provider accepts a pending refund, and not again on settling', async () => {
      const fixture = await fixtures.flaggedForRefund();
      const refund = await startedRefund(fixture);

      expect(await answer(refund.refundId, 'pending')).toBe('pending');
      let [row] = await refundRows(fixture.paymentId);
      expect(row).toMatchObject({
        status_code: 'pending',
        provider_refund_id: 're_fix_1',
        completed: false,
      });
      expect(await outboxFor(fixture, 'payment.refunded')).toHaveLength(1);

      // Asked again and still pending: nothing changes.
      expect(await answer(refund.refundId, 'pending')).toBe('unchanged');

      expect(await answer(refund.refundId, 'succeeded')).toBe('succeeded');
      [row] = await refundRows(fixture.paymentId);
      expect(row).toMatchObject({ status_code: 'succeeded', completed: true });
      expect(await outboxFor(fixture, 'payment.refunded')).toHaveLength(1);
    });

    /** A refused refund tells the family nothing, because nothing happened to their money. */
    it('records a failure, alerts operations, and tells the family nothing', async () => {
      const fixture = await fixtures.flaggedForRefund();
      const refund = await startedRefund(fixture);

      expect(
        await answer(refund.refundId, 'failed', {
          providerRefundId: null,
          failureCode: 'charge_already_refunded',
        }),
      ).toBe('failed');

      const [row] = await refundRows(fixture.paymentId);
      expect(row).toMatchObject({
        status_code: 'failed',
        failure_code: 'charge_already_refunded',
        provider_refund_id: null,
        completed: true,
      });

      expect(await outboxFor(fixture, 'payment.refunded')).toHaveLength(0);
      const alert = await outboxFor(fixture, 'payment.refund_failed');
      expect(alert).toHaveLength(1);
      expect(alert[0]!.idempotency_key).toBe(`payment.refund_failed:${refund.refundId}`);
      expect(alert[0]!.payload['reason']).toBe('charge_already_refunded');

      const { sql } = createDatabaseClient();
      try {
        const audit = await sql`
          select risk_level from audit.audit_events
          where action = 'payment.refund_failed' and entity_id = ${fixture.paymentId}`;
        expect(audit).toHaveLength(1);
        expect(audit[0]!['risk_level']).toBe('high');
      } finally {
        await sql.end();
      }
    });

    /** A status Studdy has never seen must never read as money returned. */
    it('treats an unknown provider status as pending, never succeeded', async () => {
      const fixture = await fixtures.flaggedForRefund();
      const refund = await startedRefund(fixture);

      expect(await answer(refund.refundId, 'a_status_nobody_has_seen')).toBe('pending');
      const [row] = await refundRows(fixture.paymentId);
      expect(row!.status_code).toBe('pending');
    });

    /**
     * RECORDED AS PENDING, BUT NOT PROMISED. Recording an unrecognised status as
     * pending keeps the sweep asking; it must not email a family that their money
     * is on its way, because the provider has not said so. The email waits for a
     * status the provider actually uses to mean accepted — and is then sent once.
     */
    it('does not tell the family on an unrecognised status, only once the provider accepts', async () => {
      const fixture = await fixtures.flaggedForRefund();
      const refund = await startedRefund(fixture);

      await answer(refund.refundId, 'a_status_nobody_has_seen');
      expect(await outboxFor(fixture, 'payment.refunded')).toHaveLength(0);

      // `requires_action` also means the refund cannot proceed yet.
      await answer(refund.refundId, 'requires_action');
      expect(await outboxFor(fixture, 'payment.refunded')).toHaveLength(0);

      // The provider now says pending: that IS acceptance, and it is the first time.
      expect(await answer(refund.refundId, 'pending')).toBe('unchanged');
      expect(await outboxFor(fixture, 'payment.refunded')).toHaveLength(1);

      // Settling afterwards adds nothing.
      expect(await answer(refund.refundId, 'succeeded')).toBe('succeeded');
      expect(await outboxFor(fixture, 'payment.refunded')).toHaveLength(1);
    });

    /**
     * The database refuses a pending or succeeded refund with no provider id, and
     * the recording must not throw at that constraint and lose the answer.
     */
    it('leaves a refund unchanged when the answer carries no provider refund id', async () => {
      const fixture = await fixtures.flaggedForRefund();
      const refund = await startedRefund(fixture);

      expect(await answer(refund.refundId, 'succeeded', { providerRefundId: null })).toBe(
        'unchanged',
      );
      const [row] = await refundRows(fixture.paymentId);
      expect(row!.status_code).toBe('requested');
      expect(await outboxFor(fixture, 'payment.refunded')).toHaveLength(0);
    });

    it('reports a refund that does not exist', async () => {
      expect(await answer(randomUUID(), 'succeeded')).toBe('refund_not_found');
    });
  });

  // -------------------------------------------------------------------------

  describe('what an operator can read', () => {
    it('lists a flagged payment awaiting a decision, then stops listing it once started', async () => {
      const fixture = await fixtures.flaggedForRefund();

      const before = await refundReport({ limit: 500 });
      const listed = before.awaitingRefund.find(
        (row) => row.paymentReference === fixture.paymentReference,
      );
      expect(listed).toBeDefined();
      expect(listed!.amountMinor).toBe(4000n);
      expect(listed!.currencyCode).toBe('NZD');

      await startedRefund(fixture);
      const after = await refundReport({ limit: 500 });
      expect(
        after.awaitingRefund.some((row) => row.paymentReference === fixture.paymentReference),
      ).toBe(false);
      expect(after.byStatus['requested']).toBeGreaterThanOrEqual(1);
    });

    /** The report must never invite a refund the executor would refuse. */
    it('does not list a payment that became a booking', async () => {
      const fixture = await fixtures.confirmed();
      const report = await refundReport({ limit: 500 });
      expect(
        report.awaitingRefund.some((row) => row.paymentReference === fixture.paymentReference),
      ).toBe(false);
    });

    it('returns refunds the provider has not answered, and only after a grace period for a fresh one', async () => {
      const fixture = await fixtures.flaggedForRefund();
      const refund = await startedRefund(fixture);
      const ids = (rows: readonly { refundId: string }[]) => rows.map((row) => row.refundId);

      // A refund the original caller is probably still sending: left alone.
      expect(ids(await unsettledRefunds({ limit: 500 }))).not.toContain(refund.refundId);

      // Once it is old enough that the caller must have died, it is resumed.
      const later = new Date(Date.now() + 10 * 60 * 1000);
      const resumed = await unsettledRefunds({ limit: 500, now: later });
      expect(ids(resumed)).toContain(refund.refundId);
      const row = resumed.find((candidate) => candidate.refundId === refund.refundId)!;
      expect(row.statusCode).toBe('requested');
      expect(row.amountMinor).toBe(4000n);
      expect(row.idempotencyKey).toBe(refund.idempotencyKey);
      expect(row.providerPaymentIntentId).toBe(fixture.providerPaymentIntentId);

      // Pending needs no grace: the provider already accepted it.
      await answer(refund.refundId, 'pending');
      const pending = await unsettledRefunds({ limit: 500 });
      expect(ids(pending)).toContain(refund.refundId);
      expect(
        pending.find((candidate) => candidate.refundId === refund.refundId)!.providerRefundId,
      ).toBe('re_fix_1');

      // And a settled refund is no longer anybody's business.
      await answer(refund.refundId, 'succeeded');
      expect(ids(await unsettledRefunds({ limit: 500, now: later }))).not.toContain(
        refund.refundId,
      );
    });
  });

  // -------------------------------------------------------------------------

  describe('the database refuses what the domain would never write', () => {
    const insertRefund = async (
      fixture: PaymentFixture,
      overrides: {
        attempt?: number;
        reason?: string;
        amount?: string;
        status?: string;
        providerRefundId?: string | null;
        completed?: boolean;
      } = {},
    ) => {
      const { sql } = createDatabaseClient();
      try {
        await sql`
          insert into payments.refunds
            (payment_id, attempt, reason_code, amount_minor, currency_code, status_code,
             provider, provider_refund_id, idempotency_key, completed_at)
          values (${fixture.paymentId}::uuid, ${overrides.attempt ?? 2},
                  ${overrides.reason ?? 'booking_not_confirmed'},
                  ${overrides.amount ?? '4000'}::bigint, 'NZD', ${overrides.status ?? 'requested'},
                  'stripe', ${overrides.providerRefundId ?? null},
                  ${'refund:' + randomUUID()},
                  ${overrides.completed === true ? new Date().toISOString() : null})`;
      } finally {
        await sql.end();
      }
    };

    it('refuses a second live refund for one payment', async () => {
      const fixture = await fixtures.flaggedForRefund();
      await startedRefund(fixture);
      await expect(insertRefund(fixture, { attempt: 2 })).rejects.toThrow(
        /refund_live_per_payment_unique_idx|duplicate key/,
      );
    });

    it('refuses a succeeded refund with no provider refund id', async () => {
      const fixture = await fixtures.flaggedForRefund();
      await expect(insertRefund(fixture, { status: 'succeeded', completed: true })).rejects.toThrow(
        /refund_provider_answered_check/,
      );
    });

    it('refuses a refund that ended without saying when', async () => {
      const fixture = await fixtures.flaggedForRefund();
      await expect(insertRefund(fixture, { status: 'failed', completed: false })).rejects.toThrow(
        /refund_completed_check/,
      );
    });

    it('refuses a refund of nothing', async () => {
      const fixture = await fixtures.flaggedForRefund();
      await expect(insertRefund(fixture, { amount: '0' })).rejects.toThrow(
        /refund_amount_positive_check/,
      );
    });

    it('refuses a reason outside the approved set', async () => {
      const fixture = await fixtures.flaggedForRefund();
      await expect(insertRefund(fixture, { reason: 'goodwill' })).rejects.toThrow(
        /refund_reason_check/,
      );
    });
  });
});
