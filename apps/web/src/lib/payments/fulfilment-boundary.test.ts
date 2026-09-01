import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * THE BOUNDARY THIS SLICE MUST NOT LOSE: only a signature-verified webhook can
 * turn a payment into a booking.
 *
 * These are source-shape assertions, and that is deliberate. The behaviour is
 * proved elsewhere — signature verification against real signatures in
 * `@studdy/integrations`, the fulfilment transaction against real Postgres in
 * `@studdy/database`. What cannot be proved by either is the ABSENCE of a
 * second path, and absence is exactly what a security boundary is made of. The
 * cheapest way to lose this property is somebody adding a convenient call in a
 * server action six months from now, and that is what fails here.
 */

/** Walk `src`, returning every file's path and contents. */
function sourceFiles(): { path: string; text: string }[] {
  const root = join(process.cwd(), 'src');
  const found: { path: string; text: string }[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry)) continue;
      // Test files are excluded, and they have to be: this file names every
      // symbol it is scanning for, so including it would make the scan match
      // itself and the boundary would look breached by the test that guards it.
      if (/\.test\.tsx?$/.test(entry)) continue;
      found.push({ path: full, text: readFileSync(full, 'utf8') });
    }
  };
  walk(root);
  return found;
}

const files = sourceFiles();
const WEBHOOK_ROUTE = join('api', 'webhooks', 'stripe', 'payments', 'route.ts');
const RECONCILE_JOB = join('lib', 'jobs', 'reconcile-payments.ts');

