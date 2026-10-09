import { randomUUID } from 'node:crypto';
import {
  beginRefund,
  recordRefundOutcome,
  refundReport,
  unsettledRefunds,
  type RefundOutcome,
  type RefundReport,
} from '@studdy/database';
import type { RefundRefusal } from '@studdy/domain/payments';
import {
  classifyRefundError,
  createRefund,
  findRefundByStuddyId,
  retrieveRefund,
  stripeClient,
  type StripeRefundSnapshot,
} from '@studdy/integrations/payments/stripe';
import { createLogger } from '@studdy/observability';

/**
 * Refund execution — the job that gives a parent's money back.
 *
 * NEITHER SILENT NOR AUTOMATIC. A person decides to refund a payment, and calls
 * `executeRefund` for it (today through `POST /api/jobs/refunds`, later from the
 * admin tooling). The sweep below does NOT start refunds; it only finishes the
 * ones a person already started, so a crash between "Stripe accepted it" and
 * "Studdy recorded it" cannot leave a refund in limbo.
 *
 * THE PROVIDER IS NEVER CALLED INSIDE A DATABASE TRANSACTION. The intent is
 * committed first (`beginRefund`), Stripe is called with that row's idempotency
 * key, and the answer is recorded in a second transaction
 * (`recordRefundOutcome`). If anything dies in between, the `requested` row is
 * what the sweep resumes from.
 *
 * LOGS CARRY COUNTS AND CORRELATION IDS ONLY, as everywhere else: never a
 * payment reference, an amount, a person or a provider id.
 */

const logger = createLogger({ job: 'refunds' });

export type ExecuteRefundResult =
  /** Stripe accepted it and money is on its way (`settled: false`) or already back. */
  | {
      readonly result: 'refunded';
      readonly refundReference: string;
      readonly amountMinor: string;
      readonly currencyCode: string;
      readonly settled: boolean;
    }
  /** Stripe definitively refused. The family's money is STILL HELD; ops is alerted. */
  | {
      readonly result: 'failed';
      readonly refundReference: string;
      readonly failureCode: string | null;
    }
  /** Stripe could not be reached. The sweep will finish it; nothing is lost. */
  | { readonly result: 'deferred'; readonly refundReference: string }
  /** Studdy declined to start one, for a reason an operator can act on. */
  | { readonly result: 'refused'; readonly refusal: RefundRefusal };

/** What the provider step produced, before it is dressed for a caller. */
type ProviderStep =
  | {
      readonly kind: 'recorded';
      readonly outcome: RefundOutcome;
      readonly snapshot: StripeRefundSnapshot;
    }
  | { readonly kind: 'refused_by_provider'; readonly failureCode: string | null }
  | { readonly kind: 'unreachable' };

interface RefundCall {
  readonly refundId: string;
  readonly paymentId: string;
  readonly providerPaymentIntentId: string;
  readonly amountMinor: bigint;
  readonly idempotencyKey: string;
}

/**
 * Ask Stripe, then record the answer. Shared by a fresh refund and a resumed
 * one, so the two cannot drift apart.
 *
 * A RESUMED refund first asks Stripe what it already holds. The original attempt
 * may have reached Stripe after all, and an idempotency key only protects
 * against that for a day; adopting the refund Stripe already made is the only
 * way a long-stuck row cannot become a second refund.
 */
async function askProviderAndRecord(
  call: RefundCall,
  correlationId: string,
  mode: 'create' | 'resume',
): Promise<ProviderStep> {
  let snapshot: StripeRefundSnapshot | null = null;
  try {
    const stripe = stripeClient(process.env.STRIPE_SECRET_KEY);
    if (mode === 'resume') {
      snapshot = await findRefundByStuddyId(stripe, call.providerPaymentIntentId, call.refundId);
    }
    snapshot ??= await createRefund(stripe, {
      providerPaymentIntentId: call.providerPaymentIntentId,
      amountMinor: call.amountMinor,
      idempotencyKey: call.idempotencyKey,
      studdyRefundId: call.refundId,
      studdyPaymentId: call.paymentId,
    });
  } catch (error) {
    const { definitive, code } = classifyRefundError(error);
    if (!definitive) {
      // Could not get an answer. Leave the intent as it is; the sweep will ask.
      logger.warn('refund provider call deferred', { correlationId });
      return { kind: 'unreachable' };
    }
    await recordRefundOutcome({
      refundId: call.refundId,
      providerStatus: 'failed',
      providerRefundId: null,
      failureCode: code,
      correlationId,
    });
    logger.error('refund refused by provider', { correlationId });
    return { kind: 'refused_by_provider', failureCode: code };
  }

  const outcome = await recordRefundOutcome({
    refundId: call.refundId,
    providerStatus: snapshot.providerStatus,
    providerRefundId: snapshot.providerRefundId,
    failureCode: snapshot.failureReason,
    correlationId,
  });
  return { kind: 'recorded', outcome, snapshot };
}

