import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';
import {
  HANDLED_PAYMENT_EVENT_TYPES,
  retrieveAuthoritativePaymentIntent,
  stripeClient,
  StripeConfigurationError,
  StripeSignatureError,
  verifyPaymentEvent,
} from './index';

/**
 * The PaymentIntent adapter's guarantees, with no network and no account.
 *
 * Signature verification is tested against a REAL signature computed the way
 * Stripe computes one, rather than a mocked verifier — the whole value of the
 * check is that it rejects things, and a stubbed verifier would prove nothing.
 *
 * THE EVENT FIXTURE IS THE SHAPE STRIPE ACTUALLY SENT. It was taken from a real
 * `payment_intent.succeeded` in Studdy's own test-mode sandbox, not from memory
 * of the API reference: envelope `livemode`, unix `created`, lower-case
 * `currency`, `amount_received` alongside `amount`, `latest_charge` as an id,
 * and the three `studdy_*` metadata keys slice 5 attaches.
 */

const secret = 'whsec_test_secret_for_unit_tests_only';

function signature(payload: string, timestamp: number, withSecret = secret): string {
  const digest = createHmac('sha256', withSecret)
    .update(`${timestamp}.${payload}`, 'utf8')
    .digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

const succeededPayload = JSON.stringify({
  id: 'evt_3UAULbJ9PTUpKzAE0NfZi5fl',
  object: 'event',
  api_version: '2026-08-26.dahlia',
  created: 1788179670,
  livemode: false,
  type: 'payment_intent.succeeded',
  data: {
    object: {
      id: 'pi_3UAULbJ9PTUpKzAE0RUkxM0U',
      object: 'payment_intent',
      status: 'succeeded',
      amount: 4000,
      amount_received: 4000,
      currency: 'nzd',
      livemode: false,
      latest_charge: 'ch_3UAULbJ9PTUpKzAE0tcfNSTY',
      metadata: {
        studdy_payment_id: 'e9f8a9cd-e737-4778-9fe2-410d05ac4981',
        studdy_payment_reference: 'PAY-10000030',
        studdy_tutor_request_id: 'be4d8b67-b577-499b-8e94-1fca9415f384',
      },
    },
  },
});

const stripe = stripeClient('sk_test_unit_tests_only');

describe('the handled event list', () => {
  /**
   * FOUR, AND NO MORE. Each earns its place by changing what Studdy's ledger
   * should say; a fifth added because Stripe emits it would be a status nothing
   * drives.
   */
  it('handles exactly the four PaymentIntent events Studdy acts on', () => {
    expect([...HANDLED_PAYMENT_EVENT_TYPES]).toEqual([
      'payment_intent.succeeded',
      'payment_intent.processing',
      'payment_intent.payment_failed',
      'payment_intent.canceled',
    ]);
  });

  /** Charges, refunds and disputes record history; they change nothing owed. */
  it('does not handle charge, refund or dispute events', () => {
    for (const type of ['charge.succeeded', 'charge.refunded', 'charge.dispute.created']) {
      expect(HANDLED_PAYMENT_EVENT_TYPES).not.toContain(type);
    }
  });
});

describe('verifying a payment webhook signature', () => {
  const now = (): number => Math.floor(Date.now() / 1000);

  it('accepts a correctly signed body and reads the real event shape', () => {
    const timestamp = now();
    const event = verifyPaymentEvent(
      stripe,
      succeededPayload,
      signature(succeededPayload, timestamp),
      secret,
    );

    expect(event.id).toBe('evt_3UAULbJ9PTUpKzAE0NfZi5fl');
    expect(event.type).toBe('payment_intent.succeeded');
    expect(event.livemode).toBe(false);
    expect(event.paymentIntentId).toBe('pi_3UAULbJ9PTUpKzAE0RUkxM0U');
    // Stripe sends unix seconds; the adapter hands back a Date.
    expect(event.createdAt.toISOString()).toBe('2026-08-31T12:34:30.000Z');
  });

  /** The signature covers the exact bytes. One changed character invalidates it. */
  it('rejects a tampered body', () => {
    const timestamp = now();
    const header = signature(succeededPayload, timestamp);
    const tampered = succeededPayload.replace('"amount_received":4000', '"amount_received":1');
    expect(() => verifyPaymentEvent(stripe, tampered, header, secret)).toThrow(
      StripeSignatureError,
    );
  });

  it('rejects a body signed with a different secret', () => {
    const timestamp = now();
    const header = signature(succeededPayload, timestamp, 'whsec_someone_elses_secret');
    expect(() => verifyPaymentEvent(stripe, succeededPayload, header, secret)).toThrow(
      StripeSignatureError,
    );
  });

  /**
   * REPLAY PROTECTION. A genuinely signed body captured and re-sent hours later
   * is refused on age, which is why the timestamp is part of the signed string.
   */
  it('rejects a stale timestamp outside Stripe tolerance', () => {
    const stale = now() - 60 * 60;
    expect(() =>
      verifyPaymentEvent(stripe, succeededPayload, signature(succeededPayload, stale), secret),
    ).toThrow(StripeSignatureError);
  });

  it('rejects a missing signature header', () => {
    expect(() => verifyPaymentEvent(stripe, succeededPayload, null, secret)).toThrow(
      StripeSignatureError,
    );
  });

  /**
   * A MISSING SECRET IS A CONFIGURATION FAULT, NOT A FORGERY, and the two must
   * stay distinguishable: the route answers 400 to one and 500 to the other, so
   * a misconfigured deployment makes Stripe retry rather than discard.
   */
  it('refuses to verify at all when no secret is configured', () => {
    expect(() =>
      verifyPaymentEvent(stripe, succeededPayload, signature(succeededPayload, now()), undefined),
    ).toThrow(StripeConfigurationError);
    expect(() =>
      verifyPaymentEvent(stripe, succeededPayload, signature(succeededPayload, now()), '   '),
    ).toThrow(StripeConfigurationError);
  });

  /** Never leak the provider's message: it can describe the secret's shape. */
  it('does not surface the provider message or a cause', () => {
    try {
      verifyPaymentEvent(stripe, succeededPayload, 't=1,v1=deadbeef', secret);
      throw new Error('expected a signature error');
    } catch (error) {
      expect(error).toBeInstanceOf(StripeSignatureError);
      expect((error as Error).message).toBe('Stripe webhook signature verification failed.');
      expect((error as Error).cause).toBeUndefined();
    }
  });

  /** An event whose object is not a PaymentIntent names no intent to act on. */
  it('reports no payment intent for an unrelated object', () => {
    const payload = JSON.stringify({
      id: 'evt_other',
      object: 'event',
      created: 1788179670,
      livemode: false,
      type: 'charge.succeeded',
      data: { object: { id: 'ch_x', object: 'charge' } },
    });
    const event = verifyPaymentEvent(
      stripe,
      payload,
      signature(payload, Math.floor(Date.now() / 1000)),
      secret,
    );
    expect(event.paymentIntentId).toBeNull();
  });
});

describe('reading the authoritative PaymentIntent', () => {
  /** A retrieve that returns exactly what the real API returned in the sandbox. */
  function stripeReturning(intent: unknown): Stripe {
    return {
      paymentIntents: { retrieve: async () => intent },
    } as unknown as Stripe;
  }

  const baseIntent = {
    id: 'pi_test',
    status: 'succeeded',
    livemode: false,
    amount: 4000,
    amount_received: 4000,
    currency: 'nzd',
    metadata: {
      studdy_payment_id: 'e9f8a9cd-e737-4778-9fe2-410d05ac4981',
      studdy_payment_reference: 'PAY-10000030',
      studdy_tutor_request_id: 'be4d8b67-b577-499b-8e94-1fca9415f384',
    },
  };

  /**
   * THE LEDGER'S UNITS, not Stripe's. `bigint` minor units and an upper-case
   * currency, because that is what the payment snapshot holds — a comparison
   * between `'nzd'` and `'NZD'` is one that silently never matches.
   */
  it('normalises amounts to bigint and the currency to upper case', async () => {
    const result = await retrieveAuthoritativePaymentIntent(
      stripeReturning({
        ...baseIntent,
        latest_charge: {
          id: 'ch_test',
          balance_transaction: { id: 'txn_test', fee: 170 },
        },
      }),
      'pi_test',
    );

    expect(result.amountMinor).toBe(4000n);
    expect(result.amountReceivedMinor).toBe(4000n);
    expect(result.currencyCode).toBe('NZD');
    expect(result.livemode).toBe(false);
    expect(result.chargeId).toBe('ch_test');
    expect(result.balanceTransactionId).toBe('txn_test');
    expect(result.providerCostMinor).toBe(170n);
  });

  it('carries the Studdy correlation metadata back unchanged', async () => {
    const result = await retrieveAuthoritativePaymentIntent(
      stripeReturning({ ...baseIntent, latest_charge: null }),
      'pi_test',
    );
    expect(result.metadata.paymentId).toBe('e9f8a9cd-e737-4778-9fe2-410d05ac4981');
    expect(result.metadata.paymentReference).toBe('PAY-10000030');
    expect(result.metadata.tutorRequestId).toBe('be4d8b67-b577-499b-8e94-1fca9415f384');
  });

  /**
   * NEVER ESTIMATED. With no balance transaction there is no honest figure, and
   * the adapter reports null rather than zero — a zero cost is a claim, and an
   * absent one is the truth.
   */
  it('reports a null provider cost when no balance transaction was returned', async () => {
    const result = await retrieveAuthoritativePaymentIntent(
      stripeReturning({ ...baseIntent, latest_charge: null }),
      'pi_test',
    );
    expect(result.providerCostMinor).toBeNull();
    expect(result.chargeId).toBeNull();
    expect(result.balanceTransactionId).toBeNull();
  });

  /** An unexpanded charge is an id string; the cost is unknown, not invented. */
  it('handles an unexpanded charge reference', async () => {
    const result = await retrieveAuthoritativePaymentIntent(
      stripeReturning({ ...baseIntent, latest_charge: 'ch_unexpanded' }),
      'pi_test',
    );
    expect(result.chargeId).toBe('ch_unexpanded');
    expect(result.providerCostMinor).toBeNull();
  });

  /** An intent with no Studdy metadata correlates to nothing, and says so. */
  it('reports null metadata rather than guessing', async () => {
    const result = await retrieveAuthoritativePaymentIntent(
      stripeReturning({ ...baseIntent, metadata: {}, latest_charge: null }),
      'pi_test',
    );
    expect(result.metadata.paymentId).toBeNull();
    expect(result.metadata.tutorRequestId).toBeNull();
  });

  /** A partial capture must not read as a full one. */
  it('keeps amount and amount_received distinct', async () => {
    const result = await retrieveAuthoritativePaymentIntent(
      stripeReturning({ ...baseIntent, amount: 4000, amount_received: 0, latest_charge: null }),
      'pi_test',
    );
    expect(result.amountMinor).toBe(4000n);
    expect(result.amountReceivedMinor).toBe(0n);
  });

  /** Live mode is reported, never normalised away. The route refuses on it. */
  it('reports livemode as the provider stated it', async () => {
    const result = await retrieveAuthoritativePaymentIntent(
      stripeReturning({ ...baseIntent, livemode: true, latest_charge: null }),
      'pi_test',
    );
    expect(result.livemode).toBe(true);
  });
});