describe('only the webhook and the reconciler can fulfil', () => {
  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  /**
   * TWO CALLERS, AND BOTH ARE SERVER-AUTHORITATIVE. The webhook applies a
   * signature-verified event; the reconciler asks Stripe directly. Neither can
   * be reached by a browser, and there is no third.
   */
  it('calls the fulfilment command from exactly two places', () => {
    const callers = files
      .filter((file) => /applyPaymentProviderEvent\s*\(/.test(file.text))
      .map((file) => file.path);
    expect(callers).toHaveLength(2);
    expect(callers.some((path) => path.endsWith(WEBHOOK_ROUTE))).toBe(true);
    expect(callers.some((path) => path.endsWith(RECONCILE_JOB))).toBe(true);
  });

  /**
   * NO SERVER ACTION FULFILS ANYTHING. A `'use server'` file is reachable from
   * the browser by design; one that could confirm a booking would make the
   * success page a write path, which is the single thing decision 7 forbids.
   */
  it('never reaches fulfilment from a server action', () => {
    const offenders = files.filter(
      (file) =>
        /^['"]use server['"]/m.test(file.text) &&
        /applyPaymentProviderEvent|paymentsAwaitingReconciliation/.test(file.text),
    );
    expect(offenders.map((file) => file.path)).toEqual([]);
  });

  /** And certainly not from a client component. */
  it('never reaches fulfilment from a client component', () => {
    const offenders = files.filter(
      (file) =>
        /^['"]use client['"]/m.test(file.text) && /applyPaymentProviderEvent/.test(file.text),
    );
    expect(offenders.map((file) => file.path)).toEqual([]);
  });

  /**
   * The parent's payment surface READS. `startPaymentForRequest` prepares an
   * intent and `livePaymentForRequest` reports a status; neither confirms
   * anything, and reaching a Stripe return URL still fulfils exactly nothing.
   */
  it('keeps the payment server action free of any fulfilment call', () => {
    const actions = files.find((file) =>
      file.path.endsWith(join('payments', 'payment-actions.ts')),
    );
    expect(actions).toBeDefined();
    expect(/applyPaymentProviderEvent/.test(actions!.text)).toBe(false);
    expect(/booking_confirmed/.test(actions!.text)).toBe(false);
    expect(/'fulfilled'/.test(actions!.text)).toBe(false);
  });
});

describe('the webhook verifies before it writes', () => {
  const route = files.find((file) => file.path.endsWith(WEBHOOK_ROUTE));

  it('has a payments webhook route', () => {
    expect(route).toBeDefined();
  });

  /**
   * THE ORDER IS THE SECURITY MODEL. The raw body and the signature check must
   * both come before the first call that can touch a row. Asserted by position
   * rather than by reading the code, so a later edit that reorders them fails.
   */
  it('verifies the signature before any database or provider call', () => {
    const text = route!.text;
    const verifyAt = text.indexOf('verifyPaymentEvent(');
    const applyAt = text.indexOf('applyPaymentProviderEvent(');
    const retrieveAt = text.indexOf('retrieveAuthoritativePaymentIntent(');
    expect(verifyAt).toBeGreaterThan(-1);
    expect(applyAt).toBeGreaterThan(verifyAt);
    expect(retrieveAt).toBeGreaterThan(verifyAt);
  });

  /**
   * `request.text()`, never `request.json()`. The signature covers the exact
   * bytes Stripe sent, so a parsed-and-restringified body will not verify —
   * and the failure mode looks exactly like tampering.
   */
  it('reads the raw body rather than parsing it', () => {
    expect(/await request\.text\(\)/.test(route!.text)).toBe(true);
    expect(/request\.json\(\)/.test(route!.text)).toBe(false);
  });

  /** Node runtime: the crypto the SDK verifies with is not on the edge. */
  it('runs on the node runtime', () => {
    expect(/export const runtime = 'nodejs'/.test(route!.text)).toBe(true);
  });

  /** A GET must never mutate. */
  it('refuses GET', () => {
    expect(/method_not_allowed/.test(route!.text)).toBe(true);
  });

  /**
   * LIVE MONEY CANNOT REACH A SANDBOX LEDGER. The check is on Studdy's own
   * environment, so nothing in the request can talk its way past it.
   */
  it('refuses a livemode mismatch', () => {
    expect(/EXPECTED_LIVEMODE/.test(route!.text)).toBe(true);
    expect(/STUDDY_ENVIRONMENT/.test(route!.text)).toBe(true);
  });
});

describe('Stripe secrets stay on the server', () => {
  /**
   * `NEXT_PUBLIC_` is inlined into the browser bundle at build time. The
   * publishable key is the ONLY Stripe key permitted there.
   */
  it('never prefixes a Stripe secret or webhook secret with NEXT_PUBLIC_', () => {
    const offenders = files.filter((file) =>
      /NEXT_PUBLIC_STRIPE_(SECRET|WEBHOOK|PAYMENTS|CONNECT)/.test(file.text),
    );
    expect(offenders.map((file) => file.path)).toEqual([]);
  });

  it('never names a Stripe secret in a client component', () => {
    const offenders = files.filter(
      (file) =>
        /^['"]use client['"]/m.test(file.text) &&
        /STRIPE_SECRET_KEY|STRIPE_[A-Z_]*WEBHOOK_SECRET/.test(file.text),
    );
    expect(offenders.map((file) => file.path)).toEqual([]);
  });

  /**
   * THE TWO SIGNING SECRETS ARE DISTINCT, and the payments route must read its
   * own. Stripe issues one per endpoint; using the Connect secret here would
   * fail every signature check with something that reads as tampering.
   */
  it('reads the payments webhook secret, not the Connect one', () => {
    const route = files.find((file) => file.path.endsWith(WEBHOOK_ROUTE));
    expect(/STRIPE_PAYMENTS_WEBHOOK_SECRET/.test(route!.text)).toBe(true);
    expect(/STRIPE_CONNECT_WEBHOOK_SECRET/.test(route!.text)).toBe(false);
  });

  /**
   * NO CONNECTED-ACCOUNT IDENTIFIER IS FAMILY- OR TUTOR-FACING. A tutor sees a
   * status, never an `acct_` id, and the transfer's destination is read from
   * Studdy's own row inside the fulfilment transaction.
   */
  it('never renders a provider account id in a page or component', () => {
    const offenders = files.filter(
      (file) =>
        /\.(tsx)$/.test(file.path) && /providerAccountId|provider_account_id/.test(file.text),
    );
    expect(offenders.map((file) => file.path)).toEqual([]);
  });
});

describe('no payout amount is client-supplied', () => {
  /**
   * The tutor's entitlement is copied from the payment snapshot INSIDE the
   * fulfilment transaction, and the web layer never names it — so there is no
   * field for a browser to tamper with and no line for a later edit to make
   * configurable.
   *
   * The parent's own total is deliberately NOT covered by this: the payment
   * action does pass an `amountMinor` to Stripe, and it is the figure the
   * repository computed from the service version. Slice 5 proves that shape
   * has no caller-supplied amount; what matters here is the PAYOUT.
   */
  it('never names the tutor entitlement or a transfer amount in the web layer', () => {
    const offenders = files.filter((file) =>
      /tutorEntitlementMinor|tutorTransfers|transferAmount/.test(file.text),
    );
    expect(offenders.map((file) => file.path)).toEqual([]);
  });
});
