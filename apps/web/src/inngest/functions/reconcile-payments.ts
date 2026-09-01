import {
  runPaymentReconciliation,
  type ReconciliationOutcome,
} from '@/lib/jobs/reconcile-payments';
import { inngest } from '../client';

/**
 * The reconciliation sweep — a webhook Stripe never delivered, found by asking.
 *
 * FIFTEEN MINUTES IS AN OPERATIONAL POLLING INTERVAL, NOT A BUSINESS RULE, and
 * the distinction matters enough to state: no deadline, entitlement, window or
 * refund follows from this number. Studdy's rules live in `@studdy/domain` and
 * in versioned `rule_settings`; this is neither, and changing it changes only
 * how soon an undelivered webhook is noticed. It could be five minutes or
 * thirty without any customer-visible promise moving.
 *
 * WHY FIFTEEN, THEN. This is a safety net, not a path. Webhook delivery is the
 * normal route and arrives in seconds; the only thing this catches is a delivery
 * that never happened at all, and a payment stuck `processing` is already
 * protected from the expiry sweep, so nothing is lost by finding it a few
 * minutes later. Polling Stripe every minute for an event that essentially
 * always arrives would spend a rate limit on nothing.
 *
 * IT OWNS NO RULES, exactly like the expiry function beside it. It calls
 * `runPaymentReconciliation`, which re-reads Stripe and hands the result to the
 * same `applyPaymentProviderEvent` the webhook uses. Every guard, every
 * transaction and every idempotency constraint is the same code — this changes
 * only who asked.
 */

/** Standard five-field cron. */
export const RECONCILE_PAYMENTS_CRON = '*/15 * * * *';

export const RECONCILE_PAYMENTS_FUNCTION_ID = 'reconcile-in-flight-payments';

/**
 * The body of the scheduled run, separated from `createFunction` so it can be
 * tested without mounting Inngest, and injectable for the same reason the
 * expiry function's is: a test proves the wiring calls the existing command
 * rather than reimplementing reconciliation.
 */
export async function reconcilePaymentsRun(
  runner: () => Promise<ReconciliationOutcome> = runPaymentReconciliation,
): Promise<ReconciliationOutcome> {
  return runner();
}

export const reconcilePaymentsScheduled = inngest.createFunction(
  {
    id: RECONCILE_PAYMENTS_FUNCTION_ID,
    name: 'Reconcile payments whose confirmation never arrived',
    triggers: [{ cron: RECONCILE_PAYMENTS_CRON }],
    /*
     * One run at a time. Overlapping runs are already safe — every write is
     * status-guarded and the synthetic event id is unique per intent and status
     * — but two runs asking Stripe the same questions simultaneously would
     * spend rate limit to reach the identical answer.
     */
    concurrency: { limit: 1 },
  },
  async () => reconcilePaymentsRun(),
);
