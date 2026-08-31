import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';
import {
  HANDLED_CONNECT_EVENT_TYPES,
  PAYOUTS_CAPABILITY,
  snapshotFromAccount,
  stripeClient,
  StripeConfigurationError,
  StripeSignatureError,
  TRANSFERS_CAPABILITY,
  verifyConnectEvent,
} from './connect';

/**
 * The Stripe Accounts v2 adapter's guarantees, with no network and no account.
 *
 * Signature verification is tested against a REAL signature computed the way
 * Stripe computes one, rather than a mocked verifier — the whole value of the
 * check is that it rejects things, and a stubbed verifier would prove nothing.
 */

/** A v2 Account as the API returns it, trimmed to what the adapter reads. */
function account(overrides: Record<string, unknown> = {}): Stripe.V2.Core.Account {
  return {
    id: 'acct_test',
    object: 'v2.core.account',
    livemode: false,
    applied_configurations: ['recipient'],
    identity: { country: 'NZ' },
    configuration: {
      recipient: {
        applied: true,
        capabilities: {
          stripe_balance: {
            stripe_transfers: { status: 'pending', status_details: [] },
            payouts: { status: 'pending', status_details: [] },
          },
        },
      },
    },
    ...overrides,
  } as unknown as Stripe.V2.Core.Account;
}

/** Build the recipient capability hash without repeating five levels of nesting. */
function withCapabilities(
  transfers: { status: string; status_details?: unknown[] },
  payouts: { status: string; status_details?: unknown[] },
): Stripe.V2.Core.Account {
  return account({
    configuration: {
      recipient: {
        applied: true,
        capabilities: {
          stripe_balance: {
            stripe_transfers: { status_details: [], ...transfers },
            payouts: { status_details: [], ...payouts },
          },
        },
      },
    },
  });
}

describe('snapshotFromAccount', () => {
  it('reads the v2 recipient capability statuses Studdy decides with', () => {
    const snapshot = snapshotFromAccount(
      withCapabilities({ status: 'active' }, { status: 'active' }),
    );
    expect(snapshot.providerAccountId).toBe('acct_test');
    expect(snapshot.transfersCapability).toBe('active');
    expect(snapshot.payoutsCapability).toBe('active');
    expect(snapshot.countryCode).toBe('NZ');
  });

  /**
   * THE DATA-MINIMISATION BOUNDARY. A v2 Account can carry the tutor's name,
   * date of birth, address and document details under `identity`. Only the
   * country is read, so nothing else can be stored or logged downstream.
   */
  it('copies no identity or KYC data beyond the country', () => {
    const snapshot = snapshotFromAccount(
      account({
        identity: {
          country: 'NZ',
          entity_type: 'individual',
          individual: {
            given_name: 'Ada',
            surname: 'Lovelace',
            date_of_birth: { day: 10, month: 12, year: 1815 },
            address: { line1: '12 Analytical Way', city: 'Auckland' },
            id_numbers: [{ type: 'nz_ird', registrar: 'IRD' }],
          },
        },
        contact_email: 'ada@example.test',
        display_name: 'Ada Tutoring',
      }),
    );
    const serialised = JSON.stringify(snapshot);
    expect(serialised).not.toContain('Ada');
    expect(serialised).not.toContain('Lovelace');
    expect(serialised).not.toContain('Analytical Way');
    expect(serialised).not.toContain('ada@example.test');
    expect(Object.keys(snapshot).sort()).toEqual(
      [
        'countryCode',
        'payoutsCapability',
        'providerAccountId',
        'statusDetails',
        'transfersCapability',
      ].sort(),
    );
  });

  /**
   * v2 replaces v1's requirement identifiers with machine-readable reason
   * codes, which is a privacy improvement: the reason is recorded without
   * naming which identity document is outstanding.
   */
  it('keeps capability status details as reason codes, tagged by capability', () => {
    const snapshot = snapshotFromAccount(
      withCapabilities(
        {
          status: 'restricted',
          status_details: [{ code: 'requirements_past_due', resolution: 'provide_info' }],
        },
        {
          status: 'unsupported',
          status_details: [{ code: 'unsupported_country', resolution: 'contact_stripe' }],
        },
      ),
    );
    expect(snapshot.transfersCapability).toBe('restricted');
    expect(snapshot.payoutsCapability).toBe('unsupported');
    expect(snapshot.statusDetails).toEqual([
      {
        capability: TRANSFERS_CAPABILITY,
        code: 'requirements_past_due',
        resolution: 'provide_info',
      },
      { capability: PAYOUTS_CAPABILITY, code: 'unsupported_country', resolution: 'contact_stripe' },
    ]);
  });

  /**
   * Fails CLOSED. An unrecognised status read as active would mark a tutor
   * payable on a guess, and v1's `inactive` must not sneak through either.
   */
  it('treats an unrecognised capability status as unsupported', () => {
    const snapshot = snapshotFromAccount(
      withCapabilities({ status: 'some_future_state' }, { status: 'inactive' }),
    );
    expect(snapshot.transfersCapability).toBe('unsupported');
    expect(snapshot.payoutsCapability).toBe('unsupported');
  });

  /**
   * When `include` is omitted the configuration is absent. That must read as
   * not payable rather than throwing — failing closed, not failing over.
   */
  it('survives an account returned without its recipient configuration', () => {
    const snapshot = snapshotFromAccount(account({ configuration: undefined }));
    expect(snapshot.transfersCapability).toBe('unsupported');
    expect(snapshot.payoutsCapability).toBe('unsupported');
    expect(snapshot.statusDetails).toEqual([]);
  });
});

