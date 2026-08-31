import { describe, expect, it } from 'vitest';
import {
  canTutorReceivePayments,
  connectedAccountStatusFor,
  NO_CONNECTED_ACCOUNT,
  onboardingIsIncomplete,
  type ConnectedAccountState,
} from './connect-readiness';

/** A payable account, so each test varies exactly one thing from ready. */
const ready: ConnectedAccountState = {
  chargesEnabled: true,
  payoutsEnabled: true,
  transfersCapability: 'active',
  detailsSubmitted: true,
  currentlyDue: [],
  pastDue: [],
  disabledReason: null,
};

describe('canTutorReceivePayments', () => {
  it('is true when transfers are active and payouts are enabled', () => {
    expect(canTutorReceivePayments(ready)).toBe(true);
  });

  it('is false without the transfers capability, however complete the rest looks', () => {
    expect(canTutorReceivePayments({ ...ready, transfersCapability: 'pending' })).toBe(false);
    expect(canTutorReceivePayments({ ...ready, transfersCapability: 'inactive' })).toBe(false);
  });

  it('is false when payouts are disabled, because the money would stop at Stripe', () => {
    expect(canTutorReceivePayments({ ...ready, payoutsEnabled: false })).toBe(false);
  });

  /**
   * THE POINT OF THE WHOLE MODULE. Studdy uses separate charges and transfers,
   * so the parent's charge is created on the PLATFORM account. Whether the
   * connected account may create its own charges is irrelevant to whether
   * Studdy can pay this tutor, and gating on it would refuse payable people.
   */
  it('does NOT require charges_enabled on the connected account', () => {
    expect(canTutorReceivePayments({ ...ready, chargesEnabled: false })).toBe(true);
  });

  /** Finishing the form is not the same as Stripe accepting the account. */
  it('does not treat details_submitted as payable on its own', () => {
    expect(
      canTutorReceivePayments({
        ...NO_CONNECTED_ACCOUNT,
        detailsSubmitted: true,
      }),
    ).toBe(false);
  });

  it('treats a missing account as not payable', () => {
    expect(canTutorReceivePayments(NO_CONNECTED_ACCOUNT)).toBe(false);
  });
});

describe('connectedAccountStatusFor', () => {
  it('reports complete for a payable account', () => {
    expect(connectedAccountStatusFor(ready)).toBe('complete');
  });

  it('reports pending while Stripe still wants information', () => {
    expect(connectedAccountStatusFor({ ...ready, transfersCapability: 'pending' })).toBe('pending');
  });

  it('reports restricted when Stripe gives a disabled reason', () => {
    expect(connectedAccountStatusFor({ ...ready, disabledReason: 'requirements.past_due' })).toBe(
      'restricted',
    );
  });

  /**
   * Restricted BEATS complete, deliberately. An account can be payable today
   * and still have a requirement past its deadline that will disable it. Saying
   * "you're all set" there would leave the tutor to discover the problem when a
   * transfer fails, instead of while acting is still cheap.
   */
  it('prefers restricted over complete when a payable account is already past due', () => {
    const payableButPastDue: ConnectedAccountState = {
      ...ready,
      pastDue: ['individual.verification.document'],
    };
    expect(canTutorReceivePayments(payableButPastDue)).toBe(true);
    expect(connectedAccountStatusFor(payableButPastDue)).toBe('restricted');
  });

  it('reports pending for an account that has not started', () => {
    expect(connectedAccountStatusFor(NO_CONNECTED_ACCOUNT)).toBe('pending');
  });
});

describe('onboardingIsIncomplete', () => {
  it('is false for a clean payable account', () => {
    expect(onboardingIsIncomplete(ready)).toBe(false);
  });

  it('is true when requirements are outstanding', () => {
    expect(onboardingIsIncomplete({ ...ready, currentlyDue: ['individual.id_number'] })).toBe(true);
  });

  it('is true whenever the tutor is not payable', () => {
    expect(onboardingIsIncomplete({ ...ready, payoutsEnabled: false })).toBe(true);
  });
});
