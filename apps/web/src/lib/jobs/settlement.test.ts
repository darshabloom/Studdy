import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SettlementCandidate } from '@studdy/database';
import type { StripeTransferSnapshot } from '@studdy/integrations/payments/stripe';

/**
 * The settlement job's own behaviour, with the database and Stripe stubbed.
 *
 * WHAT IS PROVED HERE IS RESTRAINT AND ORDER: that nothing is sent unless the
 * total matches what the operator reviewed, that every item is re-judged against
 * fresh facts immediately before it is sent, that a transfer Stripe already made
 * is adopted instead of repeated, that one that does not match what is owed is
 * never recorded as settling it, and that only a definitive refusal marks an
 * obligation failed.
 *
 * The durable guarantees underneath — which obligations are eligible, idempotent
 * recording, the requeue rules — are proved against a real database in
 * `settlement.integration.test.ts`. Stubbing those here would only test the stub.
 */

const settlementCandidates = vi.fn();
const settlementCandidate = vi.fn();
const recordTransferSent = vi.fn();
const recordTransferFailed = vi.fn();
const requeueFailedTransfer = vi.fn();

const createTransfer = vi.fn();
const findTransferByStuddyId = vi.fn();
const stripeClient = vi.fn(() => ({ fake: 'stripe' }));

vi.mock('@studdy/database', () => ({
  settlementCandidates: (...args: unknown[]) => settlementCandidates(...args),
  settlementCandidate: (...args: unknown[]) => settlementCandidate(...args),
  recordTransferSent: (...args: unknown[]) => recordTransferSent(...args),
  recordTransferFailed: (...args: unknown[]) => recordTransferFailed(...args),
  requeueFailedTransfer: (...args: unknown[]) => requeueFailedTransfer(...args),
}));

vi.mock('@studdy/integrations/payments/stripe', async () => {
  // The real classifier: how an error is judged is part of what is being tested.
  const actual = await vi.importActual<Record<string, unknown>>(
    '@studdy/integrations/payments/stripe',
  );
  return {
    ...actual,
    createTransfer: (...args: unknown[]) => createTransfer(...args),
    findTransferByStuddyId: (...args: unknown[]) => findTransferByStuddyId(...args),
    stripeClient: (...args: unknown[]) => stripeClient(...(args as [])),
  };
});

const { reportSettlement, requeueSettlement, runSettlement } = await import('./settlement');

function candidate(overrides: Partial<SettlementCandidate> = {}): SettlementCandidate {
  return {
    transferId: 'transfer-1',
    idempotencyKey: 'tutor-transfer:payment-1',
    amountMinor: 3600n,
    currencyCode: 'NZD',
    paymentId: 'payment-1',
    paymentReference: 'PAY-10000001',
    tutorReference: 'TUT-0001',
    providerAccountId: 'acct_1',
    providerChargeId: 'ch_1',
    lessonEndsAt: new Date('2026-10-19T00:00:00.000Z'),
    decision: { eligible: true },
    ...overrides,
  };
}

function held(reason: 'lesson_not_ended' | 'refund_started', overrides = {}): SettlementCandidate {
  return candidate({ decision: { eligible: false, reason }, ...overrides });
}

function transfer(overrides: Partial<StripeTransferSnapshot> = {}): StripeTransferSnapshot {
  return {
    providerTransferId: 'tr_1',
    amountMinor: 3600n,
    currencyCode: 'NZD',
    reversed: false,
    destinationAccountId: 'acct_1',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  stripeClient.mockReturnValue({ fake: 'stripe' });
});

describe('reportSettlement', () => {
  it('separates what is owed from what is held, with the reason for each hold', async () => {
    settlementCandidates.mockResolvedValue([
      candidate(),
      candidate({ transferId: 'transfer-2', paymentReference: 'PAY-10000002', amountMinor: 1800n }),
      held('lesson_not_ended', { transferId: 'transfer-3', paymentReference: 'PAY-10000003' }),
      held('refund_started', { transferId: 'transfer-4', paymentReference: 'PAY-10000004' }),
      held('lesson_not_ended', { transferId: 'transfer-5', paymentReference: 'PAY-10000005' }),
    ]);

    const report = await reportSettlement(new Date('2026-10-20T00:00:00.000Z'));

    expect(report.eligible.map((line) => line.paymentReference)).toEqual([
      'PAY-10000001',
      'PAY-10000002',
    ]);
    expect(report.eligibleTotals).toEqual({ NZD: '5400' });
    expect(report.heldByReason).toEqual({ lesson_not_ended: 2, refund_started: 1 });
    expect(report.held.map((line) => line.reason)).toEqual([
      'lesson_not_ended',
      'refund_started',
      'lesson_not_ended',
    ]);
  });

  it('sums each currency separately', async () => {
    settlementCandidates.mockResolvedValue([
      candidate(),
      candidate({ transferId: 'transfer-2', currencyCode: 'AUD', amountMinor: 1000n }),
    ]);
    expect((await reportSettlement()).eligibleTotals).toEqual({ NZD: '3600', AUD: '1000' });
  });

  /** An operator's report names Studdy references and money, and nothing else. */
  it('carries no provider identifier, person or address', async () => {
    settlementCandidates.mockResolvedValue([candidate()]);
    const text = JSON.stringify(await reportSettlement());
    expect(text).not.toMatch(/acct_|ch_|tr_|pi_/);
    expect(text).not.toContain('@');
    expect(text).toContain('PAY-10000001');
    expect(text).toContain('TUT-0001');
  });

  it('sends and writes nothing', async () => {
    settlementCandidates.mockResolvedValue([candidate()]);
    await reportSettlement();
    expect(stripeClient).not.toHaveBeenCalled();
    expect(createTransfer).not.toHaveBeenCalled();
    expect(recordTransferSent).not.toHaveBeenCalled();
  });
});

