import { randomUUID } from 'node:crypto';
import { applyPaymentProviderEvent, paymentsAwaitingReconciliation } from '@studdy/database';
import {
  retrieveAuthoritativePaymentIntent,
  STRIPE_PROVIDER,
  stripeClient,
} from '@studdy/integrations/payments/stripe';
import { createLogger } from '@studdy/observability';

/**
 * Reconciliation — the safety net for a webhook that never arrived.
 *
 * WHY THIS EXISTS, AND WHY IT IS IN THIS SLICE RATHER THAN A LATER ONE. Slice 5
 * taught the expiry sweep to skip any request whose payment is `processing` or
 * `succeeded`, which is exactly right while a confirmation is in flight. This
 * slice is the first that can WRITE `processing` — and the two together open a
 * hole neither had alone: a payment that reaches `processing` and whose webhook
 * is never delivered is invisible to the sweep, so the tutor's calendar would
 * stay blocked on a lesson nobody is coming back to confirm.
 *
 * The fix is not to weaken the guard — the guard protects real money. It is to
 * make sure `processing` always resolves. This asks Stripe.
 *
 * FOUR PROPERTIES THIS MUST HAVE, and each is a deliberate choice here:
 *
 *   1. **No payment is protected indefinitely by accident.** `processing` is the
 *      one status the expiry sweep will never release, so something has to be
 *      responsible for ending it. That is this function's entire job, and it
 *      runs whether or not a webhook is expected.
 *   2. **No tutor transfer unless fulfilment legitimately succeeds.** Nothing
 *      here writes a transfer. It calls `applyPaymentProviderEvent`, which
 *      creates the obligation only inside the transaction that also fulfils the
 *      ILR and confirms the reservation — so a late success reconciled after the
 *      sweep produces a refund flag and NO obligation, exactly as a late webhook
 *      would.
 *   3. **A provider or API failure leaves state retryable, never fabricated.**
 *      Every payment is reconciled inside its own try/catch: one unreachable
 *      Stripe call records a failure and the loop continues, so a single bad row
 *      cannot starve every other stuck payment. Nothing is ever written from a
 *      failed read — the payment simply stays `processing` and the next run asks
 *      again. There is no branch in which not knowing becomes success.
 *   4. **Fifteen minutes is an OPERATIONAL POLLING INTERVAL, not a business
 *      rule.** It lives in the Inngest function beside this one, in the
 *      transport layer, with the expiry cadence. No deadline, entitlement or
 *      window is derived from it; changing it changes only how soon an
 *      undelivered webhook is noticed. Business rules live in
 *      `@studdy/domain` and in `rule_settings`, versioned — this is neither.
 *
 * IT OWNS NO RULES. It re-reads the authoritative PaymentIntent and hands it to
 * the SAME `applyPaymentProviderEvent` the webhook uses, so a reconciled success
 * and a delivered success take one code path and one set of guards. The
 * synthetic event id is derived from the intent and its status, so re-running
 * reconciliation is idempotent through the same unique constraint that absorbs
 * Stripe's own retries — and so a reconciler racing a webhook loses on the
 * payment row's `FOR UPDATE` rather than double-applying.
 */

const logger = createLogger({ job: 'reconcile-payments' });

export interface ReconciliationOutcome {
  /** Payments found in `processing`. */
  readonly examined: number;
  /** Payments this run moved out of `processing`. */
  readonly resolved: number;
  /**
   * Payments this run could not read from the provider.
   *
   * Reported rather than thrown: these are the ones still protected, and a run
   * that quietly returned zero for them would hide exactly the situation the
   * safety net exists to surface.
   */
  readonly unreadable: number;
}

/**
 * Stripe statuses that mean the intent has stopped being in flight.
 *
 * Anything else — `processing`, `requires_action`, `requires_confirmation` — is
 * genuinely still in flight and is left alone. Reconciliation reports what the
 * provider says; it never decides that waiting has gone on long enough.
 */
const TERMINAL_INTENT_STATUS: Record<string, string> = {
  succeeded: 'payment_intent.succeeded',
  canceled: 'payment_intent.canceled',
  requires_payment_method: 'payment_intent.payment_failed',
};

export async function runPaymentReconciliation(
  correlationId: string = randomUUID(),
): Promise<ReconciliationOutcome> {
  const stuck = await paymentsAwaitingReconciliation({ limit: 50 });
  if (stuck.length === 0) return { examined: 0, resolved: 0, unreadable: 0 };

  const stripe = stripeClient(process.env.STRIPE_SECRET_KEY);
  let resolved = 0;
  let unreadable = 0;

  for (const row of stuck) {
    try {
      const authoritative = await retrieveAuthoritativePaymentIntent(
        stripe,
        row.providerPaymentIntentId,
      );
      const eventType = TERMINAL_INTENT_STATUS[authoritative.status];
      // Still genuinely in flight. Leave it; the next run asks again.
      if (eventType === undefined) continue;

      const outcome = await applyPaymentProviderEvent({
        provider: STRIPE_PROVIDER,
        providerEventId: `reconcile:${authoritative.providerPaymentIntentId}:${authoritative.status}`,
        eventType,
        redactedPayload: {
          providerPaymentIntentId: authoritative.providerPaymentIntentId,
          status: authoritative.status,
          amountReceivedMinor: authoritative.amountReceivedMinor.toString(),
          currencyCode: authoritative.currencyCode,
          source: 'reconciliation',
        },
        authoritative: {
          providerPaymentIntentId: authoritative.providerPaymentIntentId,
          status: authoritative.status,
          livemode: authoritative.livemode,
          amountReceivedMinor: authoritative.amountReceivedMinor,
          currencyCode: authoritative.currencyCode,
          chargeId: authoritative.chargeId,
          balanceTransactionId: authoritative.balanceTransactionId,
          providerCostMinor: authoritative.providerCostMinor,
          lastFailureCode: authoritative.lastFailureCode,
          studdyPaymentId: authoritative.metadata.paymentId,
        },
        correlationId,
      });
      if (outcome === 'fulfilled' || outcome === 'applied') resolved += 1;
    } catch {
      /*
       * ONE PAYMENT'S FAILURE IS NOT THE RUN'S FAILURE. Stripe being unreachable
       * for one intent must not stop the other forty-nine being resolved, and it
       * must never be turned into an outcome — nothing is written here, so the
       * payment stays `processing` and the next run tries again.
       *
       * No id, no amount: a count is what an operator needs, and the correlation
       * id ties this line to the run.
       */
      unreadable += 1;
    }
  }

  // Counts only, as everywhere else.
  if (unreadable > 0) {
    logger.error('payment reconciliation could not read some payments', {
      examined: stuck.length,
      resolved,
      unreadable,
    });
  } else {
    logger.info('payment reconciliation complete', { examined: stuck.length, resolved });
  }
  return { examined: stuck.length, resolved, unreadable };
}
