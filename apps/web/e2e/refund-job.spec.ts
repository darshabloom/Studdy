import { expect, test } from '@playwright/test';

/**
 * The refund endpoint's door: who may knock, how, and with what.
 *
 * NO STRIPE IS NEEDED, and none is touched. Every case here is decided before a
 * provider could be called — authentication, method, and input shape — or by the
 * database alone (a payment that does not exist). What a refund DOES once it is
 * allowed is proved elsewhere: the decision and its recording against a real
 * database in `refunds.integration.test.ts`, and the provider conversation in
 * the job's unit tests. A browser run cannot produce a payment Stripe will
 * refund, so asserting more here would only assert a stub.
 *
 * This endpoint moves money, so its refusals are the point.
 */

const supabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL !== undefined;
const SECRET = 'local-development-cron-secret';
const ROUTE = '/api/jobs/refunds';
const authorised = { Authorization: `Bearer ${SECRET}` };

test.describe('refund job endpoint — the door', () => {
  test('refuses a request without the shared secret', async ({ request }) => {
    const response = await request.post(ROUTE, { data: { report: true } });
    expect(response.status()).toBe(401);
  });

  test('refuses a wrong secret', async ({ request }) => {
    const response = await request.post(ROUTE, {
      headers: { Authorization: 'Bearer not-the-secret' },
      data: { report: true },
    });
    expect(response.status()).toBe(401);
  });

  /** A secret in a URL ends up in logs and history. */
  test('refuses a secret supplied in the query string', async ({ request }) => {
    const response = await request.post(`${ROUTE}?secret=${SECRET}`, { data: { report: true } });
    expect(response.status()).toBe(401);
  });

  test('refuses to start a refund without the secret', async ({ request }) => {
    const response = await request.post(ROUTE, { data: { paymentReference: 'PAY-10000001' } });
    expect(response.status()).toBe(401);
    // And says nothing about whether such a payment exists.
    expect(JSON.stringify(await response.json())).not.toMatch(/PAY-|refus|not_found/i);
  });

  test('refuses GET, because every use of this endpoint changes state or reveals money', async ({
    request,
  }) => {
    const response = await request.get(ROUTE);
    expect(response.status()).toBe(405);
  });
});

test.describe('refund job endpoint — input', () => {
  test.skip(!supabaseConfigured, 'Requires local Supabase (pnpm supabase:start)');

  test('rejects a body that is not JSON', async ({ request }) => {
    const response = await request.post(ROUTE, {
      headers: { ...authorised, 'Content-Type': 'application/json' },
      data: '{not json',
    });
    expect(response.status()).toBe(400);
  });

  test('rejects a body that is not an object', async ({ request }) => {
    const response = await request.post(ROUTE, {
      headers: { ...authorised, 'Content-Type': 'application/json' },
      data: '[1, 2, 3]',
    });
    expect(response.status()).toBe(400);
  });

  test.describe('a payment reference', () => {
    for (const bad of ['', 'abc', 'pay-10000001', 'PAY-1', 'PAY-100000012', "PAY-1' OR 1=1 --"]) {
      test(`rejects ${JSON.stringify(bad)} before it reaches the database`, async ({ request }) => {
        const response = await request.post(ROUTE, {
          headers: authorised,
          data: { paymentReference: bad },
        });
        expect(response.status()).toBe(400);
        expect((await response.json()) as Record<string, unknown>).toEqual({
          error: 'invalid_payment_reference',
        });
      });
    }

    test('rejects one that is not a string', async ({ request }) => {
      const response = await request.post(ROUTE, {
        headers: authorised,
        data: { paymentReference: 10000001 },
      });
      expect(response.status()).toBe(400);
    });
  });

  /** An unknown payment is a 404, and nothing is written or sent to Stripe. */
  test('says plainly that a payment does not exist', async ({ request }) => {
    const response = await request.post(ROUTE, {
      headers: authorised,
      data: { paymentReference: 'PAY-00000000' },
    });
    expect(response.status()).toBe(404);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body['ok']).toBe(false);
    expect(body['result']).toBe('refused');
    expect(body['refusal']).toBe('payment_not_found');
  });
});

test.describe('refund job endpoint — read and sweep', () => {
  test.skip(!supabaseConfigured, 'Requires local Supabase (pnpm supabase:start)');

  test('reports what is waiting, as references and amounts only', async ({ request }) => {
    const response = await request.post(ROUTE, { headers: authorised, data: { report: true } });
    expect(response.status()).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body['ok']).toBe(true);
    expect(Array.isArray(body['awaitingRefund'])).toBe(true);
    expect(typeof body['byStatus']).toBe('object');

    // Never a provider identifier or a person.
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/\b(pi|re|ch|txn|acct|cus)_[A-Za-z0-9]+/);
    expect(text).not.toMatch(/@/);
  });

  /** With no body the endpoint finishes refunds already started, and starts none. */
  test('sweeps, reporting counts only', async ({ request }) => {
    const response = await request.post(ROUTE, { headers: authorised });
    expect(response.status()).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body['ok']).toBe(true);
    for (const key of ['examined', 'settled', 'stillPending', 'unreadable']) {
      expect(typeof body[key]).toBe('number');
    }
    expect(JSON.stringify(body)).not.toMatch(/PAY-|RF-|LR-/);
  });
});
