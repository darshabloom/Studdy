import { describe, expect, it, vi } from 'vitest';
import { DRAIN_OUTBOX_CRON, DRAIN_OUTBOX_FUNCTION_ID, drainOutboxRun } from './drain-outbox';
import type { OutboxDrainOutcome } from '@/lib/jobs/drain-outbox';

/**
 * The drain's wiring, without a database and without a provider.
 *
 * NARROW ON PURPOSE, exactly like the two scheduled functions beside it: that
 * the function DELEGATES rather than reimplementing delivery, and that its
 * cadence is a decision rather than an accident. What actually gets sent, to
 * whom, and what happens when one recipient fails is proved against a real
 * database in `notifications.integration.test.ts` — through the same command
 * this function calls.
 */

const OUTCOME: OutboxDrainOutcome = {
  correlationId: 'cor_test',
  entriesExamined: 3,
  deliveriesPlanned: 4,
  deliveriesSent: 4,
  deliveriesFailed: 0,
  entriesSettled: 3,
  entriesUnresolvable: 0,
  deliveriesExhausted: 0,
  durationMs: 12,
};

describe('the scheduled outbox drain', () => {
  it('calls the existing command rather than delivering anything itself', async () => {
    const runner = vi.fn<() => Promise<OutboxDrainOutcome>>().mockResolvedValue(OUTCOME);

    const result = await drainOutboxRun(runner);

    expect(runner).toHaveBeenCalledTimes(1);
    expect(result).toEqual(OUTCOME);
  });

  /** A quiet run is the expected run; nothing to send is not a failure. */
  it('reports a run that found nothing, rather than treating it as a failure', async () => {
    const quiet: OutboxDrainOutcome = {
      correlationId: 'cor_quiet',
      entriesExamined: 0,
      deliveriesPlanned: 0,
      deliveriesSent: 0,
      deliveriesFailed: 0,
      entriesSettled: 0,
      entriesUnresolvable: 0,
      deliveriesExhausted: 0,
      durationMs: 2,
    };
    const runner = vi.fn<() => Promise<OutboxDrainOutcome>>().mockResolvedValue(quiet);
    await expect(drainOutboxRun(runner)).resolves.toEqual(quiet);
  });

  /**
   * A partly failed batch still RESOLVES. The failures are per-recipient and
   * already recorded on their own rows; throwing here would make Inngest retry
   * a batch whose successful sends are done, which is the opposite of what the
   * per-delivery state is for.
   */
  it('resolves when some deliveries failed, rather than throwing', async () => {
    const partial: OutboxDrainOutcome = { ...OUTCOME, deliveriesSent: 3, deliveriesFailed: 1 };
    const runner = vi.fn<() => Promise<OutboxDrainOutcome>>().mockResolvedValue(partial);
    await expect(drainOutboxRun(runner)).resolves.toEqual(partial);
  });

  it('is safe to invoke repeatedly', async () => {
    const runner = vi.fn<() => Promise<OutboxDrainOutcome>>().mockResolvedValue(OUTCOME);
    await Promise.all([drainOutboxRun(runner), drainOutboxRun(runner), drainOutboxRun(runner)]);
    expect(runner).toHaveBeenCalledTimes(3);
  });

  /** An infrastructure failure must propagate so Inngest retries the drain. */
  it('lets a failure escape so the scheduler can retry it', async () => {
    const runner = vi
      .fn<() => Promise<OutboxDrainOutcome>>()
      .mockRejectedValue(new Error('database unreachable'));
    await expect(drainOutboxRun(runner)).rejects.toThrow('database unreachable');
  });
});

describe('the cadence', () => {
  /**
   * AN OPERATIONAL CADENCE, NOT A PRODUCT PROMISE. Nothing Studdy tells anyone
   * depends on this number — no deadline moves and no window opens because of
   * it. A minute is chosen because `payment.required` starts a sixty-minute
   * window and a five-minute wait would spend a tenth of it.
   */
  it('runs once a minute', () => {
    expect(DRAIN_OUTBOX_CRON).toBe('* * * * *');
  });

  it('has a stable function id, which is how Inngest tracks the schedule', () => {
    expect(DRAIN_OUTBOX_FUNCTION_ID).toBe('drain-transactional-outbox');
  });

  /** The cadence lives in transport, never in the domain or in rule settings. */
  it('keeps the cadence out of the domain', async () => {
    const domain: Record<string, unknown> = await import('@studdy/domain/notifications');
    const names = Object.keys(domain).join(' ');
    expect(names).not.toMatch(/cron|interval|cadence/i);
  });
});
