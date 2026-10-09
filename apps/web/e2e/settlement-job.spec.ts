import { expect, test } from '@playwright/test';

/**
 * The settlement endpoint's door: who may knock, how, and with what.
 *
 * NO STRIPE IS NEEDED, and none is touched. Every case here is decided before a
 * provider could be called — authentication, method, input shape, or a total that
 * does not match what is eligible. What a settlement run DOES once it is allowed
 * is proved elsewhere: eligibility and recording against a real database in
 * `settlement.integration.test.ts`, and the provider conversation in the job's
 * unit tests. A browser run cannot produce a payable tutor and a finished lesson,
 * so asserting more here would only assert a stub.
 *
 * This endpoint can move real money, so its refusals are the point — and the one
 * most worth proving is that it will not send on a total nobody reviewed.
 */

const supabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL !== undefined;
const SECRET = 'local-development-cron-secret';
const ROUTE = '/api/jobs/settlement';
const authorised = { Authorization: `Bearer ${SECRET}` };

test.describe('settlement job endpoint — the door', () => {
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

  test('refuses to send money without the secret', async ({ request }) => {
    const response = await request.post(ROUTE, {
      data: { execute: true, expectedTotalMinor: '3600' },
    });
    expect(response.status()).toBe(401);
    expect(JSON.stringify(await response.json())).not.toMatch(/total|eligible|PAY-/i);
  });

  test('refuses GET, because every use of this endpoint changes state or reveals money', async ({
    request,
  }) => {
    const response = await request.get(ROUTE);
    expect(response.status()).toBe(405);
  });
});

test.describe('settlement job endpoint — input', () => {
  test.skip(!supabaseConfigured, 'Requires local Supabase (pnpm supabase:start)');

  /** THERE IS NO DEFAULT ACTION: nothing may move money by omission. */
  test('refuses an empty body rather than doing something', async ({ request }) => {
    const response = await request.post(ROUTE, { headers: authorised });
    expect(response.status()).toBe(400);
    expect((await response.json()) as Record<string, unknown>).toEqual({ error: 'invalid_body' });
  });

  test('refuses an object it does not recognise', async ({ request }) => {
    const response = await request.post(ROUTE, { headers: authorised, data: { go: true } });
    expect(response.status()).toBe(400);
  });

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
      data: '[1, 2]',
    });
    expect(response.status()).toBe(400);
  });

  test('will not execute without the total that was reviewed', async ({ request }) => {
    const response = await request.post(ROUTE, { headers: authorised, data: { execute: true } });
    expect(response.status()).toBe(400);
    expect((await response.json()) as Record<string, unknown>).toEqual({
      error: 'invalid_expected_total',
    });
  });

  test.describe('the reviewed total', () => {
    for (const bad of ['', 'abc', '12.50', '-1', '1e6', ' 3600', '1234567890123']) {
      test(`rejects ${JSON.stringify(bad)}`, async ({ request }) => {
        const response = await request.post(ROUTE, {
          headers: authorised,
          data: { execute: true, expectedTotalMinor: bad },
        });
        expect(response.status()).toBe(400);
      });
    }

    test('rejects one that is a number rather than a string', async ({ request }) => {
      const response = await request.post(ROUTE, {
        headers: authorised,
        data: { execute: true, expectedTotalMinor: 3600 },
      });
      expect(response.status()).toBe(400);
    });
  });

  /**
   * THE ONE MOST WORTH PROVING: a total nobody reviewed sends nothing. The
   * number below is larger than anything this database could owe, so it can
   * never match, and the refusal happens before a provider could be reached.
   */
  test('sends nothing, and says what the total is, when it is not the one reviewed', async ({
    request,
  }) => {
    const response = await request.post(ROUTE, {
      headers: authorised,
      data: { execute: true, expectedTotalMinor: '999999999999' },
    });
    expect(response.status()).toBe(409);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body['ok']).toBe(false);
    expect(body['result']).toBe('total_changed');
    expect(body['expectedTotalMinor']).toBe('999999999999');
    expect(typeof body['eligibleTotalMinor']).toBe('string');
  });

  test.describe('a payment reference to requeue', () => {
    for (const bad of ['', 'abc', 'pay-10000001', 'PAY-1', "PAY-1' OR 1=1 --"]) {
      test(`rejects ${JSON.stringify(bad)} before it reaches the database`, async ({ request }) => {
        const response = await request.post(ROUTE, {
          headers: authorised,
          data: { requeue: bad },
        });
        expect(response.status()).toBe(400);
      });
    }

    test('says plainly that a payment does not exist', async ({ request }) => {
      const response = await request.post(ROUTE, {
        headers: authorised,
        data: { requeue: 'PAY-00000000' },
      });
      expect(response.status()).toBe(404);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body['ok']).toBe(false);
      expect(body['refusal']).toBe('payment_not_found');
    });
  });
});

test.describe('settlement job endpoint — report', () => {
  test.skip(!supabaseConfigured, 'Requires local Supabase (pnpm supabase:start)');

  test('reports what is owed and what is held, as references and amounts only', async ({
    request,
  }) => {
    const response = await request.post(ROUTE, { headers: authorised, data: { report: true } });
    expect(response.status()).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body['ok']).toBe(true);
    expect(Array.isArray(body['eligible'])).toBe(true);
    expect(Array.isArray(body['held'])).toBe(true);
    expect(typeof body['eligibleTotals']).toBe('object');
    expect(typeof body['heldByReason']).toBe('object');

    // Never a provider identifier, a person or an address.
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/\b(pi|re|ch|tr|txn|acct|cus)_[A-Za-z0-9]+/);
    expect(text).not.toContain('@');
  });
});
