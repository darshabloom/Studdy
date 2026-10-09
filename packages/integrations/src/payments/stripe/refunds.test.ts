import { describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import { classifyRefundError, createRefund, findRefundByStuddyId, retrieveRefund } from './refunds';

/**
 * The refund adapter's guarantees, with no network and no account.
 *
 * The fake stands in for the SDK's `refunds` resource only, and the fixture is
 * the shape Stripe returns: integer minor units, a lower-case currency, a string
 * `payment_intent`, `failure_reason` only on a failed refund.
 */

function refundFixture(overrides: Partial<Stripe.Refund> = {}): Stripe.Refund {
  return {
    id: 're_test_1',
    object: 'refund',
    amount: 4000,
    currency: 'nzd',
    status: 'succeeded',
    payment_intent: 'pi_test_1',
    failure_reason: null,
    ...overrides,
  } as unknown as Stripe.Refund;
}

function stripeWith(refunds: {
  create?: ReturnType<typeof vi.fn>;
  retrieve?: ReturnType<typeof vi.fn>;
  list?: ReturnType<typeof vi.fn>;
}): Stripe {
  return { refunds } as unknown as Stripe;
}

const input = {
  providerPaymentIntentId: 'pi_test_1',
  amountMinor: 4000n,
  idempotencyKey: 'refund:pay-1:1',
  studdyRefundId: 'refund-1',
  studdyPaymentId: 'pay-1',
};

describe('createRefund', () => {
  it('asks Stripe for exactly the amount stated, with the idempotency key', async () => {
    const create = vi.fn().mockResolvedValue(refundFixture());
    await createRefund(stripeWith({ create }), input);

    expect(create).toHaveBeenCalledTimes(1);
    const [params, options] = create.mock.calls[0] as [Record<string, unknown>, unknown];
    expect(params['payment_intent']).toBe('pi_test_1');
    expect(params['amount']).toBe(4000);
    expect(options).toEqual({ idempotencyKey: 'refund:pay-1:1' });
  });

  it('never sets a reason, reverse_transfer or refund_application_fee', async () => {
    const create = vi.fn().mockResolvedValue(refundFixture());
    await createRefund(stripeWith({ create }), input);
    const params = (create.mock.calls[0] as [Record<string, unknown>])[0];
    expect(params).not.toHaveProperty('reason');
    expect(params).not.toHaveProperty('reverse_transfer');
    expect(params).not.toHaveProperty('refund_application_fee');
  });

  it('carries only Studdy ids as metadata', async () => {
    const create = vi.fn().mockResolvedValue(refundFixture());
    await createRefund(stripeWith({ create }), input);
    const params = (create.mock.calls[0] as [{ metadata: Record<string, string> }])[0];
    expect(params.metadata).toEqual({
      studdy_refund_id: 'refund-1',
      studdy_payment_id: 'pay-1',
    });
  });

  it('returns a Studdy-shaped snapshot with an upper-case currency and bigint amount', async () => {
    const create = vi.fn().mockResolvedValue(refundFixture());
    expect(await createRefund(stripeWith({ create }), input)).toEqual({
      providerRefundId: 're_test_1',
      providerStatus: 'succeeded',
      amountMinor: 4000n,
      currencyCode: 'NZD',
      failureReason: null,
      providerPaymentIntentId: 'pi_test_1',
    });
  });

  it('passes a failed refund through with its reason, untouched', async () => {
    const create = vi
      .fn()
      .mockResolvedValue(
        refundFixture({ status: 'failed', failure_reason: 'expired_or_canceled_card' }),
      );
    const snapshot = await createRefund(stripeWith({ create }), input);
    expect(snapshot.providerStatus).toBe('failed');
    expect(snapshot.failureReason).toBe('expired_or_canceled_card');
  });

  it.each([0n, -1n, BigInt(Number.MAX_SAFE_INTEGER) + 1n])(
    'refuses an amount that is not a positive safe integer (%s) before calling Stripe',
    async (amountMinor) => {
      const create = vi.fn();
      await expect(createRefund(stripeWith({ create }), { ...input, amountMinor })).rejects.toThrow(
        RangeError,
      );
      expect(create).not.toHaveBeenCalled();
    },
  );

  it('lets a Stripe error propagate rather than inventing a status', async () => {
    const create = vi.fn().mockRejectedValue(new Error('network'));
    await expect(createRefund(stripeWith({ create }), input)).rejects.toThrow('network');
  });
});

describe('retrieveRefund', () => {
  it('reads the refund back by id', async () => {
    const retrieve = vi.fn().mockResolvedValue(refundFixture({ status: 'pending' }));
    const snapshot = await retrieveRefund(stripeWith({ retrieve }), 're_test_1');
    expect(retrieve).toHaveBeenCalledWith('re_test_1');
    expect(snapshot.providerStatus).toBe('pending');
  });

  it('reads an expanded payment intent object as its id', async () => {
    const retrieve = vi
      .fn()
      .mockResolvedValue(
        refundFixture({ payment_intent: { id: 'pi_expanded' } as Stripe.PaymentIntent }),
      );
    expect(
      (await retrieveRefund(stripeWith({ retrieve }), 're_test_1')).providerPaymentIntentId,
    ).toBe('pi_expanded');
  });
});

describe('findRefundByStuddyId', () => {
  const listed = (id: string, studdyRefundId: string | null): Stripe.Refund =>
    refundFixture({
      id,
      metadata: studdyRefundId === null ? {} : { studdy_refund_id: studdyRefundId },
    });

  it('adopts the refund whose metadata names this Studdy refund', async () => {
    const list = vi.fn().mockResolvedValue({
      data: [listed('re_other', 'refund-other'), listed('re_mine', 'refund-1')],
    });
    const found = await findRefundByStuddyId(stripeWith({ list }), 'pi_test_1', 'refund-1');
    expect(list).toHaveBeenCalledWith({ payment_intent: 'pi_test_1', limit: 20 });
    expect(found?.providerRefundId).toBe('re_mine');
  });

  it('returns null when Stripe holds no refund for this Studdy refund', async () => {
    const list = vi
      .fn()
      .mockResolvedValue({ data: [listed('re_other', 'refund-other'), listed('re_x', null)] });
    expect(await findRefundByStuddyId(stripeWith({ list }), 'pi_test_1', 'refund-1')).toBeNull();
  });

  it('returns null for a payment with no refunds at all', async () => {
    const list = vi.fn().mockResolvedValue({ data: [] });
    expect(await findRefundByStuddyId(stripeWith({ list }), 'pi_test_1', 'refund-1')).toBeNull();
  });
});

describe('classifyRefundError', () => {
  it('treats "Stripe understood and said no" as definitive', () => {
    expect(
      classifyRefundError({ type: 'StripeInvalidRequestError', code: 'charge_already_refunded' }),
    ).toEqual({
      definitive: true,
      code: 'charge_already_refunded',
    });
    expect(classifyRefundError({ type: 'StripeCardError', code: 'card_declined' }).definitive).toBe(
      true,
    );
  });

  /** A failure to GET an answer must never be recorded as Stripe refusing. */
  it.each([
    'StripeConnectionError',
    'StripeAPIError',
    'StripeRateLimitError',
    'StripeAuthenticationError',
    'StripePermissionError',
    'StripeIdempotencyError',
  ])('does not treat %s as definitive', (type) => {
    expect(classifyRefundError({ type, code: 'x' }).definitive).toBe(false);
  });

  it('defaults to not definitive for anything it does not recognise', () => {
    expect(classifyRefundError(new Error('boom'))).toEqual({ definitive: false, code: null });
    expect(classifyRefundError(null)).toEqual({ definitive: false, code: null });
    expect(classifyRefundError('nope')).toEqual({ definitive: false, code: null });
    expect(classifyRefundError({ type: 'StripeInvalidRequestError' }).code).toBeNull();
  });
});
