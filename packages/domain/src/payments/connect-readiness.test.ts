import { describe, expect, it } from 'vitest';
import {
  asCapabilityStatus,
  canTutorReceivePayments,
  connectedAccountStatusFor,
  NO_CONNECTED_ACCOUNT,
  onboardingIsIncomplete,
  tutorCanResolveByOnboarding,
  type ConnectedAccountState,
} from './connect-readiness';

/** A payable account, so each test varies exactly one thing from ready. */
const ready: ConnectedAccountState = {
  transfersCapability: 'active',
  payoutsCapability: 'active',
  statusDetails: [],
};

describe('asCapabilityStatus', () => {
  it('accepts every status Stripe Accounts v2 documents', () => {
    expect(asCapabilityStatus('active')).toBe('active');
    expect(asCapabilityStatus('pending')).toBe('pending');
    expect(asCapabilityStatus('restricted')).toBe('restricted');
    expect(asCapabilityStatus('unsupported')).toBe('unsupported');
  });

  /**
   * Stripe types capability status as an open enum. A value Studdy has never
   * seen must never be read as payable — an unknown status marking a tutor
   * ready would be a guess with somebody's money behind it.
   */
  it('fails closed on anything it does not recognise', () => {
    expect(asCapabilityStatus('some_future_state')).toBe('unsupported');
    expect(asCapabilityStatus(null)).toBe('unsupported');
    expect(asCapabilityStatus(undefined)).toBe('unsupported');
    // v1's value, which v2 does not use. It must not sneak through as valid.
    expect(asCapabilityStatus('inactive')).toBe('unsupported');
  });
});

describe('canTutorReceivePayments', () => {
  it('is true when transfers and payouts are both active', () => {
    expect(canTutorReceivePayments(ready)).toBe(true);
  });

  it('is false without the transfers capability, however complete the rest looks', () => {
    for (const status of ['pending', 'restricted', 'unsupported'] as const) {
      expect(canTutorReceivePayments({ ...ready, transfersCapability: status })).toBe(false);
    }
  });

  it('is false without payouts, because the money would stop at Stripe', () => {
    for (const status of ['pending', 'restricted', 'unsupported'] as const) {
      expect(canTutorReceivePayments({ ...ready, payoutsCapability: status })).toBe(false);
    }
  });

  it('treats a missing account as not payable', () => {
    expect(canTutorReceivePayments(NO_CONNECTED_ACCOUNT)).toBe(false);
  });
});

describe('connectedAccountStatusFor', () => {
  it('reports complete for a payable account', () => {
    expect(connectedAccountStatusFor(ready)).toBe('complete');
  });

  it('reports pending while Stripe is still deciding', () => {
    expect(connectedAccountStatusFor({ ...ready, transfersCapability: 'pending' })).toBe('pending');
  });

  it('reports restricted when a capability is restricted or unsupported', () => {
    expect(connectedAccountStatusFor({ ...ready, payoutsCapability: 'restricted' })).toBe(
      'restricted',
    );
    expect(connectedAccountStatusFor({ ...ready, transfersCapability: 'unsupported' })).toBe(
      'restricted',
    );
  });

  /**
   * Restricted BEATS complete, deliberately. An account can be payable today
   * and still carry a blocking reason that will disable it. Saying "you're all
   * set" there leaves the tutor to discover the problem when a transfer fails,
   * instead of while acting is still cheap.
   */
  it('prefers restricted over complete when a payable account is already past due', () => {
    const payableButPastDue: ConnectedAccountState = {
      ...ready,
      statusDetails: [
        {
          capability: 'stripe_balance.payouts',
          code: 'requirements_past_due',
          resolution: 'provide_info',
        },
      ],
    };
    expect(canTutorReceivePayments(payableButPastDue)).toBe(true);
    expect(connectedAccountStatusFor(payableButPastDue)).toBe('restricted');
  });

  /** A verification in progress is waiting, not blocking. */
  it('does not treat pending verification as restricted', () => {
    const verifying: ConnectedAccountState = {
      transfersCapability: 'pending',
      payoutsCapability: 'pending',
      statusDetails: [
        {
          capability: 'stripe_balance.stripe_transfers',
          code: 'requirements_pending_verification',
          resolution: 'no_resolution',
        },
      ],
    };
    expect(connectedAccountStatusFor(verifying)).toBe('pending');
  });

  it('reports restricted for a not-yet-created account, which fails closed', () => {
    expect(connectedAccountStatusFor(NO_CONNECTED_ACCOUNT)).toBe('restricted');
  });
});

describe('onboardingIsIncomplete', () => {
  it('is false for a clean payable account', () => {
    expect(onboardingIsIncomplete(ready)).toBe(false);
  });

  it('is true whenever the tutor is not payable', () => {
    expect(onboardingIsIncomplete({ ...ready, payoutsCapability: 'pending' })).toBe(true);
  });

  it('is true for a payable account that still has information to provide', () => {
    expect(
      onboardingIsIncomplete({
        ...ready,
        statusDetails: [
          {
            capability: 'stripe_balance.payouts',
            code: 'requirements_past_due',
            resolution: 'provide_info',
          },
        ],
      }),
    ).toBe(true);
  });
});

describe('tutorCanResolveByOnboarding', () => {
  it('is true when Stripe says information will resolve it', () => {
    expect(
      tutorCanResolveByOnboarding({
        ...ready,
        statusDetails: [
          {
            capability: 'stripe_balance.stripe_transfers',
            code: 'requirements_past_due',
            resolution: 'provide_info',
          },
        ],
      }),
    ).toBe(true);
  });

  /**
   * Sending a tutor round the hosted flow again cannot fix an unsupported
   * country. Telling them the truth beats a button that will not help.
   */
  it('is false when only Stripe can resolve it', () => {
    expect(
      tutorCanResolveByOnboarding({
        transfersCapability: 'unsupported',
        payoutsCapability: 'unsupported',
        statusDetails: [
          {
            capability: 'stripe_balance.stripe_transfers',
            code: 'unsupported_country',
            resolution: 'contact_stripe',
          },
        ],
      }),
    ).toBe(false);
  });
});
