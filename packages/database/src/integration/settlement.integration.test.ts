import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabaseClient } from '../client';
import {
  recordTransferFailed,
  recordTransferSent,
  requeueFailedTransfer,
  settlementCandidate,
  settlementCandidates,
} from '../repositories/settlement';
import { paymentFixtures, type PaymentFixture } from './helpers/payment-fixtures';

/**
 * SETTLEMENT — paying a tutor, against a real Postgres.
 *
 * NO STRIPE IS NEEDED: the repository decides and records, and the provider call
 * is the web layer's job (proved separately in `settlement.test.ts`). What is
 * asserted here is what money depends on — which obligations are owed and which
 * are held and WHY, that a transfer is recorded as sent once and never moved
 * again, that two runs racing the same obligation produce one `sent`, and that a
 * failed obligation is retried as a NEW one rather than re-opened.
 *
 * Every payment reaches its state through the REAL fulfilment command, so the
 * obligation, the booking and the connected account are exactly what production
 * writes. A lesson that has already ended is produced by moving the booking's
 * own schedule into the past afterwards, because the product's rules refuse to
 * create a reservation in the past.
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

interface TransferRow {
  id: string;
  status_code: string;
  amount_minor: string;
  currency_code: string;
  provider_transfer_id: string | null;
  failure_note: string | null;
  idempotency_key: string;
  sent: boolean;
  connected_account_id: string;
}

describe.skipIf(!available)('settlement (integration)', () => {
  const fixtures = paymentFixtures(1300);
  afterEach(async () => {
    await fixtures.cleanup();
  });

  /** A confirmed booking whose lesson finished two hours ago. */
  const endedLesson = async (): Promise<PaymentFixture> => {
    const fixture = await fixtures.confirmed();
    await endLesson(fixture);
    return fixture;
  };

  const endLesson = async (fixture: PaymentFixture): Promise<void> => {
    const { sql } = createDatabaseClient();
    try {
      await sql`
        update bookings.bookings
        set scheduled_start_at = now() - interval '3 hours',
            scheduled_end_at = now() - interval '2 hours'
        where payment_id = ${fixture.paymentId}::uuid`;
    } finally {
      await sql.end();
    }
  };

  const transferRows = async (fixture: PaymentFixture): Promise<TransferRow[]> => {
    const { sql } = createDatabaseClient();
    try {
      return (await sql`
        select id::text as id, status_code, amount_minor::text as amount_minor, currency_code,
               provider_transfer_id, failure_note, idempotency_key,
               (sent_at is not null) as sent, connected_account_id::text as connected_account_id
        from payments.tutor_transfers
        where payment_id = ${fixture.paymentId}::uuid
        order by created_at, id`) as unknown as TransferRow[];
    } finally {
      await sql.end();
    }
  };

  const candidateFor = async (fixture: PaymentFixture) =>
    (await settlementCandidates({ limit: 1000 })).find(
      (candidate) => candidate.paymentReference === fixture.paymentReference,
    );

  const onlyTransfer = async (fixture: PaymentFixture): Promise<TransferRow> => {
    const rows = await transferRows(fixture);
    expect(rows).toHaveLength(1);
    return rows[0]!;
  };

  /** Change a row directly, to put a fixture into a state the product would reach later. */
  const update = async (
    fn: (sql: ReturnType<typeof createDatabaseClient>['sql']) => Promise<unknown>,
  ) => {
    const { sql } = createDatabaseClient();
    try {
      await fn(sql);
    } finally {
      await sql.end();
    }
  };

  const sent = (transferId: string, providerTransferId = `tr_fix_${randomUUID().slice(0, 8)}`) =>
    recordTransferSent({ transferId, providerTransferId, correlationId: randomUUID() });

  const failed = (transferId: string, failureCode: string | null = 'insufficient_capabilities') =>
    recordTransferFailed({ transferId, failureCode, correlationId: randomUUID() });

  // -------------------------------------------------------------------------

  describe('settlementCandidates — what is owed, and what is held', () => {
    it('owes a tutor for a lesson that has ended, on a succeeded payment, from Studdy’s own row', async () => {
      const fixture = await endedLesson();
      const candidate = await candidateFor(fixture);

      expect(candidate).toBeDefined();
      expect(candidate!.decision).toEqual({ eligible: true });
      expect(candidate!.amountMinor).toBe(3600n);
      expect(candidate!.currencyCode).toBe('NZD');
      expect(candidate!.providerChargeId).toBe(`ch_${fixture.providerPaymentIntentId}`);
      expect(candidate!.idempotencyKey).toBe(`tutor-transfer:${fixture.paymentId}`);
      expect(candidate!.tutorReference.length).toBeGreaterThan(0);
      expect(candidate!.lessonEndsAt).toBeInstanceOf(Date);
      expect(candidate!.lessonEndsAt!.getTime()).toBeLessThan(Date.now());

      // The destination is the account Studdy recorded for this obligation.
      const { sql } = createDatabaseClient();
      try {
        const [account] = await sql`
          select ca.provider_account_id
          from payments.connected_accounts ca
          join payments.tutor_transfers t on t.connected_account_id = ca.id
          where t.payment_id = ${fixture.paymentId}::uuid`;
        expect(candidate!.providerAccountId).toBe(account!['provider_account_id']);
      } finally {
        await sql.end();
      }
    });

    /** THE CORE OF THE RULE: never pay in advance of the lesson. */
    it('holds a lesson that has not ended yet', async () => {
      const fixture = await fixtures.confirmed();
      const candidate = await candidateFor(fixture);
      expect(candidate!.decision).toEqual({ eligible: false, reason: 'lesson_not_ended' });
    });

    it('holds a cancelled booking', async () => {
      const fixture = await endedLesson();
      await update(
        (sql) => sql`
          update bookings.bookings set status_code = 'cancelled', cancelled_at = now()
          where payment_id = ${fixture.paymentId}::uuid`,
      );
      expect((await candidateFor(fixture))!.decision).toEqual({
        eligible: false,
        reason: 'booking_cancelled',
      });
    });

    /** Money must never go out against a lesson Studdy has decided to give back. */
    it('holds anything flagged for refund', async () => {
      const fixture = await endedLesson();
      await update(
        (sql) => sql`
          update payments.payments set refund_required_at = now()
          where id = ${fixture.paymentId}::uuid`,
      );
      expect((await candidateFor(fixture))!.decision).toEqual({
        eligible: false,
        reason: 'flagged_for_refund',
      });
    });

    it('holds a payment with a refund started', async () => {
      const fixture = await endedLesson();
      await update(
        (sql) => sql`
          insert into payments.refunds
            (payment_id, attempt, reason_code, amount_minor, currency_code, status_code,
             provider, idempotency_key)
          values (${fixture.paymentId}::uuid, 1, 'booking_not_confirmed', 4000, 'NZD',
                  'requested', 'stripe', ${'refund:' + randomUUID()})`,
      );
      expect((await candidateFor(fixture))!.decision).toEqual({
        eligible: false,
        reason: 'refund_started',
      });
    });

    /** Payable NOW, not payable when the parent paid. */
    it('holds a tutor who is no longer payable', async () => {
      const fixture = await endedLesson();
      await update(
        (sql) => sql`
          update payments.connected_accounts set transfers_capability_code = 'restricted'
          where tutor_profile_id = ${fixture.tutorProfileId}::uuid`,
      );
      expect((await candidateFor(fixture))!.decision).toEqual({
        eligible: false,
        reason: 'tutor_not_payable',
      });
    });

    it('holds when the account the obligation points at has been replaced', async () => {
      const fixture = await endedLesson();
      await update(
        (sql) => sql`
          update payments.connected_accounts set archived_at = now()
          where tutor_profile_id = ${fixture.tutorProfileId}::uuid`,
      );
      expect((await candidateFor(fixture))!.decision).toEqual({
        eligible: false,
        reason: 'tutor_not_payable',
      });
    });

    /** A late success never had a booking, so it never had an obligation to settle. */
    it('never lists a payment that was flagged for refund at fulfilment', async () => {
      const fixture = await fixtures.flaggedForRefund();
      expect(await transferRows(fixture)).toHaveLength(0);
      expect(await candidateFor(fixture)).toBeUndefined();
    });

    /** The run re-reads each obligation just before sending; that read must see change. */
    it('re-reads one obligation freshly and sees what changed since the report', async () => {
      const fixture = await endedLesson();
      const before = await candidateFor(fixture);
      expect(before!.decision).toEqual({ eligible: true });

      await update(
        (sql) => sql`
          update bookings.bookings set status_code = 'cancelled', cancelled_at = now()
          where payment_id = ${fixture.paymentId}::uuid`,
      );

      const after = await settlementCandidate(before!.transferId);
      expect(after!.decision).toEqual({ eligible: false, reason: 'booking_cancelled' });
    });

    it('returns null for an obligation that does not exist', async () => {
      expect(await settlementCandidate(randomUUID())).toBeNull();
    });
  });

  // -------------------------------------------------------------------------

  describe('recordTransferSent — recorded once, never moved again', () => {
    it('moves a pending obligation to sent, with the provider id and the time', async () => {
      const fixture = await endedLesson();
      const transfer = await onlyTransfer(fixture);

      expect(await sent(transfer.id, 'tr_fix_one')).toBe('sent');

      expect(await onlyTransfer(fixture)).toMatchObject({
        status_code: 'sent',
        provider_transfer_id: 'tr_fix_one',
        failure_note: null,
        sent: true,
      });
    });

    it('records the move in the status history and a medium-risk audit event', async () => {
      const fixture = await endedLesson();
      const transfer = await onlyTransfer(fixture);
      await sent(transfer.id);

      const { sql } = createDatabaseClient();
      try {
        const transitions = await sql`
          select from_status_code, to_status_code, reason_code from audit.status_transitions
          where entity_type = 'tutor_transfer' and entity_id = ${transfer.id}`;
        expect(transitions).toHaveLength(1);
        expect(transitions[0]).toMatchObject({
          from_status_code: 'pending',
          to_status_code: 'sent',
          reason_code: 'settlement_run',
        });

        const audit = await sql`
          select risk_level, category, new_value from audit.audit_events
          where action = 'tutor_transfer.sent' and entity_id = ${transfer.id}`;
        expect(audit).toHaveLength(1);
        expect(audit[0]!['risk_level']).toBe('medium');
        expect(audit[0]!['category']).toBe('financial');
        // Ids and amounts only.
        expect(audit[0]!['new_value']).toEqual({
          paymentId: fixture.paymentId,
          amountMinor: '3600',
          currencyCode: 'NZD',
        });
      } finally {
        await sql.end();
      }
    });

    it('stops listing a sent obligation, so it can never be sent again', async () => {
      const fixture = await endedLesson();
      const transfer = await onlyTransfer(fixture);
      expect(await candidateFor(fixture)).toBeDefined();

      await sent(transfer.id);
      expect(await candidateFor(fixture)).toBeUndefined();
    });

    it('is idempotent: a repeated answer changes nothing', async () => {
      const fixture = await endedLesson();
      const transfer = await onlyTransfer(fixture);

      expect(await sent(transfer.id, 'tr_fix_first')).toBe('sent');
      expect(await sent(transfer.id, 'tr_fix_second')).toBe('unchanged');

      // The first provider id stands; the second never overwrote it.
      expect((await onlyTransfer(fixture)).provider_transfer_id).toBe('tr_fix_first');
    });

    /** Two runs racing one obligation: one transition, one `sent`. */
    it('holds under simultaneous recordings', async () => {
      const fixture = await endedLesson();
      const transfer = await onlyTransfer(fixture);

      const outcomes = await Promise.all([
        sent(transfer.id, 'tr_fix_race'),
        sent(transfer.id, 'tr_fix_race'),
        sent(transfer.id, 'tr_fix_race'),
      ]);

      expect(outcomes.filter((outcome) => outcome === 'sent')).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome === 'unchanged')).toHaveLength(2);
      expect((await onlyTransfer(fixture)).status_code).toBe('sent');
    });

    it('reports an obligation that does not exist', async () => {
      expect(await sent(randomUUID())).toBe('not_found');
    });
  });

  // -------------------------------------------------------------------------

  describe('recordTransferFailed — a definitive refusal', () => {
    it('takes the obligation out of the queue and records why', async () => {
      const fixture = await endedLesson();
      const transfer = await onlyTransfer(fixture);

      expect(await failed(transfer.id, 'insufficient_capabilities_for_transfer')).toBe('failed');

      expect(await onlyTransfer(fixture)).toMatchObject({
        status_code: 'failed',
        failure_note: 'insufficient_capabilities_for_transfer',
        provider_transfer_id: null,
        sent: false,
      });
      expect(await candidateFor(fixture)).toBeUndefined();
    });

    it('raises a high-risk audit event, because the tutor is owed and unpaid', async () => {
      const fixture = await endedLesson();
      const transfer = await onlyTransfer(fixture);
      await failed(transfer.id, 'balance_insufficient');

      const { sql } = createDatabaseClient();
      try {
        const audit = await sql`
          select risk_level, new_value from audit.audit_events
          where action = 'tutor_transfer.failed' and entity_id = ${transfer.id}`;
        expect(audit).toHaveLength(1);
        expect(audit[0]!['risk_level']).toBe('high');
        expect((audit[0]!['new_value'] as Record<string, unknown>)['failureCode']).toBe(
          'balance_insufficient',
        );
      } finally {
        await sql.end();
      }
    });

    /** A failed obligation is terminal: it cannot be walked to sent by a late answer. */
    it('cannot be moved to sent afterwards', async () => {
      const fixture = await endedLesson();
      const transfer = await onlyTransfer(fixture);
      await failed(transfer.id);

      expect(await sent(transfer.id)).toBe('unchanged');
      expect((await onlyTransfer(fixture)).status_code).toBe('failed');
    });

    it('cannot be recorded as failed once it has been sent', async () => {
      const fixture = await endedLesson();
      const transfer = await onlyTransfer(fixture);
      await sent(transfer.id);

      expect(await failed(transfer.id)).toBe('unchanged');
      expect((await onlyTransfer(fixture)).status_code).toBe('sent');
    });

    it('notes a generic reason when the provider gave none', async () => {
      const fixture = await endedLesson();
      const transfer = await onlyTransfer(fixture);
      await failed(transfer.id, null);
      expect((await onlyTransfer(fixture)).failure_note).toBe('The provider refused the transfer.');
    });
  });

  // -------------------------------------------------------------------------

  describe('requeueFailedTransfer — a retry is a NEW obligation', () => {
    const requeue = (fixture: PaymentFixture) =>
      requeueFailedTransfer({
        paymentReference: fixture.paymentReference,
        correlationId: randomUUID(),
      });

    it('creates a fresh pending obligation with its own key, leaving the failed one as history', async () => {
      const fixture = await endedLesson();
      const original = await onlyTransfer(fixture);
      await failed(original.id, 'x');

      const result = await requeue(fixture);
      expect(result.status).toBe('requeued');
      if (result.status !== 'requeued') return;
      expect(result.idempotencyKey).toBe(`tutor-transfer:${fixture.paymentId}:attempt-2`);

      const rows = await transferRows(fixture);
      expect(rows.map((row) => row.status_code)).toEqual(['failed', 'pending']);
      expect(rows[1]).toMatchObject({
        amount_minor: '3600',
        currency_code: 'NZD',
        idempotency_key: `tutor-transfer:${fixture.paymentId}:attempt-2`,
        provider_transfer_id: null,
      });
      expect(rows[1]!.id).not.toBe(original.id);
      // The same account, since it has not been replaced.
      expect(rows[1]!.connected_account_id).toBe(original.connected_account_id);
    });

    it('puts the obligation back in the queue', async () => {
      const fixture = await endedLesson();
      await failed((await onlyTransfer(fixture)).id);
      expect(await candidateFor(fixture)).toBeUndefined();

      await requeue(fixture);
      const candidate = await candidateFor(fixture);
      expect(candidate!.decision).toEqual({ eligible: true });
      expect(candidate!.idempotencyKey).toBe(`tutor-transfer:${fixture.paymentId}:attempt-2`);
    });

    it('raises a high-risk audit event naming what it replaces', async () => {
      const fixture = await endedLesson();
      const original = await onlyTransfer(fixture);
      await failed(original.id);
      const result = await requeue(fixture);
      if (result.status !== 'requeued') throw new Error('expected a requeue');

      const { sql } = createDatabaseClient();
      try {
        const audit = await sql`
          select risk_level, new_value from audit.audit_events
          where action = 'tutor_transfer.requeued' and entity_id = ${result.transferId}`;
        expect(audit).toHaveLength(1);
        expect(audit[0]!['risk_level']).toBe('high');
        expect((audit[0]!['new_value'] as Record<string, unknown>)['replaces']).toBe(original.id);
      } finally {
        await sql.end();
      }
    });

    it('refuses while an obligation is still pending', async () => {
      const fixture = await endedLesson();
      expect(await requeue(fixture)).toEqual({ status: 'refused', refusal: 'nothing_to_requeue' });
      expect(await transferRows(fixture)).toHaveLength(1);
    });

    it('refuses once an obligation has been sent', async () => {
      const fixture = await endedLesson();
      await sent((await onlyTransfer(fixture)).id);
      expect(await requeue(fixture)).toEqual({ status: 'refused', refusal: 'nothing_to_requeue' });
    });

    it('refuses a payment that does not exist', async () => {
      expect(
        await requeueFailedTransfer({
          paymentReference: 'PAY-00000000',
          correlationId: randomUUID(),
        }),
      ).toEqual({ status: 'refused', refusal: 'payment_not_found' });
    });

    it('refuses when the tutor has no live payout account to send to', async () => {
      const fixture = await endedLesson();
      await failed((await onlyTransfer(fixture)).id);
      await update(
        (sql) => sql`
          update payments.connected_accounts set archived_at = now()
          where tutor_profile_id = ${fixture.tutorProfileId}::uuid`,
      );
      expect(await requeue(fixture)).toEqual({ status: 'refused', refusal: 'no_payout_account' });
    });

    /** Two operators at once: the payment is locked, so there is still only one retry. */
    it('creates exactly one retry under simultaneous requests', async () => {
      const fixture = await endedLesson();
      await failed((await onlyTransfer(fixture)).id);

      const results = await Promise.all([requeue(fixture), requeue(fixture), requeue(fixture)]);

      expect(results.filter((result) => result.status === 'requeued')).toHaveLength(1);
      const rows = await transferRows(fixture);
      expect(rows.filter((row) => row.status_code === 'pending')).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------

  describe('the database refuses a second live obligation for one payment', () => {
    it('refuses a duplicate pending obligation', async () => {
      const fixture = await endedLesson();
      const original = await onlyTransfer(fixture);
      const { sql } = createDatabaseClient();
      try {
        await expect(
          sql`
            insert into payments.tutor_transfers
              (payment_id, tutor_profile_id, connected_account_id, amount_minor, currency_code,
               status_code, idempotency_key)
            values (${fixture.paymentId}::uuid, ${fixture.tutorProfileId}::uuid,
                    ${original.connected_account_id}::uuid, 3600, 'NZD', 'pending',
                    ${'tutor-transfer:' + randomUUID()})`,
        ).rejects.toThrow(/tutor_transfer_live_per_payment_unique_idx|duplicate key/);
      } finally {
        await sql.end();
      }
    });
  });
});
