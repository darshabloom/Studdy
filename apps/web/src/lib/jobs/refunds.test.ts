import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RefundToExecute, UnsettledRefund } from '@studdy/database';
import type { StripeRefundSnapshot } from '@studdy/integrations/payments/stripe';

/**
 * The refund job's own behaviour, with the database and Stripe stubbed.
 *
 * WHAT IS PROVED HERE IS THE ORDER AND THE RESTRAINT: that Stripe is called with
 * the amount and key the DATABASE chose and nothing a caller supplied, that an
 * unreachable Stripe leaves the intent for the sweep instead of failing it, that
 * only a definitive refusal is recorded as failed, that a resumed refund adopts
 * what Stripe already holds before creating anything, and that the sweep can
 * never START a refund.
 *
 * The durable guarantees underneath — who may be refunded, the one-live-refund
 * rule, idempotent recording — are proved against a real database in
 * `refunds.integration.test.ts`. Stubbing those here would only test the stub.
 */

const beginRefund = vi.fn();
const recordRefundOutcome = vi.fn();
const refundReport = vi.fn();
const unsettledRefunds = vi.fn();

const createRefund = vi.fn();
const findRefundByStuddyId = vi.fn();
const retrieveRefund = vi.fn();
const stripeClient = vi.fn(() => ({ fake: 'stripe' }));

vi.mock('@studdy/database', () => ({
  beginRefund: (...args: unknown[]) => beginRefund(...args),
  recordRefundOutcome: (...args: unknown[]) => recordRefundOutcome(...args),
  refundReport: (...args: unknown[]) => refundReport(...args),
  unsettledRefunds: (...args: unknown[]) => unsettledRefunds(...args),
}));

vi.mock('@studdy/integrations/payments/stripe', async () => {
  // The real classifier: how an error is judged is part of what is being tested.
  const actual = await vi.importActual<Record<string, unknown>>(
    '@studdy/integrations/payments/stripe',
  );
  return {
    ...actual,
    createRefund: (...args: unknown[]) => createRefund(...args),
    findRefundByStuddyId: (...args: unknown[]) => findRefundByStuddyId(...args),
    retrieveRefund: (...args: unknown[]) => retrieveRefund(...args),
    stripeClient: (...args: unknown[]) => stripeClient(...(args as [])),
  };
});

const { executeRefund, reportRefunds, settleOpenRefunds } = await import('./refunds');

const REFUND: RefundToExecute = {
  refundId: 'refund-1',
  reference: 'RF-10000001',
  paymentId: 'payment-1',
  paymentReference: 'PAY-10000001',
  providerPaymentIntentId: 'pi_1',
  amountMinor: 4000n,
  currencyCode: 'NZD',
  idempotencyKey: 'refund:payment-1:1',
  attempt: 1,
};

function snapshot(overrides: Partial<StripeRefundSnapshot> = {}): StripeRefundSnapshot {
  return {
    providerRefundId: 're_1',
    providerStatus: 'succeeded',
    amountMinor: 4000n,
    currencyCode: 'NZD',
    failureReason: null,
    providerPaymentIntentId: 'pi_1',
    ...overrides,
  };
}

function unsettled(overrides: Partial<UnsettledRefund> = {}): UnsettledRefund {
  return {
    refundId: 'refund-1',
    statusCode: 'requested',
    providerRefundId: null,
    paymentId: 'payment-1',
    providerPaymentIntentId: 'pi_1',
    amountMinor: 4000n,
    idempotencyKey: 'refund:payment-1:1',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  stripeClient.mockReturnValue({ fake: 'stripe' });
});

