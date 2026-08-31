import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';
import {
  snapshotFromAccount,
  stripeClient,
  StripeConfigurationError,
  StripeSignatureError,
  verifyWebhookEvent,
} from './connect';

/**
 * The Stripe adapter's own guarantees, with no network and no Stripe account.
 *
 * Signature verification is tested against a REAL signature computed the way
 * Stripe computes one, rather than a mocked verifier — the whole value of the
 * check is that it rejects things, and a stubbed verifier would prove nothing.
 */

/** A Stripe Account as the API returns it, trimmed to what the adapter reads. */
function account(overrides: Record<string, unknown> = {}): Stripe.Account {
  return {
    id: 'acct_test',
    object: 'account',
    charges_enabled: false,
    payouts_enabled: false,
    details_submitted: false,
    capabilities: { transfers: 'inactive' },
    requirements: {
      currently_due: [],
      past_due: [],
      eventually_due: [],
      pending_verification: [],
      disabled_reason: null,
      current_deadline: null,
      errors: [],
      alternatives: [],
    },
    ...overrides,
  } as unknown as Stripe.Account;
}

describe('snapshotFromAccount', () => {
  it('reads the payability fields Studdy decides with', () => {
    const snapshot = snapshotFromAccount(
      account({
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        capabilities: { transfers: 'active' },
      }),
    );
    expect(snapshot.providerAccountId).toBe('acct_test');
    expect(snapshot.chargesEnabled).toBe(true);
    expect(snapshot.payoutsEnabled).toBe(true);
    expect(snapshot.transfersCapability).toBe('active');
    expect(snapshot.detailsSubmitted).toBe(true);
  });

  /**
   * THE DATA-MINIMISATION BOUNDARY. Stripe's Account carries the tutor's name,
   * date of birth, address and document details for an Express account. None of
   * it is read here, so none of it can be stored or logged downstream.
   */
  it('copies no identity or KYC data out of the account', () => {
    const snapshot = snapshotFromAccount(
      account({
        individual: {
          first_name: 'Ada',
          last_name: 'Lovelace',
          dob: { day: 10, month: 12, year: 1815 },
          address: { line1: '12 Analytical Way', city: 'Auckland' },
          id_number_provided: true,
          ssn_last_4_provided: true,
        },
        business_profile: { name: 'Ada Tutoring' },
        email: 'ada@example.test',
      }),
    );
    const serialised = JSON.stringify(snapshot);
    expect(serialised).not.toContain('Ada');
    expect(serialised).not.toContain('Lovelace');
    expect(serialised).not.toContain('Analytical Way');
    expect(serialised).not.toContain('ada@example.test');
    expect(Object.keys(snapshot).sort()).toEqual(
      [
        'chargesEnabled',
        'currentDeadline',
        'currentlyDue',
        'detailsSubmitted',
        'disabledReason',
        'pastDue',
        'payoutsEnabled',
        'providerAccountId',
        'transfersCapability',
      ].sort(),
    );
  });

  it('keeps requirement identifiers, which are field names rather than values', () => {
    const snapshot = snapshotFromAccount(
      account({
        requirements: {
          currently_due: ['individual.id_number'],
          past_due: ['individual.verification.document'],
          disabled_reason: 'requirements.past_due',
          current_deadline: 1_800_000_000,
        },
      }),
    );
    expect(snapshot.currentlyDue).toEqual(['individual.id_number']);
    expect(snapshot.pastDue).toEqual(['individual.verification.document']);
    expect(snapshot.disabledReason).toBe('requirements.past_due');
    expect(snapshot.currentDeadline).toEqual(new Date(1_800_000_000 * 1000));
  });

  /**
   * Stripe types capability status as an open string for forward
   * compatibility. Anything unrecognised must fail CLOSED — an unknown state
   * read as "active" would mark a tutor payable on a guess.
   */
  it('treats an unrecognised capability status as not active', () => {
    const snapshot = snapshotFromAccount(
      account({ capabilities: { transfers: 'some_future_state' } }),
    );
    expect(snapshot.transfersCapability).toBe('inactive');
  });

  it('survives an account with no requirements hash at all', () => {
    const snapshot = snapshotFromAccount(account({ requirements: null }));
    expect(snapshot.currentlyDue).toEqual([]);
    expect(snapshot.pastDue).toEqual([]);
    expect(snapshot.disabledReason).toBeNull();
    expect(snapshot.currentDeadline).toBeNull();
  });
});

describe('stripeClient', () => {
  it('refuses to build a client with no secret key', () => {
    expect(() => stripeClient(undefined)).toThrow(StripeConfigurationError);
    expect(() => stripeClient('   ')).toThrow(StripeConfigurationError);
  });
});

describe('verifyWebhookEvent', () => {
  const secret = 'whsec_test_secret';
  const stripe = stripeClient('sk_test_not_a_real_key');

  /** Sign a payload exactly as Stripe does: `t=<ts>,v1=<hmac of "ts.body">`. */
  function signature(payload: string, timestamp: number, withSecret = secret): string {
    const digest = createHmac('sha256', withSecret)
      .update(`${timestamp}.${payload}`, 'utf8')
      .digest('hex');
    return `t=${timestamp},v1=${digest}`;
  }

  const payload = JSON.stringify({
    id: 'evt_test',
    object: 'event',
    type: 'account.updated',
    created: 1_800_000_000,
    data: { object: { id: 'acct_test', object: 'account' } },
  });

  it('accepts a correctly signed payload', async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const event = await verifyWebhookEvent(stripe, payload, signature(payload, timestamp), secret);
    expect(event.id).toBe('evt_test');
    expect(event.type).toBe('account.updated');
  });

  it('rejects a payload signed with the wrong secret', async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    await expect(
      verifyWebhookEvent(stripe, payload, signature(payload, timestamp, 'whsec_wrong'), secret),
    ).rejects.toThrow(StripeSignatureError);
  });

  /** The signature covers the exact bytes. A tampered body must not verify. */
  it('rejects a body altered after signing', async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const header = signature(payload, timestamp);
    const tampered = payload.replace('acct_test', 'acct_attacker');
    await expect(verifyWebhookEvent(stripe, tampered, header, secret)).rejects.toThrow(
      StripeSignatureError,
    );
  });

  it('rejects a missing signature header', async () => {
    await expect(verifyWebhookEvent(stripe, payload, null, secret)).rejects.toThrow(
      StripeSignatureError,
    );
  });

  /** Replay protection: Stripe's default tolerance rejects an old timestamp. */
  it('rejects a signature far outside the timestamp tolerance', async () => {
    const old = Math.floor(Date.now() / 1000) - 60 * 60;
    await expect(
      verifyWebhookEvent(stripe, payload, signature(payload, old), secret),
    ).rejects.toThrow(StripeSignatureError);
  });

  /**
   * Refuses rather than accepting anything when unconfigured. A missing secret
   * must never degrade into "process it unverified".
   */
  it('refuses to verify when no webhook secret is configured', async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    await expect(
      verifyWebhookEvent(stripe, payload, signature(payload, timestamp), undefined),
    ).rejects.toThrow(StripeConfigurationError);
  });

  it('never leaks the provider message or the secret in the error', async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    try {
      await verifyWebhookEvent(
        stripe,
        payload,
        signature(payload, timestamp, 'whsec_wrong'),
        secret,
      );
      expect.unreachable('verification should have failed');
    } catch (error) {
      expect(String((error as Error).message)).not.toContain(secret);
      expect(String((error as Error).message)).toBe(
        'Stripe webhook signature verification failed.',
      );
    }
  });
});
