import { randomUUID } from 'node:crypto';
import {
  recordTransferFailed,
  recordTransferSent,
  requeueFailedTransfer,
  settlementCandidate,
  settlementCandidates,
  type RequeueResult,
  type SettlementCandidate,
} from '@studdy/database';
import {
  settlementTransferGroup,
  sumMinor,
  type SettlementHoldReason,
} from '@studdy/domain/payments';
import {
  classifyStripeError,
  createTransfer,
  findTransferByStuddyId,
  stripeClient,
  type StripeTransferSnapshot,
} from '@studdy/integrations/payments/stripe';
import { createLogger } from '@studdy/observability';

/**
 * Settlement — paying tutors their share.
 *
 * DELIBERATE AND MANUAL, as the approved alpha design says (§5): an operator
 * looks at what is owed, confirms the total they reviewed, and only then are
 * transfers sent. Nothing here runs on a timer. The cadence — which day, who —
 * is an open decision (§15 item 4), and building the mechanism without
 * automating it leaves that decision where it belongs.
 *
 * THE TOTAL YOU REVIEWED IS THE TOTAL THAT IS SENT. `runSettlement` takes the
 * eligible total the operator saw in the report and refuses if what is eligible
 * now differs, so a refund flagged, a booking cancelled or a lesson newly ended
 * between looking and clicking cannot quietly change how much money moves.
 *
 * EACH TRANSFER IS RE-CHECKED IMMEDIATELY BEFORE IT IS SENT, against fresh facts,
 * and the provider is never called inside a database transaction. A lost
 * transfer is found by Studdy's own id in Stripe's metadata before a new one is
 * created, because Stripe only honours an idempotency key for a day and
 * settlement runs weekly.
 *
 * Logs carry counts and a correlation id only — never a reference, an amount, a
 * tutor or a provider id.
 */

const logger = createLogger({ job: 'settlement' });

/** One line of the operator's report. Studdy references and money; no people. */
export interface SettlementLine {
  readonly paymentReference: string;
  readonly tutorReference: string;
  readonly amountMinor: string;
  readonly currencyCode: string;
}

export interface SettlementReport {
  readonly generatedAt: string;
  readonly eligible: readonly (SettlementLine & { readonly lessonEndedAt: string })[];
  /** Per currency, because the run refuses to mix them. */
  readonly eligibleTotals: Readonly<Record<string, string>>;
  readonly held: readonly (SettlementLine & { readonly reason: SettlementHoldReason })[];
  readonly heldByReason: Readonly<Record<string, number>>;
}

function lineOf(candidate: SettlementCandidate): SettlementLine {
  return {
    paymentReference: candidate.paymentReference,
    tutorReference: candidate.tutorReference,
    amountMinor: candidate.amountMinor.toString(),
    currencyCode: candidate.currencyCode,
  };
}

function totalsByCurrency(candidates: readonly SettlementCandidate[]): Record<string, string> {
  const byCurrency = new Map<string, bigint[]>();
  for (const candidate of candidates) {
    const list = byCurrency.get(candidate.currencyCode) ?? [];
    list.push(candidate.amountMinor);
    byCurrency.set(candidate.currencyCode, list);
  }
  return Object.fromEntries(
    [...byCurrency.entries()].map(([currency, amounts]) => [
      currency,
      sumMinor(amounts).toString(),
    ]),
  );
}

/** What is owed, what is held and why. Read-only: it sends nothing. */
export async function reportSettlement(now: Date = new Date()): Promise<SettlementReport> {
  const candidates = await settlementCandidates({ now });
  const eligible = candidates.filter((candidate) => candidate.decision.eligible);
  const held = candidates.flatMap((candidate) =>
    candidate.decision.eligible ? [] : [{ candidate, reason: candidate.decision.reason }],
  );

  const heldByReason: Record<string, number> = {};
  for (const { reason } of held) heldByReason[reason] = (heldByReason[reason] ?? 0) + 1;

  return {
    generatedAt: now.toISOString(),
    eligible: eligible.map((candidate) => ({
      ...lineOf(candidate),
      lessonEndedAt: candidate.lessonEndsAt?.toISOString() ?? '',
    })),
    eligibleTotals: totalsByCurrency(eligible),
    held: held.map(({ candidate, reason }) => ({ ...lineOf(candidate), reason })),
    heldByReason,
  };
}

export type SettlementRunResult =
  /** The eligible total is not the one the operator reviewed. NOTHING WAS SENT. */
  | {
      readonly result: 'total_changed';
      readonly expectedTotalMinor: string;
      readonly eligibleTotalMinor: string;
    }
  /** More than one currency is eligible. Launch is NZD only; NOTHING WAS SENT. */
  | { readonly result: 'mixed_currency'; readonly currencies: readonly string[] }
  | {
      readonly result: 'done';
      readonly attempted: number;
      /** Accepted by Stripe and recorded. */
      readonly sent: number;
      /** Stripe definitively refused. The tutor is owed and unpaid. */
      readonly failed: number;
      /** No answer from Stripe. Still pending; the next run finishes it. */
      readonly deferred: number;
      /** Became ineligible between the report and the send, or already recorded. */
      readonly skipped: number;
      readonly totalSentMinor: string;
      readonly currencyCode: string | null;
    };

type TransferStep =
  | { readonly kind: 'sent'; readonly snapshot: StripeTransferSnapshot }
  | { readonly kind: 'refused'; readonly code: string | null }
  | { readonly kind: 'unanswered' };