/**
 * Refund one payment, on purpose.
 *
 * `beginRefund` decides whether it is allowed — the payment succeeded, it was
 * flagged, no booking exists, nothing is already in flight or done — and this
 * either returns the reason it refused or carries the refund through.
 */
export async function executeRefund(
  paymentReference: string,
  correlationId: string = randomUUID(),
): Promise<ExecuteRefundResult> {
  const started = await beginRefund({
    paymentReference,
    reasonCode: 'booking_not_confirmed',
    correlationId,
  });
  if (started.status === 'refused') {
    logger.info('refund refused', { correlationId, refusal: started.refusal });
    return { result: 'refused', refusal: started.refusal };
  }

  const { refund } = started;
  logger.info('refund started', { correlationId });
  const step = await askProviderAndRecord(refund, correlationId, 'create');

  if (step.kind === 'unreachable') {
    return { result: 'deferred', refundReference: refund.reference };
  }
  if (step.kind === 'refused_by_provider') {
    return {
      result: 'failed',
      refundReference: refund.reference,
      failureCode: step.failureCode,
    };
  }
  if (step.outcome === 'failed') {
    return {
      result: 'failed',
      refundReference: refund.reference,
      failureCode: step.snapshot.failureReason,
    };
  }
  return {
    result: 'refunded',
    refundReference: refund.reference,
    amountMinor: refund.amountMinor.toString(),
    currencyCode: refund.currencyCode,
    settled: step.outcome === 'succeeded',
  };
}

export interface RefundSweepOutcome {
  readonly examined: number;
  readonly settled: number;
  readonly stillPending: number;
  readonly unreadable: number;
}

/**
 * Finish the refunds a person already started.
 *
 * `requested` rows older than the grace period are resumed (adopt Stripe's
 * refund if it exists, otherwise create it under the same key); `pending` rows
 * are read back from Stripe until they settle. IT NEVER STARTS A REFUND.
 */
export async function settleOpenRefunds(
  correlationId: string = randomUUID(),
): Promise<RefundSweepOutcome> {
  const open = await unsettledRefunds({ limit: 50 });
  if (open.length === 0) return { examined: 0, settled: 0, stillPending: 0, unreadable: 0 };

  let settled = 0;
  let stillPending = 0;
  let unreadable = 0;

  for (const row of open) {
    try {
      let outcome: RefundOutcome;

      if (row.statusCode === 'pending' && row.providerRefundId !== null) {
        const stripe = stripeClient(process.env.STRIPE_SECRET_KEY);
        const snapshot = await retrieveRefund(stripe, row.providerRefundId);
        outcome = await recordRefundOutcome({
          refundId: row.refundId,
          providerStatus: snapshot.providerStatus,
          providerRefundId: snapshot.providerRefundId,
          failureCode: snapshot.failureReason,
          correlationId,
        });
      } else {
        const step = await askProviderAndRecord(row, correlationId, 'resume');
        if (step.kind === 'unreachable') {
          unreadable += 1;
          continue;
        }
        outcome = step.kind === 'refused_by_provider' ? 'failed' : step.outcome;
      }

      if (outcome === 'succeeded' || outcome === 'failed') settled += 1;
      else stillPending += 1;
    } catch {
      unreadable += 1;
    }
  }

  if (unreadable > 0) {
    logger.error('refund sweep could not resolve some refunds', {
      correlationId,
      examined: open.length,
      settled,
      stillPending,
      unreadable,
    });
  } else {
    logger.info('refund sweep complete', {
      correlationId,
      examined: open.length,
      settled,
      stillPending,
    });
  }
  return { examined: open.length, settled, stillPending, unreadable };
}

/** For operators: what is waiting for a decision, and where refunds stand. */
export async function reportRefunds(): Promise<RefundReport> {
  return refundReport();
}
