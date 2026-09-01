import { describe, expect, it, vi } from 'vitest';
import {
  RECONCILE_PAYMENTS_CRON,
  RECONCILE_PAYMENTS_FUNCTION_ID,
  reconcilePaymentsRun,
} from './reconcile-payments';
import type { ReconciliationOutcome } from '@/lib/jobs/reconcile-payments';

/**
 * The reconciler's wiring, without Stripe and without a database.
 *
 * NARROW ON PURPOSE, exactly like the expiry function's test beside it: that
 * the scheduled function DELEGATES rather than reimplementing fulfilment, and
 * that its cadence is a decision rather than an accident. What gets fulfilled,
 * and what must not be, is proved against a real database in
 * `payment-fulfilment.integration.test.ts` — through the very same command this
 * function calls.
 */

const OUTCOME: ReconciliationOutcome = { examined: 3, resolved: 1, unreadable: 0 };

describe('the scheduled reconciliation function', () => {
  it('calls the existing command rather than reconciling anything itself', async () => {
    const runner = vi.fn<() => Promise<ReconciliationOutcome>>().mockResolvedValue(OUTCOME);

    const result = await reconcilePaymentsRun(runner);

    expect(runner).toHaveBeenCalledTimes(1);
    expect(result).toEqual(OUTCOME);
  });

  /**
   * A quiet run is the expected run. Webhook delivery is the normal path, so
   * finding nothing to reconcile is the healthy outcome and must not read as a
   * failure.
   */
  it('reports a run that found nothing, rather than treating it as a failure', async () => {
    const quiet: ReconciliationOutcome = { examined: 0, resolved: 0, unreadable: 0 };
    const runner = vi.fn<() => Promise<ReconciliationOutcome>>().mockResolvedValue(quiet);
    await expect(reconcilePaymentsRun(runner)).resolves.toEqual(quiet);
  });

  /** Safe to invoke repeatedly: it holds no state between runs. */
  it('is safe to invoke repeatedly', async () => {
    const runner = vi.fn<() => Promise<ReconciliationOutcome>>().mockResolvedValue(OUTCOME);
    await Promise.all([
      reconcilePaymentsRun(runner),
      reconcilePaymentsRun(runner),
      reconcilePaymentsRun(runner),
    ]);
    expect(runner).toHaveBeenCalledTimes(3);
  });

  /** A failure must propagate so Inngest retries rather than losing the sweep. */
  it('lets a failure escape so the scheduler can retry it', async () => {
    const runner = vi
      .fn<() => Promise<ReconciliationOutcome>>()
      .mockRejectedValue(new Error('stripe unreachable'));
    await expect(reconcilePaymentsRun(runner)).rejects.toThrow('stripe unreachable');
  });
});

describe('the cadence', () => {
  /**
   * Every fifteen minutes, and slower than the expiry sweep on purpose. This is
   * a safety net rather than a path: a payment stuck `processing` is already
   * protected from expiry, so nothing is lost by finding it a few minutes
   * later — and polling Stripe every minute for an event that essentially
   * always arrives would spend a rate limit on nothing.
   */
  it('runs every fifteen minutes', () => {
    expect(RECONCILE_PAYMENTS_CRON).toBe('*/15 * * * *');
  });

  /**
   * AN OPERATIONAL POLLING INTERVAL, NOT A BUSINESS RULE.
   *
   * The cadence lives in the transport layer beside the expiry schedule, and
   * nothing derives a deadline, an entitlement, a window or a refund from it.
   * This asserts the shape that keeps it that way: the number is exported from
   * the Inngest function, not from `@studdy/domain` and not from
   * `rule_settings`, so changing it cannot move a customer-visible promise.
   */
  it('keeps the cadence out of the domain and out of rule settings', async () => {
    const domain: Record<string, unknown> = await import('@studdy/domain/payments');
    const names = Object.keys(domain).join(' ');
    expect(names).not.toMatch(/reconcil/i);
    expect(names).not.toMatch(/pollInterval|cron/i);
  });

  it('has a stable function id, which is how Inngest tracks the schedule', () => {
    expect(RECONCILE_PAYMENTS_FUNCTION_ID).toBe('reconcile-in-flight-payments');
  });
});