describe('executeRefund', () => {
  it('does not touch Stripe when Studdy refuses to start one', async () => {
    beginRefund.mockResolvedValue({
      status: 'refused',
      refusal: 'booking_confirmed',
      paymentReference: 'PAY-10000001',
    });

    expect(await executeRefund('PAY-10000001')).toEqual({
      result: 'refused',
      refusal: 'booking_confirmed',
    });
    expect(stripeClient).not.toHaveBeenCalled();
    expect(createRefund).not.toHaveBeenCalled();
    expect(recordRefundOutcome).not.toHaveBeenCalled();
  });

  it('always asks for the one approved reason', async () => {
    beginRefund.mockResolvedValue({
      status: 'refused',
      refusal: 'payment_not_found',
      paymentReference: null,
    });
    await executeRefund('PAY-10000001');
    expect(beginRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentReference: 'PAY-10000001',
        reasonCode: 'booking_not_confirmed',
      }),
    );
  });

  /** THE AMOUNT AND THE KEY COME FROM THE DATABASE'S ROW, never from a caller. */
  it('calls Stripe with the amount and idempotency key the database chose', async () => {
    beginRefund.mockResolvedValue({ status: 'started', refund: REFUND });
    createRefund.mockResolvedValue(snapshot());
    recordRefundOutcome.mockResolvedValue('succeeded');

    await executeRefund('PAY-10000001');

    expect(createRefund).toHaveBeenCalledWith(
      { fake: 'stripe' },
      {
        providerPaymentIntentId: 'pi_1',
        amountMinor: 4000n,
        idempotencyKey: 'refund:payment-1:1',
        studdyRefundId: 'refund-1',
        studdyPaymentId: 'payment-1',
      },
    );
  });

  it('commits the intent BEFORE calling Stripe, and records the answer after', async () => {
    const order: string[] = [];
    beginRefund.mockImplementation(async () => {
      order.push('begin');
      return { status: 'started', refund: REFUND };
    });
    createRefund.mockImplementation(async () => {
      order.push('stripe');
      return snapshot();
    });
    recordRefundOutcome.mockImplementation(async () => {
      order.push('record');
      return 'succeeded';
    });

    await executeRefund('PAY-10000001');
    expect(order).toEqual(['begin', 'stripe', 'record']);
  });

  it('records what Stripe said and reports a settled refund', async () => {
    beginRefund.mockResolvedValue({ status: 'started', refund: REFUND });
    createRefund.mockResolvedValue(snapshot({ providerStatus: 'succeeded' }));
    recordRefundOutcome.mockResolvedValue('succeeded');

    const result = await executeRefund('PAY-10000001');

    expect(recordRefundOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        refundId: 'refund-1',
        providerStatus: 'succeeded',
        providerRefundId: 're_1',
      }),
    );
    expect(result).toEqual({
      result: 'refunded',
      refundReference: 'RF-10000001',
      amountMinor: '4000',
      currencyCode: 'NZD',
      settled: true,
    });
  });

  it('reports an accepted but unsettled refund as not yet settled', async () => {
    beginRefund.mockResolvedValue({ status: 'started', refund: REFUND });
    createRefund.mockResolvedValue(snapshot({ providerStatus: 'pending' }));
    recordRefundOutcome.mockResolvedValue('pending');

    expect(await executeRefund('PAY-10000001')).toMatchObject({
      result: 'refunded',
      settled: false,
    });
  });

  /** An unanswered request is not a refusal. */
  it('defers, and records nothing, when Stripe cannot be reached', async () => {
    beginRefund.mockResolvedValue({ status: 'started', refund: REFUND });
    createRefund.mockRejectedValue(
      Object.assign(new Error('network'), { type: 'StripeConnectionError' }),
    );

    expect(await executeRefund('PAY-10000001')).toEqual({
      result: 'deferred',
      refundReference: 'RF-10000001',
    });
    expect(recordRefundOutcome).not.toHaveBeenCalled();
  });

  it('defers on a bad key too: a misconfiguration is not Stripe refusing the refund', async () => {
    beginRefund.mockResolvedValue({ status: 'started', refund: REFUND });
    createRefund.mockRejectedValue(
      Object.assign(new Error('bad key'), { type: 'StripeAuthenticationError' }),
    );
    expect(await executeRefund('PAY-10000001')).toMatchObject({ result: 'deferred' });
    expect(recordRefundOutcome).not.toHaveBeenCalled();
  });

  it('records a definitive Stripe refusal as failed, with its reason', async () => {
    beginRefund.mockResolvedValue({ status: 'started', refund: REFUND });
    createRefund.mockRejectedValue(
      Object.assign(new Error('already'), {
        type: 'StripeInvalidRequestError',
        code: 'charge_already_refunded',
      }),
    );
    recordRefundOutcome.mockResolvedValue('failed');

    expect(await executeRefund('PAY-10000001')).toEqual({
      result: 'failed',
      refundReference: 'RF-10000001',
      failureCode: 'charge_already_refunded',
    });
    expect(recordRefundOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        providerStatus: 'failed',
        providerRefundId: null,
        failureCode: 'charge_already_refunded',
      }),
    );
  });

  it('reports a refund Stripe accepted and then marked failed as failed', async () => {
    beginRefund.mockResolvedValue({ status: 'started', refund: REFUND });
    createRefund.mockResolvedValue(
      snapshot({ providerStatus: 'failed', failureReason: 'expired_or_canceled_card' }),
    );
    recordRefundOutcome.mockResolvedValue('failed');

    expect(await executeRefund('PAY-10000001')).toEqual({
      result: 'failed',
      refundReference: 'RF-10000001',
      failureCode: 'expired_or_canceled_card',
    });
  });

  it('never looks for an existing refund on a fresh attempt', async () => {
    beginRefund.mockResolvedValue({ status: 'started', refund: REFUND });
    createRefund.mockResolvedValue(snapshot());
    recordRefundOutcome.mockResolvedValue('succeeded');
    await executeRefund('PAY-10000001');
    expect(findRefundByStuddyId).not.toHaveBeenCalled();
  });
});

