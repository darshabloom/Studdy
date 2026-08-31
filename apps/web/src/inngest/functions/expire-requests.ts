import { runExpirySweep, type ExpirySweepOutcome } from '@/lib/jobs/expire-requests';
import { inngest } from '../client';

/**
 * Automatic expiry of overdue requests and lapsed payment windows.
 *
 * WHY EVERY MINUTE. The payment window is sixty minutes and the tutor is told
 * when their hold ends, so the sweep's period is the error bar on that promise:
 * at five minutes a family could be told 5:00 and the slot sit held until 5:05,
 * which is a small lie told to a tutor about their own calendar. A minute is
 * short enough that the deadline on screen is the deadline in practice, and the
 * sweep is a single batched transaction that finds nothing to do on almost
 * every run.
 *
 * Vercel's Hobby plan allows a once-DAILY cron, which is why this is not a
 * Vercel cron: request deadlines are measured in hours and payment windows in
 * minutes, and a daily sweep would leave a one-hour deadline unexpired for most
 * of a day. The schedule was removed from `vercel.json` rather than slowed to
 * fit, and Inngest replaces it. There is ONE production scheduler.
 *
 * IT OWNS NO RULES. The handler calls `runExpirySweep`, which calls
 * `expireOverdueRequests`. What is overdue, what closes, which holds are
 * released and which selections are protected all live in the repository, are
 * covered by integration tests that never mention a scheduler, and would behave
 * identically if a human called the manual route instead.
 */

/** Standard five-field cron. Inngest documents no minimum interval above this. */
export const EXPIRE_REQUESTS_CRON = '* * * * *';

export const EXPIRE_REQUESTS_FUNCTION_ID = 'expire-overdue-requests';

/**
 * The body of the scheduled run, separated from `createFunction` so it can be
 * tested without mounting Inngest or standing up its dev server.
 *
 * The runner is injectable for the same reason, and defaults to the real one —
 * a test proves the wiring calls the existing command rather than reimplementing
 * expiry, which is the property this whole slice turns on.
 */
export async function expireRequestsRun(
  runner: (correlationId?: string) => Promise<ExpirySweepOutcome> = runExpirySweep,
): Promise<ExpirySweepOutcome> {
  return runner();
}

/*
 * `createFunction(options, handler)` — the trigger lives INSIDE the options in
 * the v4 SDK, where v3 took it as a third argument.
 */
export const expireRequestsScheduled = inngest.createFunction(
  {
    id: EXPIRE_REQUESTS_FUNCTION_ID,
    name: 'Expire overdue requests and lapsed payment windows',
    triggers: [{ cron: EXPIRE_REQUESTS_CRON }],
    /*
     * One run at a time. Belt and braces: overlapping runs are ALREADY safe,
     * because the sweep selects due rows `FOR UPDATE SKIP LOCKED` inside one
     * transaction and every UPDATE is status-guarded, so a second run finds
     * nothing rather than double-releasing anything. This simply stops a slow
     * run and its successor competing for the same rows every sixty seconds.
     */
    concurrency: { limit: 1 },
  },
  async () => expireRequestsRun(),
);
