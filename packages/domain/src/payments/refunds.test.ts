import { describe, expect, it } from 'vitest';
import {
  canTransitionRefund,
  decideRefund,
  isRefundReason,
  isTerminalRefundStatus,
  providerAcceptedRefund,
  refundIdempotencyKey,
  REFUND_STATUSES,
  studdyRefundStatusFor,
  type RefundableFacts,
} from './refunds';

const refundable: RefundableFacts = {
  paymentStatus: 'succeeded',
  hasProviderPayment: true,
  totalChargedMinor: 4000n,
  refundRequired: true,
  hasBooking: false,
  succeededRefundMinor: 0n,
  unsettledRefundMinor: 0n,
};

describe('decideRefund', () => {
  it('refunds the whole payment when money arrived and no booking was made', () => {
    expect(decideRefund(refundable)).toEqual({ allowed: true, amountMinor: 4000n });
  });

  it('refuses a payment that has not succeeded', () => {
    for (const paymentStatus of ['requires_payment', 'processing', 'failed', 'expired']) {
      expect(decideRefund({ ...refundable, paymentStatus })).toEqual({
        allowed: false,
        refusal: 'payment_not_succeeded',
      });
    }
  });

  it('refuses a payment with no provider payment to refund against', () => {
    expect(decideRefund({ ...refundable, hasProviderPayment: false })).toEqual({
      allowed: false,
      refusal: 'no_provider_payment',
    });
  });

  /** THE SAFETY RULE: a booked lesson is never refunded through this path. */
  it('refuses a payment that has a booking, even if it is flagged', () => {
    expect(decideRefund({ ...refundable, hasBooking: true })).toEqual({
      allowed: false,
      refusal: 'booking_confirmed',
    });
  });

  it('refuses a payment nobody flagged for refund', () => {
    expect(decideRefund({ ...refundable, refundRequired: false })).toEqual({
      allowed: false,
      refusal: 'refund_not_required',
    });
  });

  it('refuses a payment already fully refunded', () => {
    expect(decideRefund({ ...refundable, succeededRefundMinor: 4000n })).toEqual({
      allowed: false,
      refusal: 'already_refunded',
    });
  });

  it('refuses while a refund is still in flight, so one cannot be doubled up', () => {
    expect(decideRefund({ ...refundable, unsettledRefundMinor: 4000n })).toEqual({
      allowed: false,
      refusal: 'refund_in_flight',
    });
  });

  it('offers only what is left if part has already been refunded', () => {
    expect(decideRefund({ ...refundable, succeededRefundMinor: 1500n })).toEqual({
      allowed: true,
      amountMinor: 2500n,
    });
  });

  it('names the first failing check, in the order an operator would ask', () => {
    expect(
      decideRefund({
        ...refundable,
        paymentStatus: 'failed',
        hasBooking: true,
        refundRequired: false,
      }),
    ).toEqual({ allowed: false, refusal: 'payment_not_succeeded' });
  });
});

describe('the refund state machine', () => {
  it('moves requested to pending, succeeded or failed, and pending to succeeded or failed', () => {
    expect(canTransitionRefund('requested', 'pending')).toBe(true);
    expect(canTransitionRefund('requested', 'succeeded')).toBe(true);
    expect(canTransitionRefund('requested', 'failed')).toBe(true);
    expect(canTransitionRefund('pending', 'succeeded')).toBe(true);
    expect(canTransitionRefund('pending', 'failed')).toBe(true);
  });

  it('never moves backwards or re-opens a terminal refund', () => {
    expect(canTransitionRefund('pending', 'requested')).toBe(false);
    for (const terminal of ['succeeded', 'failed'] as const) {
      expect(isTerminalRefundStatus(terminal)).toBe(true);
      for (const to of REFUND_STATUSES) expect(canTransitionRefund(terminal, to)).toBe(false);
    }
  });
});

describe('studdyRefundStatusFor', () => {
  it('maps the provider statuses Studdy acts on', () => {
    expect(studdyRefundStatusFor('succeeded')).toBe('succeeded');
    expect(studdyRefundStatusFor('failed')).toBe('failed');
    expect(studdyRefundStatusFor('canceled')).toBe('failed');
    expect(studdyRefundStatusFor('pending')).toBe('pending');
    expect(studdyRefundStatusFor('requires_action')).toBe('pending');
  });

  /** A status Studdy has never seen must never read as money returned. */
  it('fails safe: an unknown or missing status is pending, never succeeded', () => {
    expect(studdyRefundStatusFor('something_new')).toBe('pending');
    expect(studdyRefundStatusFor(null)).toBe('pending');
    expect(studdyRefundStatusFor(undefined)).toBe('pending');
    expect(studdyRefundStatusFor('')).toBe('pending');
  });
});

describe('refund identity', () => {
  it('derives a stable key per payment and attempt', () => {
    expect(refundIdempotencyKey('pay-1', 1)).toBe('refund:pay-1:1');
    expect(refundIdempotencyKey('pay-1', 1)).toBe(refundIdempotencyKey('pay-1', 1));
    expect(refundIdempotencyKey('pay-1', 2)).not.toBe(refundIdempotencyKey('pay-1', 1));
    expect(refundIdempotencyKey('pay-2', 1)).not.toBe(refundIdempotencyKey('pay-1', 1));
  });

  it('recognises only the approved reason', () => {
    expect(isRefundReason('booking_not_confirmed')).toBe(true);
    expect(isRefundReason('goodwill')).toBe(false);
  });
});

describe('providerAcceptedRefund', () => {
  it('is true only for a status the provider uses to mean accepted', () => {
    expect(providerAcceptedRefund('succeeded')).toBe(true);
    expect(providerAcceptedRefund('pending')).toBe(true);
  });

  /** Recording an unknown status as pending must not become a promise to a family. */
  it('is false for anything unrecognised, refused or waiting on someone', () => {
    for (const status of [
      'requires_action',
      'failed',
      'canceled',
      'something_new',
      '',
      null,
      undefined,
    ]) {
      expect(providerAcceptedRefund(status)).toBe(false);
    }
  });
});
