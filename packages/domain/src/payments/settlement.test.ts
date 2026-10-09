import { describe, expect, it } from 'vitest';
import {
  decideSettlement,
  settlementTransferGroup,
  sumMinor,
  transferIdempotencyKey,
  type SettlementFacts,
} from './settlement';

const NOW = new Date('2026-10-20T00:00:00.000Z');

const eligible: SettlementFacts = {
  transferStatus: 'pending',
  paymentStatus: 'succeeded',
  refundRequired: false,
  hasLiveRefund: false,
  providerChargeId: 'ch_1',
  bookingStatus: 'confirmed',
  lessonEndsAt: new Date('2026-10-19T00:00:00.000Z'),
  transfersCapability: 'active',
  payoutsCapability: 'active',
  now: NOW,
};

describe('decideSettlement', () => {
  it('sends a transfer for a lesson that ended, on a succeeded payment, to a payable tutor', () => {
    expect(decideSettlement(eligible)).toEqual({ eligible: true });
  });

  it('also sends for a completed booking', () => {
    expect(decideSettlement({ ...eligible, bookingStatus: 'completed' })).toEqual({
      eligible: true,
    });
  });

  /** THE CORE OF THE RULE: never pay in advance of the lesson. */
  it('holds a lesson that has not ended yet', () => {
    expect(
      decideSettlement({ ...eligible, lessonEndsAt: new Date('2026-10-20T00:00:01.000Z') }),
    ).toEqual({ eligible: false, reason: 'lesson_not_ended' });
  });

  it('sends at exactly the end time: the lesson has ended', () => {
    expect(decideSettlement({ ...eligible, lessonEndsAt: NOW })).toEqual({ eligible: true });
  });

  it('holds a booking with no known end', () => {
    expect(decideSettlement({ ...eligible, lessonEndsAt: null })).toEqual({
      eligible: false,
      reason: 'lesson_not_ended',
    });
  });

  it('holds when there is no booking', () => {
    expect(decideSettlement({ ...eligible, bookingStatus: null })).toEqual({
      eligible: false,
      reason: 'no_booking',
    });
  });

  it('holds a cancelled booking', () => {
    expect(decideSettlement({ ...eligible, bookingStatus: 'cancelled' })).toEqual({
      eligible: false,
      reason: 'booking_cancelled',
    });
  });

  it('holds a payment that has not succeeded', () => {
    for (const paymentStatus of ['requires_payment', 'processing', 'failed', 'expired']) {
      expect(decideSettlement({ ...eligible, paymentStatus })).toEqual({
        eligible: false,
        reason: 'payment_not_succeeded',
      });
    }
  });

  /** Money must never go out against a lesson Studdy has decided to give back. */
  it('holds anything flagged for refund, and anything with a refund started or made', () => {
    expect(decideSettlement({ ...eligible, refundRequired: true })).toEqual({
      eligible: false,
      reason: 'flagged_for_refund',
    });
    expect(decideSettlement({ ...eligible, hasLiveRefund: true })).toEqual({
      eligible: false,
      reason: 'refund_started',
    });
  });

  it('holds a payment with no charge to send from', () => {
    expect(decideSettlement({ ...eligible, providerChargeId: null })).toEqual({
      eligible: false,
      reason: 'no_charge',
    });
  });

  it('holds an obligation that is not pending, so a sent one is never sent again', () => {
    for (const transferStatus of ['sent', 'failed', 'reversed']) {
      expect(decideSettlement({ ...eligible, transferStatus })).toEqual({
        eligible: false,
        reason: 'transfer_not_pending',
      });
    }
  });

  /** Payable NOW, not payable when the parent paid. */
  it('holds a tutor who is no longer payable, by Stripe’s own account state', () => {
    for (const patch of [
      { transfersCapability: 'restricted' as const },
      { transfersCapability: 'pending' as const },
      { payoutsCapability: 'restricted' as const },
      { payoutsCapability: 'unsupported' as const },
    ]) {
      expect(decideSettlement({ ...eligible, ...patch })).toEqual({
        eligible: false,
        reason: 'tutor_not_payable',
      });
    }
  });

  it('names the first failing check, in the order an operator would ask', () => {
    expect(
      decideSettlement({
        ...eligible,
        transferStatus: 'sent',
        paymentStatus: 'failed',
        refundRequired: true,
        lessonEndsAt: null,
        transfersCapability: 'restricted',
      }),
    ).toEqual({ eligible: false, reason: 'transfer_not_pending' });

    expect(
      decideSettlement({
        ...eligible,
        refundRequired: true,
        lessonEndsAt: null,
        transfersCapability: 'restricted',
      }),
    ).toEqual({ eligible: false, reason: 'flagged_for_refund' });
  });
});

describe('settlement identity', () => {
  it('groups a payment’s transfers under one stable group', () => {
    expect(settlementTransferGroup('pay-1')).toBe('payment:pay-1');
    expect(settlementTransferGroup('pay-1')).toBe(settlementTransferGroup('pay-1'));
  });

  it('keeps attempt one on the key the fulfilment transaction wrote', () => {
    expect(transferIdempotencyKey('pay-1', 1)).toBe('tutor-transfer:pay-1');
  });

  it('gives a retry its own key', () => {
    expect(transferIdempotencyKey('pay-1', 2)).toBe('tutor-transfer:pay-1:attempt-2');
    expect(transferIdempotencyKey('pay-1', 2)).not.toBe(transferIdempotencyKey('pay-1', 1));
  });
});

describe('sumMinor', () => {
  it('adds exactly, with no floating point', () => {
    expect(sumMinor([3600n, 3333n, 1n])).toBe(6934n);
    expect(sumMinor([])).toBe(0n);
  });
});
