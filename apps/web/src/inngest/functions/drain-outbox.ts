import { runOutboxDrain, type OutboxDrainOutcome } from '@/lib/jobs/drain-outbox';
import { inngest } from '../client';

/**
 * Draining the transactional outbox.
 *
 * ONE MINUTE IS AN OPERATIONAL CADENCE, NOT A PRODUCT PROMISE. Nothing Studdy
 * tells anyone depends on this number: no deadline moves, no entitlement
 * changes, and no window opens or closes because of it. It decides only how
 * soon after a booking the email lands, and it could be thirty seconds or five
 * minutes without a single rule changing. Studdy's rules live in
 * `@studdy/domain` and in versioned `rule_settings`; this is neither.
 *
 * WHY A MINUTE, THEN. `payment.required` starts a sixty-minute window, and a
 * family who has to wait five minutes for the email has lost the better part of
 * a tenth of their time to pay. A minute keeps the email close enough to the
 * action that it reads as a consequence of it.
 *
 * IT OWNS NO RULES, exactly like the two functions beside it. It calls
 * `runOutboxDrain`, which claims a bounded batch, sends each recipient's
 * message independently and settles an entry only when every recipient has been
 * reached. Who is owed what is the domain's; the facts are the repository's.
 */

/** Standard five-field cron. */
export const DRAIN_OUTBOX_CRON = '* * * * *';

export const DRAIN_OUTBOX_FUNCTION_ID = 'drain-transactional-outbox';

/**
 * The body of the scheduled run, separated from `createFunction` so it can be
 * tested without mounting Inngest, and injectable for the same reason the other
 * two are: a test proves the wiring calls the existing command rather than
 * reimplementing delivery.
 */
export async function drainOutboxRun(
  runner: () => Promise<OutboxDrainOutcome> = runOutboxDrain,
): Promise<OutboxDrainOutcome> {
  return runner();
}

export const drainOutboxScheduled = inngest.createFunction(
  {
    id: DRAIN_OUTBOX_FUNCTION_ID,
    name: 'Drain the transactional outbox',
    triggers: [{ cron: DRAIN_OUTBOX_CRON }],
    /*
     * One run at a time. Overlapping runs are ALREADY safe — entries are
     * claimed `FOR UPDATE SKIP LOCKED`, delivery rows are unique per
     * (entry, recipient), and the provider honours the idempotency key — but
     * two drains competing for the same batch every sixty seconds would spend
     * database and provider quota to reach the identical result.
     */
    concurrency: { limit: 1 },
  },
  async () => drainOutboxRun(),
);