describe('settleOpenRefunds', () => {
  it('does nothing, and builds no Stripe client, when nothing is open', async () => {
    unsettledRefunds.mockResolvedValue([]);
    expect(await settleOpenRefunds()).toEqual({
      examined: 0,
      settled: 0,
      stillPending: 0,
      unreadable: 0,
    });
    expect(stripeClient).not.toHaveBeenCalled();
  });

  /** THE SWEEP FINISHES A DECISION A PERSON TOOK; IT NEVER MAKES ONE. */
  it('never starts a refund', async () => {
    unsettledRefunds.mockResolvedValue([unsettled()]);
    findRefundByStuddyId.mockResolvedValue(snapshot());
    recordRefundOutcome.mockResolvedValue('succeeded');
    await settleOpenRefunds();
    expect(beginRefund).not.toHaveBeenCalled();
  });

  /**
   * THE DOUBLE-REFUND GUARD. A `requested` row may have reached Stripe after
   * all; Stripe's idempotency key only protects against that for a day, so the
   * sweep adopts the refund Stripe already holds BEFORE it would create one.
   */
  it('adopts a refund Stripe already holds instead of creating a second', async () => {
    unsettledRefunds.mockResolvedValue([unsettled()]);
    findRefundByStuddyId.mockResolvedValue(snapshot({ providerStatus: 'succeeded' }));
    recordRefundOutcome.mockResolvedValue('succeeded');

    const outcome = await settleOpenRefunds();

    expect(findRefundByStuddyId).toHaveBeenCalledWith({ fake: 'stripe' }, 'pi_1', 'refund-1');
    expect(createRefund).not.toHaveBeenCalled();
    expect(recordRefundOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ refundId: 'refund-1', providerRefundId: 're_1' }),
    );
    expect(outcome).toMatchObject({ examined: 1, settled: 1 });
  });

  it('creates the refund under the SAME key when Stripe holds none', async () => {
    unsettledRefunds.mockResolvedValue([unsettled()]);
    findRefundByStuddyId.mockResolvedValue(null);
    createRefund.mockResolvedValue(snapshot({ providerStatus: 'pending' }));
    recordRefundOutcome.mockResolvedValue('pending');

    const outcome = await settleOpenRefunds();

    expect(createRefund).toHaveBeenCalledWith(
      { fake: 'stripe' },
      expect.objectContaining({ idempotencyKey: 'refund:payment-1:1', amountMinor: 4000n }),
    );
    expect(outcome).toMatchObject({ examined: 1, settled: 0, stillPending: 1 });
  });

  it('reads a pending refund back from Stripe until it settles', async () => {
    unsettledRefunds.mockResolvedValue([
      unsettled({ statusCode: 'pending', providerRefundId: 're_1' }),
    ]);
    retrieveRefund.mockResolvedValue(snapshot({ providerStatus: 'succeeded' }));
    recordRefundOutcome.mockResolvedValue('succeeded');

    const outcome = await settleOpenRefunds();

    expect(retrieveRefund).toHaveBeenCalledWith({ fake: 'stripe' }, 're_1');
    expect(findRefundByStuddyId).not.toHaveBeenCalled();
    expect(createRefund).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ settled: 1, stillPending: 0 });
  });

  it('counts a refund that is still pending without treating it as a problem', async () => {
    unsettledRefunds.mockResolvedValue([
      unsettled({ statusCode: 'pending', providerRefundId: 're_1' }),
    ]);
    retrieveRefund.mockResolvedValue(snapshot({ providerStatus: 'pending' }));
    recordRefundOutcome.mockResolvedValue('unchanged');

    expect(await settleOpenRefunds()).toMatchObject({ settled: 0, stillPending: 1, unreadable: 0 });
  });

  it('counts an unreachable Stripe as unreadable and keeps going', async () => {
    unsettledRefunds.mockResolvedValue([
      unsettled({ refundId: 'refund-a' }),
      unsettled({ refundId: 'refund-b' }),
    ]);
    findRefundByStuddyId
      .mockRejectedValueOnce(Object.assign(new Error('network'), { type: 'StripeConnectionError' }))
      .mockResolvedValueOnce(snapshot());
    recordRefundOutcome.mockResolvedValue('succeeded');

    const outcome = await settleOpenRefunds();

    expect(outcome).toMatchObject({ examined: 2, settled: 1, unreadable: 1 });
    expect(recordRefundOutcome).toHaveBeenCalledTimes(1);
  });

  it('records a definitive refusal found during a resume as failed', async () => {
    unsettledRefunds.mockResolvedValue([unsettled()]);
    findRefundByStuddyId.mockResolvedValue(null);
    createRefund.mockRejectedValue(
      Object.assign(new Error('no'), {
        type: 'StripeInvalidRequestError',
        code: 'amount_too_large',
      }),
    );
    recordRefundOutcome.mockResolvedValue('failed');

    const outcome = await settleOpenRefunds();

    expect(recordRefundOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ providerStatus: 'failed', failureCode: 'amount_too_large' }),
    );
    expect(outcome).toMatchObject({ settled: 1, unreadable: 0 });
  });
});

describe('reportRefunds', () => {
  it('returns the repository report untouched', async () => {
    const report = { awaitingRefund: [], byStatus: { succeeded: 2 } };
    refundReport.mockResolvedValue(report);
    expect(await reportRefunds()).toBe(report);
  });
});
