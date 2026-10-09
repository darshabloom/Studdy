import { describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import { classifyStripeError } from './errors';
import { createTransfer, findTransferByStuddyId } from './transfers';

/**
 * The transfer adapter's guarantees, with no network and no account.
 *
 * The fake stands in for the SDK's `transfers` resource only, and the fixture is
 * the shape Stripe returns: integer minor units, a lower-case currency, a string
 * `destination`.
 */

function transferFixture(overrides: Partial<Stripe.Transfer> = {}): Stripe.Transfer {
  return {
    id: 'tr_test_1',
    object: 'transfer',
    amount: 3600,
    currency: 'nzd',
    destination: 'acct_test_1',
    reversed: false,
    metadata: {},
    ...overrides,
  } as unknown as Stripe.Transfer;
}

function stripeWith(transfers: {
  create?: ReturnType<typeof vi.fn>;
  list?: ReturnType<typeof vi.fn>;
}): Stripe {
  return { transfers } as unknown as Stripe;
}

const input = {
  destinationAccountId: 'acct_test_1',
  amountMinor: 3600n,
  currencyCode: 'NZD',
  sourceChargeId: 'ch_test_1',
  transferGroup: 'payment:pay-1',
  idempotencyKey: 'tutor-transfer:pay-1',
  studdyTransferId: 'transfer-1',
  studdyPaymentId: 'pay-1',
};

describe('createTransfer', () => {
  it('sends exactly the amount stated, to the destination given, drawn from the charge', async () => {
    const create = vi.fn().mockResolvedValue(transferFixture());
    await createTransfer(stripeWith({ create }), input);

    const [params, options] = create.mock.calls[0] as [Record<string, unknown>, unknown];
    expect(params['amount']).toBe(3600);
    expect(params['destination']).toBe('acct_test_1');
    expect(params['source_transaction']).toBe('ch_test_1');
    expect(params['transfer_group']).toBe('payment:pay-1');
    expect(options).toEqual({ idempotencyKey: 'tutor-transfer:pay-1' });
  });

  /** Stripe wants lower case; Studdy stores upper. Normalised at the boundary. */
  it('sends the currency in lower case', async () => {
    const create = vi.fn().mockResolvedValue(transferFixture());
    await createTransfer(stripeWith({ create }), input);
    expect((create.mock.calls[0] as [Record<string, unknown>])[0]['currency']).toBe('nzd');
  });

  it('carries only Studdy ids as metadata', async () => {
    const create = vi.fn().mockResolvedValue(transferFixture());
    await createTransfer(stripeWith({ create }), input);
    const params = (create.mock.calls[0] as [{ metadata: Record<string, string> }])[0];
    expect(params.metadata).toEqual({
      studdy_transfer_id: 'transfer-1',
      studdy_payment_id: 'pay-1',
    });
  });

  it('returns a Studdy-shaped snapshot with an upper-case currency and bigint amount', async () => {
    const create = vi.fn().mockResolvedValue(transferFixture());
    expect(await createTransfer(stripeWith({ create }), input)).toEqual({
      providerTransferId: 'tr_test_1',
      amountMinor: 3600n,
      currencyCode: 'NZD',
      reversed: false,
      destinationAccountId: 'acct_test_1',
    });
  });

  it('reads an expanded destination object as its id', async () => {
    const create = vi
      .fn()
      .mockResolvedValue(
        transferFixture({ destination: { id: 'acct_expanded' } as Stripe.Account }),
      );
    expect((await createTransfer(stripeWith({ create }), input)).destinationAccountId).toBe(
      'acct_expanded',
    );
  });

  it.each([0n, -1n, BigInt(Number.MAX_SAFE_INTEGER) + 1n])(
    'refuses an amount that is not a positive safe integer (%s) before calling Stripe',
    async (amountMinor) => {
      const create = vi.fn();
      await expect(
        createTransfer(stripeWith({ create }), { ...input, amountMinor }),
      ).rejects.toThrow(RangeError);
      expect(create).not.toHaveBeenCalled();
    },
  );

  it('lets a Stripe error propagate rather than inventing a result', async () => {
    const create = vi.fn().mockRejectedValue(new Error('network'));
    await expect(createTransfer(stripeWith({ create }), input)).rejects.toThrow('network');
  });
});

describe('findTransferByStuddyId', () => {
  const listed = (id: string, studdyTransferId: string | null): Stripe.Transfer =>
    transferFixture({
      id,
      metadata: studdyTransferId === null ? {} : { studdy_transfer_id: studdyTransferId },
    });

  it('adopts the transfer whose metadata names this obligation, searching the payment’s group', async () => {
    const list = vi.fn().mockResolvedValue({
      data: [listed('tr_other', 'transfer-other'), listed('tr_mine', 'transfer-1')],
    });
    const found = await findTransferByStuddyId(stripeWith({ list }), 'payment:pay-1', 'transfer-1');
    expect(list).toHaveBeenCalledWith({ transfer_group: 'payment:pay-1', limit: 20 });
    expect(found?.providerTransferId).toBe('tr_mine');
  });

  it('returns null when Stripe holds no transfer for this obligation', async () => {
    const list = vi
      .fn()
      .mockResolvedValue({ data: [listed('tr_other', 'transfer-other'), listed('tr_x', null)] });
    expect(
      await findTransferByStuddyId(stripeWith({ list }), 'payment:pay-1', 'transfer-1'),
    ).toBeNull();
  });

  it('returns null for a payment with no transfers at all', async () => {
    const list = vi.fn().mockResolvedValue({ data: [] });
    expect(
      await findTransferByStuddyId(stripeWith({ list }), 'payment:pay-1', 'transfer-1'),
    ).toBeNull();
  });
});

describe('classifyStripeError, shared by refunds and transfers', () => {
  it('treats "Stripe understood and said no" as definitive', () => {
    expect(
      classifyStripeError({ type: 'StripeInvalidRequestError', code: 'balance_insufficient' }),
    ).toEqual({ definitive: true, code: 'balance_insufficient' });
  });

  it.each([
    'StripeConnectionError',
    'StripeAPIError',
    'StripeRateLimitError',
    'StripeIdempotencyError',
  ])('does not treat %s as definitive', (type) => {
    expect(classifyStripeError({ type, code: 'x' }).definitive).toBe(false);
  });

  it('defaults to not definitive for anything unrecognised', () => {
    expect(classifyStripeError(new Error('boom'))).toEqual({ definitive: false, code: null });
    expect(classifyStripeError(undefined)).toEqual({ definitive: false, code: null });
  });
});
