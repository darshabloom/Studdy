import { settleOpenRefunds, type RefundSweepOutcome } from '@/lib/jobs/refunds';
import { inngest } from '../client';

/**
 * Finish the refunds a person already started.
 *
 * EVERY FIVE MINUTES, because a family is waiting on money and the cost of a
 * pass that finds nothing is one indexed query. It resumes a refund whose
 * outcome was never recorded and reads pending ones back until they settle.
 *
 * IT NEVER STARTS A REFUND. Starting one is a person's decision, made through
 * the refund route; this function only makes sure a decision already taken is
 * carried to its end.
 */
export const SETTLE_REFUNDS_CRON = '*/5 * * * *';

export const SETTLE_REFUNDS_FUNCTION_ID = 'settle-open-refunds';

/** Separated from the Inngest wrapper so the behaviour is testable without the SDK. */
export async function settleRefundsRun(
  runner: () => Promise<RefundSweepOutcome> = settleOpenRefunds,
): Promise<RefundSweepOutcome> {
  return runner();
}

export const settleRefundsScheduled = inngest.createFunction(
  {
    id: SETTLE_REFUNDS_FUNCTION_ID,
    name: 'Finish refunds that were started',
    triggers: [{ cron: SETTLE_REFUNDS_CRON }],
    concurrency: { limit: 1 },
  },
  async () => settleRefundsRun(),
);
