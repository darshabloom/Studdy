import { describe, expect, it, vi } from 'vitest';
import {
  SETTLE_REFUNDS_CRON,
  SETTLE_REFUNDS_FUNCTION_ID,
  settleRefundsRun,
} from './settle-refunds';
import type { RefundSweepOutcome } from '@/lib/jobs/refunds';

/**
 * The refund sweep's wiring, without Stripe and without a database.
 *
 * NARROW ON PURPOSE, like its neighbours: that the scheduled function DELEGATES
 * rather than refunding anything itself, and that it can never be the thing that
 * starts a refund. What is refunded, and what must not be, is proved in
 * `refunds.test.ts` and against a real database in
 * `refunds.integration.test.ts`.
 */

const OUTCOME: RefundSweepOutcome = { examined: 2, settled: 1, stillPending: 1, unreadable: 0 };

describe('the scheduled refund sweep', () => {
  it('calls the existing command rather than refunding anything itself', async () => {
    const runner = vi.fn<() => Promise<RefundSweepOutcome>>().mockResolvedValue(OUTCOME);
    expect(await settleRefundsRun(runner)).toEqual(OUTCOME);
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it('reports a run that found nothing as an ordinary outcome', async () => {
    const quiet: RefundSweepOutcome = { examined: 0, settled: 0, stillPending: 0, unreadable: 0 };
    const runner = vi.fn<() => Promise<RefundSweepOutcome>>().mockResolvedValue(quiet);
    await expect(settleRefundsRun(runner)).resolves.toEqual(quiet);
  });

  it('is safe to invoke repeatedly', async () => {
    const runner = vi.fn<() => Promise<RefundSweepOutcome>>().mockResolvedValue(OUTCOME);
    await Promise.all([settleRefundsRun(runner), settleRefundsRun(runner)]);
    expect(runner).toHaveBeenCalledTimes(2);
  });

  /** A failure must propagate so Inngest retries rather than losing the sweep. */
  it('lets a failure escape so the scheduler can retry it', async () => {
    const runner = vi.fn<() => Promise<RefundSweepOutcome>>().mockRejectedValue(new Error('down'));
    await expect(settleRefundsRun(runner)).rejects.toThrow('down');
  });
});

describe('the cadence', () => {
  /** Every five minutes: a family is waiting on money, and an empty pass is one query. */
  it('runs every five minutes', () => {
    expect(SETTLE_REFUNDS_CRON).toBe('*/5 * * * *');
  });

  it('has a stable function id, because the scheduler keys on it', () => {
    expect(SETTLE_REFUNDS_FUNCTION_ID).toBe('settle-open-refunds');
  });
});