describe('handled event types', () => {
  /**
   * v1's `account.updated` is NOT the v2 event. Naming it here would be a
   * silent no-op in production: Stripe would deliver v2 events forever and
   * Studdy would ignore every one.
   */
  it('targets the v2 recipient events and not the v1 name', () => {
    expect(HANDLED_CONNECT_EVENT_TYPES).toContain(
      'v2.core.account[configuration.recipient].capability_status_updated',
    );
    expect(HANDLED_CONNECT_EVENT_TYPES).toContain(
      'v2.core.account[configuration.recipient].updated',
    );
    expect(HANDLED_CONNECT_EVENT_TYPES).not.toContain('account.updated');
  });
});

describe('stripeClient', () => {
  it('refuses to build a client with no secret key', () => {
    expect(() => stripeClient(undefined)).toThrow(StripeConfigurationError);
    expect(() => stripeClient('   ')).toThrow(StripeConfigurationError);
  });
});

describe('verifyConnectEvent', () => {
  const secret = 'whsec_test_secret';
  const stripe = stripeClient('sk_test_not_a_real_key');

  /** Sign a payload exactly as Stripe does: `t=<ts>,v1=<hmac of "ts.body">`. */
  function signature(payload: string, timestamp: number, withSecret = secret): string {
    const digest = createHmac('sha256', withSecret)
      .update(`${timestamp}.${payload}`, 'utf8')
      .digest('hex');
    return `t=${timestamp},v1=${digest}`;
  }

  /** A THIN v2 notification: a reference, not the account. */
  const payload = JSON.stringify({
    id: 'evt_test',
    object: 'v2.core.event',
    type: 'v2.core.account[configuration.recipient].capability_status_updated',
    created: '2026-08-31T00:00:00.000Z',
    livemode: false,
    related_object: {
      id: 'acct_test',
      type: 'v2.core.account',
      url: '/v2/core/accounts/acct_test',
    },
  });

  it('accepts a correctly signed notification and extracts the account reference', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const event = verifyConnectEvent(stripe, payload, signature(payload, timestamp), secret);
    expect(event.id).toBe('evt_test');
    expect(event.type).toBe('v2.core.account[configuration.recipient].capability_status_updated');
    expect(event.relatedAccountId).toBe('acct_test');
    // v2 timestamps are ISO strings, not unix integers.
    expect(event.createdAt.toISOString()).toBe('2026-08-31T00:00:00.000Z');
  });

  it('rejects a payload signed with the wrong secret', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    expect(() =>
      verifyConnectEvent(stripe, payload, signature(payload, timestamp, 'whsec_wrong'), secret),
    ).toThrow(StripeSignatureError);
  });

  /** The signature covers the exact bytes. A tampered body must not verify. */
  it('rejects a body altered after signing', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const header = signature(payload, timestamp);
    const tampered = payload.replace('acct_test', 'acct_attacker');
    expect(() => verifyConnectEvent(stripe, tampered, header, secret)).toThrow(
      StripeSignatureError,
    );
  });

  it('rejects a missing signature header', () => {
    expect(() => verifyConnectEvent(stripe, payload, null, secret)).toThrow(StripeSignatureError);
  });

  /** Replay protection: Stripe's default tolerance rejects an old timestamp. */
  it('rejects a signature far outside the timestamp tolerance', () => {
    const old = Math.floor(Date.now() / 1000) - 60 * 60;
    expect(() => verifyConnectEvent(stripe, payload, signature(payload, old), secret)).toThrow(
      StripeSignatureError,
    );
  });

  /**
   * Refuses rather than accepting anything when unconfigured. A missing secret
   * must never degrade into "process it unverified".
   */
  it('refuses to verify when no webhook secret is configured', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    expect(() =>
      verifyConnectEvent(stripe, payload, signature(payload, timestamp), undefined),
    ).toThrow(StripeConfigurationError);
  });

  it('never leaks the provider message or the secret in the error', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    try {
      verifyConnectEvent(stripe, payload, signature(payload, timestamp, 'whsec_wrong'), secret);
      expect.unreachable('verification should have failed');
    } catch (error) {
      expect(String((error as Error).message)).not.toContain(secret);
      expect(String((error as Error).message)).toBe(
        'Stripe webhook signature verification failed.',
      );
    }
  });
});