describe('runSettlement — the total you reviewed is the total that is sent', () => {
  it('sends NOTHING when the eligible total is not the one reviewed', async () => {
    settlementCandidates.mockResolvedValue([candidate()]);

    expect(await runSettlement(7200n)).toEqual({
      result: 'total_changed',
      expectedTotalMinor: '7200',
      eligibleTotalMinor: '3600',
    });
    expect(stripeClient).not.toHaveBeenCalled();
    expect(createTransfer).not.toHaveBeenCalled();
    expect(recordTransferSent).not.toHaveBeenCalled();
  });

  it('counts only ELIGIBLE obligations toward the total, not the ones held', async () => {
    settlementCandidates.mockResolvedValue([candidate(), held('lesson_not_ended')]);
    settlementCandidate.mockResolvedValue(candidate());
    findTransferByStuddyId.mockResolvedValue(null);
    createTransfer.mockResolvedValue(transfer());
    recordTransferSent.mockResolvedValue('sent');

    expect(await runSettlement(3600n)).toMatchObject({ result: 'done', sent: 1 });
  });

  it('refuses to mix currencies, and sends nothing', async () => {
    settlementCandidates.mockResolvedValue([
      candidate(),
      candidate({ transferId: 'transfer-2', currencyCode: 'AUD' }),
    ]);
    const result = await runSettlement(7200n);
    expect(result).toMatchObject({ result: 'mixed_currency' });
    expect(createTransfer).not.toHaveBeenCalled();
  });

  it('does nothing, and builds no Stripe client, when nothing is owed and nothing was expected', async () => {
    settlementCandidates.mockResolvedValue([held('lesson_not_ended')]);
    expect(await runSettlement(0n)).toEqual({
      result: 'done',
      attempted: 0,
      sent: 0,
      failed: 0,
      deferred: 0,
      skipped: 0,
      totalSentMinor: '0',
      currencyCode: null,
    });
    expect(stripeClient).not.toHaveBeenCalled();
  });
});

