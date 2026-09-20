import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * THE BOUNDARIES THIS SLICE MUST NOT LOSE: the sending key stays on the server,
 * nothing reachable from a browser can send mail, and email links are built from
 * configuration rather than from a request.
 *
 * Source-shape assertions, deliberately. Behaviour is proved elsewhere — the
 * durable delivery rules against real Postgres, the copy in the template tests.
 * What neither can prove is the ABSENCE of a second path, and absence is what a
 * security boundary is made of. The cheapest way to lose any of these is an
 * edit six months from now, and that is what fails here.
 */

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
      // Test files name every symbol they scan for; including them would make
      // the scan match itself.
      if (/\.test\.tsx?$/.test(entry)) continue;
      found.push({ path: full, text: readFileSync(full, 'utf8') });
    }
  };
  walk(root);
  return found;
}

const files = sourceFiles();
const DRAIN_JOB = join('lib', 'jobs', 'drain-outbox.ts');

describe('the sending key stays on the server', () => {
  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  /**
   * `NEXT_PUBLIC_` is inlined into the browser bundle at build time. A Resend
   * key there would let anyone send mail as Studdy.
   */
  it('never prefixes a mail secret with NEXT_PUBLIC_', () => {
    const offenders = files.filter((file) =>
      /NEXT_PUBLIC_[A-Z_]*(RESEND|SMTP|MAIL|OPS_EMAIL)/.test(file.text),
    );
    expect(offenders.map((file) => file.path)).toEqual([]);
  });

  it('never names a mail secret in a client component', () => {
    const offenders = files.filter(
      (file) =>
        /^['"]use client['"]/m.test(file.text) &&
        /RESEND_API_KEY|RESEND_FROM_ADDRESS|STUDDY_OPS_EMAIL|EMAIL_DEV_REDIRECT_TO/.test(file.text),
    );
    expect(offenders.map((file) => file.path)).toEqual([]);
  });

  /** Only the drain reads mail configuration at all. */
  it('reads the Resend key in exactly one place', () => {
    const readers = files
      .filter((file) => /process\.env\.RESEND_API_KEY/.test(file.text))
      .map((file) => file.path);
    expect(readers).toHaveLength(1);
    expect(readers[0]!.endsWith(DRAIN_JOB)).toBe(true);
  });
});

describe('nothing reachable from a browser can send mail', () => {
  /**
   * A `'use server'` file is reachable from the browser by design. One that
   * could drain the outbox would let anyone trigger Studdy's mail.
   */
  it('never drains the outbox from a server action', () => {
    const offenders = files.filter(
      (file) =>
        /^['"]use server['"]/m.test(file.text) &&
        /runOutboxDrain|claimNotificationWork|recordDeliverySent/.test(file.text),
    );
    expect(offenders.map((file) => file.path)).toEqual([]);
  });

  it('never drains the outbox from a client component', () => {
    const offenders = files.filter(
      (file) => /^['"]use client['"]/m.test(file.text) && /runOutboxDrain/.test(file.text),
    );
    expect(offenders.map((file) => file.path)).toEqual([]);
  });

  /**
   * TWO CALLERS, AND BOTH ARE AUTHENTICATED. The scheduled function, which
   * Inngest signs; and the manual job route, which carries the shared secret —
   * the same pair, and the same shapes, as the expiry sweep.
   *
   * The route exists because Inngest does not run in CI, so without it an
   * end-to-end test can only assert that nothing happened, and an operator
   * cannot push a stuck batch without waiting for the next tick.
   *
   * Widening this list is only safe while the second assertion holds: a caller
   * that does not check `CRON_SECRET` with a timing-safe comparison fails here,
   * so an unguarded route cannot be added by editing this array alone.
   */
  it('calls the drain from the scheduled function and the guarded job route alone', () => {
    const callers = files
      .filter((file) => /runOutboxDrain\s*[(,)]/.test(file.text))
      .map((file) => file.path)
      .filter((path) => !path.endsWith(DRAIN_JOB));

    const scheduled = join('inngest', 'functions', 'drain-outbox.ts');
    const jobRoute = join('app', 'api', 'jobs', 'drain-outbox', 'route.ts');

    expect(callers).toHaveLength(2);
    expect(callers.some((path) => path.endsWith(scheduled))).toBe(true);
    expect(callers.some((path) => path.endsWith(jobRoute))).toBe(true);
  });

  /**
   * The route half of the pair above, proved rather than trusted. A drain door
   * that forgot its secret would be a way for anyone to make Studdy send mail.
   */
  it('guards the manual drain route with the shared secret', () => {
    const jobRoute = join('app', 'api', 'jobs', 'drain-outbox', 'route.ts');
    const route = files.find((file) => file.path.endsWith(jobRoute));
    expect(route).toBeDefined();
    expect(/process\.env\.CRON_SECRET/.test(route!.text)).toBe(true);
    expect(/timingSafeEqual/.test(route!.text)).toBe(true);
    // A secret in a query string lands in access logs and referrer headers.
    expect(/searchParams|nextUrl\.query/.test(route!.text)).toBe(false);
    // GET must not send mail.
    expect(/method_not_allowed/.test(route!.text)).toBe(true);
  });

  /** The drain is server-only by construction. */
  it('marks the drain job server-only', () => {
    const drain = files.find((file) => file.path.endsWith(DRAIN_JOB));
    expect(drain).toBeDefined();
    expect(/^import 'server-only';/m.test(drain!.text)).toBe(true);
  });
});

describe('email links are built from configuration', () => {
  const drain = files.find((file) => file.path.endsWith(DRAIN_JOB));

  /**
   * NEVER A HOST FROM THE REQUEST. An absolute link built from an attacker's
   * `Host` header is a phishing link carrying Studdy's name, delivered by
   * Studdy.
   */
  it('takes the origin from the environment, not from request headers', () => {
    expect(/NEXT_PUBLIC_SITE_URL/.test(drain!.text)).toBe(true);
    expect(/headers\(\)|x-forwarded-host|request\.headers/.test(drain!.text)).toBe(false);
  });

  it('never reads a host header anywhere in the notification code', () => {
    const notificationFiles = files.filter(
      (file) => /[\\/]notifications[\\/]/.test(file.path) || file.path.endsWith(DRAIN_JOB),
    );
    expect(notificationFiles.length).toBeGreaterThan(0);
    for (const file of notificationFiles) {
      expect(/x-forwarded-host|req\.headers\.host/.test(file.text)).toBe(false);
    }
  });
});

describe('templates cannot reach beyond their context', () => {
  const templates = files.find((file) =>
    file.path.endsWith(join('lib', 'notifications', 'templates.ts')),
  );

  /**
   * The template module takes a resolved work item and a site URL, and touches
   * nothing else — no database client, no environment, no provider. That is
   * what keeps "a template can only render what the context holds" true.
   */
  it('imports no database client, environment or provider SDK', () => {
    expect(templates).toBeDefined();
    expect(/createDatabaseClient|drizzle|from 'postgres'/.test(templates!.text)).toBe(false);
    expect(/process\.env/.test(templates!.text)).toBe(false);
    /*
     * IMPORTS, not vocabulary. The operations alert deliberately NAMES Stripe —
     * an operator who has to refund a payment needs to know where to do it —
     * and that is copy in an internal message, not a dependency. What must not
     * exist is a provider client in a file whose whole job is turning resolved
     * facts into words.
     */
    expect(/from '@studdy\/integrations/.test(templates!.text)).toBe(false);
    expect(/from 'resend'|from 'stripe'/.test(templates!.text)).toBe(false);
  });

  /** And the customer templates never name a provider at all. */
  it('mentions the provider only in the operations alert', () => {
    const opsSection = templates!.text.slice(templates!.text.indexOf('paymentRefundRequiredOps'));
    const customerSection = templates!.text.slice(
      0,
      templates!.text.indexOf('paymentRefundRequiredOps'),
    );
    expect(/stripe/i.test(customerSection)).toBe(false);
    expect(/Stripe/.test(opsSection)).toBe(true);
  });

  /** And renders no provider identifier, even as a string literal. */
  it('names no provider identifier', () => {
    for (const token of [
      'providerPaymentIntentId',
      'providerChargeId',
      'providerAccountId',
      'providerCostMinor',
      'clientSecret',
      'idempotencyKey',
    ]) {
      expect(templates!.text).not.toContain(token);
    }
  });
});

describe('the operations address is configured, never a customer', () => {
  const drain = files.find((file) => file.path.endsWith(DRAIN_JOB));

  it('comes from the environment', () => {
    expect(/STUDDY_OPS_EMAIL/.test(drain!.text)).toBe(true);
  });

  /** No real-looking address is hardcoded anywhere in the notification code. */
  it('hardcodes no deliverable address', () => {
    const notificationFiles = files.filter(
      (file) => /[\\/]notifications[\\/]/.test(file.path) || file.path.endsWith(DRAIN_JOB),
    );
    for (const file of notificationFiles) {
      const addresses = file.text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? [];
      for (const address of addresses) {
        // Only the non-deliverable local placeholder is allowed.
        expect(address).toMatch(/\.test$|\.example$|\.invalid$/);
      }
    }
  });
});