/**
 * Send one obligation, or adopt the transfer Stripe already made for it.
 *
 * An adopted or created transfer is checked against what Studdy owes before it
 * is recorded: the amount, the destination and that it has not been reversed. A
 * transfer that does not match is NEVER recorded as the settlement of this
 * obligation — it is treated as unanswered and logged, because recording the
 * wrong money as sent is worse than sending nothing.
 */
async function sendOne(
  stripe: ReturnType<typeof stripeClient>,
  candidate: SettlementCandidate,
  correlationId: string,
): Promise<TransferStep> {
  try {
    const group = settlementTransferGroup(candidate.paymentId);
    const snapshot =
      (await findTransferByStuddyId(stripe, group, candidate.transferId)) ??
      (await createTransfer(stripe, {
        destinationAccountId: candidate.providerAccountId,
        amountMinor: candidate.amountMinor,
        currencyCode: candidate.currencyCode,
        sourceChargeId: candidate.providerChargeId!,
        transferGroup: group,
        idempotencyKey: candidate.idempotencyKey,
        studdyTransferId: candidate.transferId,
        studdyPaymentId: candidate.paymentId,
      }));

    if (
      snapshot.amountMinor !== candidate.amountMinor ||
      snapshot.currencyCode !== candidate.currencyCode ||
      snapshot.destinationAccountId !== candidate.providerAccountId ||
      snapshot.reversed
    ) {
      logger.error('settlement found a transfer that does not match what is owed', {
        correlationId,
      });
      return { kind: 'unanswered' };
    }
    return { kind: 'sent', snapshot };
  } catch (error) {
    const { definitive, code } = classifyStripeError(error);
    if (!definitive) {
      logger.warn('settlement transfer call deferred', { correlationId });
      return { kind: 'unanswered' };
    }
    return { kind: 'refused', code };
  }
}

/**
 * Send what is owed, if it is what the operator reviewed.
 *
 * `expectedTotalMinor` is the eligible total from the report. A different total
 * sends NOTHING. Each item is then re-read and re-judged just before it is sent,
 * so something that stopped being eligible in the meantime is skipped, not paid.
 */
export async function runSettlement(
  expectedTotalMinor: bigint,
  options: { readonly now?: Date; readonly correlationId?: string } = {},
): Promise<SettlementRunResult> {
  const now = options.now ?? new Date();
  const correlationId = options.correlationId ?? randomUUID();

  const candidates = await settlementCandidates({ now });
  const eligible = candidates.filter((candidate) => candidate.decision.eligible);

  const currencies = [...new Set(eligible.map((candidate) => candidate.currencyCode))];
  if (currencies.length > 1) {
    logger.error('settlement refused: more than one currency is eligible', { correlationId });
    return { result: 'mixed_currency', currencies };
  }

  const eligibleTotal = sumMinor(eligible.map((candidate) => candidate.amountMinor));
  if (eligibleTotal !== expectedTotalMinor) {
    logger.warn('settlement refused: the eligible total is not the one reviewed', {
      correlationId,
    });
    return {
      result: 'total_changed',
      expectedTotalMinor: expectedTotalMinor.toString(),
      eligibleTotalMinor: eligibleTotal.toString(),
    };
  }

  if (eligible.length === 0) {
    return {
      result: 'done',
      attempted: 0,
      sent: 0,
      failed: 0,
      deferred: 0,
      skipped: 0,
      totalSentMinor: '0',
      currencyCode: null,
    };
  }

  const stripe = stripeClient(process.env.STRIPE_SECRET_KEY);
  let sent = 0;
  let failed = 0;
  let deferred = 0;
  let skipped = 0;
  const sentAmounts: bigint[] = [];

  for (const listed of eligible) {
    // Re-read and re-judge immediately before sending: a refund flagged, a
    // booking cancelled or a tutor restricted since the report is seen here.
    const fresh = await settlementCandidate(listed.transferId, new Date());
    if (fresh === null || !fresh.decision.eligible) {
      skipped += 1;
      continue;
    }

    const step = await sendOne(stripe, fresh, correlationId);

    if (step.kind === 'unanswered') {
      deferred += 1;
      continue;
    }
    if (step.kind === 'refused') {
      await recordTransferFailed({
        transferId: fresh.transferId,
        failureCode: step.code,
        correlationId,
      });
      failed += 1;
      continue;
    }

    const outcome = await recordTransferSent({
      transferId: fresh.transferId,
      providerTransferId: step.snapshot.providerTransferId,
      correlationId,
    });
    if (outcome === 'sent') {
      sent += 1;
      sentAmounts.push(fresh.amountMinor);
    } else {
      skipped += 1;
    }
  }

  logger.info('settlement run complete', {
    correlationId,
    attempted: eligible.length,
    sent,
    failed,
    deferred,
    skipped,
  });
  return {
    result: 'done',
    attempted: eligible.length,
    sent,
    failed,
    deferred,
    skipped,
    totalSentMinor: sumMinor(sentAmounts).toString(),
    currencyCode: currencies[0] ?? null,
  };
}

/** Put a FAILED obligation back in the queue, as a new one. */
export async function requeueSettlement(
  paymentReference: string,
  correlationId: string = randomUUID(),
): Promise<RequeueResult> {
  const result = await requeueFailedTransfer({ paymentReference, correlationId });
  logger.info('settlement requeue', { correlationId, status: result.status });
  return result;
}