describe('runSettlement — sending', () => {
  beforeEach(() => {
    settlementCandidates.mockResolvedValue([candidate()]);
    settlementCandidate.mockResolvedValue(candidate());
    findTransferByStuddyId.mockResolvedValue(null);
  });

  /** THE DESTINATION, AMOUNT AND CHARGE COME FROM STUDDY'S ROW, never a caller. */
  it('sends the obligation to the account and amount Studdy recorded, from its own charge', async () => {
    createTransfer.mockResolvedValue(transfer());
    recordTransferSent.mockResolvedValue('sent');

    await runSettlement(3600n);

    expect(createTransfer).toHaveBeenCalledWith(
      { fake: 'stripe' },
      {
        destinationAccountId: 'acct_1',
        amountMinor: 3600n,
        currencyCode: 'NZD',
        sourceChargeId: 'ch_1',
        transferGroup: 'payment:payment-1',
        idempotencyKey: 'tutor-transfer:payment-1',
        studdyTransferId: 'transfer-1',
        studdyPaymentId: 'payment-1',
      },
    );
  });

  it('records the transfer as sent, and reports what moved', async () => {
    createTransfer.mockResolvedValue(transfer());
    recordTransferSent.mockResolvedValue('sent');

    const result = await runSettlement(3600n);

    expect(recordTransferSent).toHaveBeenCalledWith(
      expect.objectContaining({ transferId: 'transfer-1', providerTransferId: 'tr_1' }),
    );
    expect(result).toEqual({
      result: 'done',
      attempted: 1,
      sent: 1,
      failed: 0,
      deferred: 0,
      skipped: 0,
      totalSentMinor: '3600',
      currencyCode: 'NZD',
    });
  });

  /**
   * RE-JUDGED IMMEDIATELY BEFORE SENDING. Something that stopped being eligible
   * between the report and this item — a refund flagged, a booking cancelled —
   * is skipped, not paid.
   */
  it('skips an obligation that is no longer eligible when it is re-read', async () => {
    settlementCandidate.mockResolvedValue(held('refund_started'));

    expect(await runSettlement(3600n)).toMatchObject({ sent: 0, skipped: 1 });
    expect(findTransferByStuddyId).not.toHaveBeenCalled();
    expect(createTransfer).not.toHaveBeenCalled();
    expect(recordTransferSent).not.toHaveBeenCalled();
  });

  it('skips an obligation that has vanished when it is re-read', async () => {
    settlementCandidate.mockResolvedValue(null);
    expect(await runSettlement(3600n)).toMatchObject({ sent: 0, skipped: 1 });
    expect(createTransfer).not.toHaveBeenCalled();
  });

  /**
   * THE DOUBLE-PAYMENT GUARD. Stripe honours an idempotency key for a day and
   * settlement runs weekly, so a run that died after Stripe accepted the transfer
   * would, next week, be retried with a key Stripe has forgotten. The transfer
   * Stripe already holds is adopted, not repeated.
   */
  it('adopts a transfer Stripe already made instead of sending a second', async () => {
    findTransferByStuddyId.mockResolvedValue(transfer({ providerTransferId: 'tr_existing' }));
    recordTransferSent.mockResolvedValue('sent');

    const result = await runSettlement(3600n);

    expect(findTransferByStuddyId).toHaveBeenCalledWith(
      { fake: 'stripe' },
      'payment:payment-1',
      'transfer-1',
    );
    expect(createTransfer).not.toHaveBeenCalled();
    expect(recordTransferSent).toHaveBeenCalledWith(
      expect.objectContaining({ providerTransferId: 'tr_existing' }),
    );
    expect(result).toMatchObject({ sent: 1 });
  });

  /** Recording the wrong money as sent is worse than sending nothing. */
  it.each([
    ['a different amount', { amountMinor: 3599n }],
    ['a different currency', { currencyCode: 'AUD' }],
    ['a different destination', { destinationAccountId: 'acct_someone_else' }],
    ['a reversed transfer', { reversed: true }],
  ])(
    'never records an adopted transfer with %s as settling the obligation',
    async (_name, patch) => {
      findTransferByStuddyId.mockResolvedValue(transfer(patch));

      const result = await runSettlement(3600n);

      expect(recordTransferSent).not.toHaveBeenCalled();
      expect(recordTransferFailed).not.toHaveBeenCalled();
      expect(result).toMatchObject({ sent: 0, deferred: 1 });
    },
  );

  it('defers, and records nothing, when Stripe cannot be reached', async () => {
    createTransfer.mockRejectedValue(
      Object.assign(new Error('network'), { type: 'StripeConnectionError' }),
    );

    expect(await runSettlement(3600n)).toMatchObject({ sent: 0, failed: 0, deferred: 1 });
    expect(recordTransferSent).not.toHaveBeenCalled();
    expect(recordTransferFailed).not.toHaveBeenCalled();
  });

  it('defers on a bad key too: a misconfiguration is not Stripe refusing the transfer', async () => {
    createTransfer.mockRejectedValue(
      Object.assign(new Error('bad key'), { type: 'StripeAuthenticationError' }),
    );
    expect(await runSettlement(3600n)).toMatchObject({ failed: 0, deferred: 1 });
    expect(recordTransferFailed).not.toHaveBeenCalled();
  });

  it('records a definitive Stripe refusal as failed, with its reason', async () => {
    createTransfer.mockRejectedValue(
      Object.assign(new Error('no'), {
        type: 'StripeInvalidRequestError',
        code: 'insufficient_capabilities_for_transfer',
      }),
    );
    recordTransferFailed.mockResolvedValue('failed');

    const result = await runSettlement(3600n);

    expect(recordTransferFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        transferId: 'transfer-1',
        failureCode: 'insufficient_capabilities_for_transfer',
      }),
    );
    expect(result).toMatchObject({ sent: 0, failed: 1, deferred: 0, totalSentMinor: '0' });
  });

  it('does not count as sent a transfer someone else already recorded', async () => {
    createTransfer.mockResolvedValue(transfer());
    recordTransferSent.mockResolvedValue('unchanged');

    expect(await runSettlement(3600n)).toMatchObject({ sent: 0, skipped: 1, totalSentMinor: '0' });
  });

  it('carries on past a deferred obligation to the next', async () => {
    settlementCandidates.mockResolvedValue([
      candidate({ transferId: 'transfer-a', paymentId: 'payment-a' }),
      candidate({ transferId: 'transfer-b', paymentId: 'payment-b' }),
    ]);
    settlementCandidate.mockImplementation(async (transferId: string) =>
      candidate({ transferId, paymentId: transferId === 'transfer-a' ? 'payment-a' : 'payment-b' }),
    );
    createTransfer
      .mockRejectedValueOnce(Object.assign(new Error('x'), { type: 'StripeConnectionError' }))
      .mockResolvedValueOnce(transfer({ providerTransferId: 'tr_b' }));
    recordTransferSent.mockResolvedValue('sent');

    const result = await runSettlement(7200n);

    expect(result).toMatchObject({ attempted: 2, sent: 1, deferred: 1, totalSentMinor: '3600' });
  });
});

describe('requeueSettlement', () => {
  it('passes the result through untouched', async () => {
    requeueFailedTransfer.mockResolvedValue({ status: 'refused', refusal: 'nothing_to_requeue' });
    expect(await requeueSettlement('PAY-10000001')).toEqual({
      status: 'refused',
      refusal: 'nothing_to_requeue',
    });
    expect(requeueFailedTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ paymentReference: 'PAY-10000001' }),
    );
  });
});
