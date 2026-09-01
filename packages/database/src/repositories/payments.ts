import { and, eq, inArray, gt } from 'drizzle-orm';
import {
  computePaymentBreakdown,
  canTutorReceivePayments,
  type CapabilityStatus,
} from '@studdy/domain/payments';
import { createDatabaseClient } from '../client';
import {
  connectedAccounts,
  intendedLessonRequests,
  payments,
  serviceVersions,
  studentSubjectSections,
  tutorRequests,
} from '../schema/index';
import { loadPricingRules } from './rule-settings';

/**
 * Creating the money record for a selected lesson.
 *
 * THIS FILE OWNS EVERY GUARD AND EVERY AMOUNT. It knows nothing about Stripe:
 * `@studdy/database` does not depend on `@studdy/integrations`, so the provider
 * call is the web layer's job and the ledger stays provider-neutral. What
 * crosses back is a `providerPaymentIntentId`, attached afterwards.
 *
 * SERVER-AUTHORITATIVE PRICING, which is the security property this slice turns
 * on. No amount, currency, fee or entitlement is accepted from a caller. They
 * are computed here from the tutor request's own `service_version_id` and the
 * versioned pricing rules, so there is no field for a browser to tamper with —
 * amount tampering is structurally impossible rather than validated against.
 */

/** Why a payment could not be created. Each maps to a family-safe message. */
export type PaymentRefusalReason =
  /** No such request for this family, or not theirs. Same answer either way. */
  | 'request_not_found'
  /** The ILR is not awaiting payment — already paid, closed, or never selected. */
  | 'not_awaiting_payment'
  /** The 60-minute window has closed. A new PaymentIntent must never be made. */
  | 'payment_window_closed'
  /** The tutor cannot currently receive money. Checked live, never cached. */
  | 'tutor_not_payable';

export class PaymentRefusedError extends Error {
  override name = 'PaymentRefusedError';
  constructor(readonly reason: PaymentRefusalReason) {
    super(`Payment refused: ${reason}`);
  }
}

/** What the caller needs to drive Stripe and render the page. */
export interface PreparedPayment {
  readonly paymentId: string;
  readonly reference: string;
  readonly statusCode: string;
  /** Set once a PaymentIntent exists. Null on a freshly created row. */
  readonly providerPaymentIntentId: string | null;
  /** True when this call reused an existing live row rather than inserting. */
  readonly reused: boolean;

  // --- the money, all server-computed -------------------------------------
  readonly currencyCode: string;
  readonly lessonAmountMinor: bigint;
  readonly platformFeeAmountMinor: bigint;
  readonly tutorEntitlementMinor: bigint;
  readonly processingFeeChargedMinor: bigint;
  readonly totalChargedMinor: bigint;
  readonly paymentDeadlineAt: Date;

  // --- what Stripe needs, none of it family-facing --------------------------
  readonly tutorProfileId: string;
  readonly intendedLessonRequestId: string;
  readonly tutorRequestId: string;
  readonly serviceVersionId: string;
}

/**
 * Statuses that mean a payment is still the live one for its request.
 *
 * The same set the partial unique index uses, so "is there a live payment" has
 * one definition rather than two that can drift.
 */
const LIVE_PAYMENT_STATUSES = ['requires_payment', 'processing', 'succeeded'] as const;

/**
 * Create — or return — the live payment for a selected request.
 *
 * IDEMPOTENT IN TWO LAYERS, because a parent refreshing the payment page is the
 * normal case rather than the exception:
 *
 *   1. an existing live row is returned as-is, with its PaymentIntent, so a
 *      refresh reuses the same intent and never charges twice;
 *   2. the partial unique index on `intended_lesson_request_id` is the backstop,
 *      so two concurrent requests cannot both insert.
 *
 * OWNERSHIP IS PART OF THE QUERY, exactly as selection already does it: the ILR
 * is matched against the session's own student profiles in the same `WHERE`. A
 * request belonging to another family matches zero rows and is refused as
 * `request_not_found` — indistinguishable from one that does not exist, so the
 * refusal leaks nothing.
 */
export async function createPaymentForRequest(input: {
  /** The ILR reference from the URL. */
  readonly reference: string;
  /** The session's student profiles. Ownership, never a parameter to trust. */
  readonly studentProfileIds: readonly string[];
  readonly payerUserId: string;
  readonly now?: Date;
}): Promise<PreparedPayment> {
  const { sql, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    if (input.studentProfileIds.length === 0) {
      throw new PaymentRefusedError('request_not_found');
    }

    // The request, its winner, and the priced version — in one ownership-scoped
    // read, so nothing downstream has to re-establish who may act.
    const [row] = await db
      .select({
        ilrId: intendedLessonRequests.id,
        ilrStatus: intendedLessonRequests.statusCode,
        familyAccountId: intendedLessonRequests.familyAccountId,
        tutorRequestId: tutorRequests.id,
        tutorRequestStatus: tutorRequests.statusCode,
        tutorProfileId: tutorRequests.tutorProfileId,
        serviceVersionId: tutorRequests.serviceVersionId,
        paymentDeadlineAt: tutorRequests.paymentDeadlineAt,
        priceAmountMinor: serviceVersions.priceAmountMinor,
        currencyCode: serviceVersions.currencyCode,
      })
      .from(intendedLessonRequests)
      .innerJoin(
        studentSubjectSections,
        eq(intendedLessonRequests.studentSubjectSectionId, studentSubjectSections.id),
      )
      .innerJoin(
        tutorRequests,
        and(
          eq(tutorRequests.intendedLessonRequestId, intendedLessonRequests.id),
          eq(tutorRequests.statusCode, 'selected'),
        ),
      )
      .innerJoin(serviceVersions, eq(tutorRequests.serviceVersionId, serviceVersions.id))
      .where(
        and(
          eq(intendedLessonRequests.reference, input.reference),
          inArray(studentSubjectSections.studentProfileId, [...input.studentProfileIds]),
        ),
      )
      .limit(1);

    if (row === undefined) throw new PaymentRefusedError('request_not_found');
    if (row.ilrStatus !== 'awaiting_payment') {
      throw new PaymentRefusedError('not_awaiting_payment');
    }

    /*
     * THE DEADLINE IS CHECKED BEFORE ANYTHING IS WRITTEN OR CHARGED. Creating a
     * PaymentIntent after the window has closed would take money for a slot the
     * sweep is entitled to give away — the one outcome worse than refusing.
     */
    const deadline = row.paymentDeadlineAt;
    if (deadline === null || deadline <= now) {
      throw new PaymentRefusedError('payment_window_closed');
    }

    // An existing live payment wins outright. Returned before any pricing or
    // provider work, so a refresh is cheap as well as safe.
    const [live] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.intendedLessonRequestId, row.ilrId),
          inArray(payments.statusCode, LIVE_PAYMENT_STATUSES),
        ),
      )
      .limit(1);

    if (live !== undefined) {
      return {
        paymentId: live.id,
        reference: live.reference,
        statusCode: live.statusCode,
        providerPaymentIntentId: live.providerPaymentIntentId,
        reused: true,
        currencyCode: live.currencyCode,
        lessonAmountMinor: live.lessonAmountMinor,
        platformFeeAmountMinor: live.platformFeeAmountMinor,
        tutorEntitlementMinor: live.tutorEntitlementMinor,
        processingFeeChargedMinor: live.processingFeeChargedMinor,
        totalChargedMinor: live.totalChargedMinor,
        paymentDeadlineAt: live.paymentDeadlineAt,
        tutorProfileId: live.tutorProfileId,
        intendedLessonRequestId: live.intendedLessonRequestId,
        tutorRequestId: live.tutorRequestId,
        serviceVersionId: live.serviceVersionId,
      };
    }

    /*
     * THE TUTOR MUST STILL BE PAYABLE, read live rather than trusted from
     * whatever the browser last saw. Stripe can restrict an account minutes
     * after onboarding completed, and taking a parent's money for a tutor who
     * cannot receive it is the failure this check exists to prevent.
     *
     * The rule is slice 4's, unchanged: transfers active AND payouts active.
     */
    const [account] = await db
      .select({
        transfers: connectedAccounts.transfersCapabilityCode,
        payouts: connectedAccounts.payoutsCapabilityCode,
      })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.tutorProfileId, row.tutorProfileId))
      .limit(1);

    const payable =
      account !== undefined &&
      canTutorReceivePayments({
        transfersCapability: account.transfers as CapabilityStatus,
        payoutsCapability: account.payouts as CapabilityStatus,
        statusDetails: [],
      });
    if (!payable) throw new PaymentRefusedError('tutor_not_payable');

    /*
     * PRICED FROM THE SERVICE VERSION, never from a caller. The rules are read
     * per key and snapshotted per key, because `rule_settings` versions
     * independently — a payment must be able to explain itself later in the
     * terms that applied at the time.
     */
    const pricing = await loadPricingRules();
    const breakdown = computePaymentBreakdown({
      lessonAmountMinor: row.priceAmountMinor,
      currencyCode: row.currencyCode,
      rules: pricing.rules,
    });

    const [created] = await db
      .insert(payments)
      .values({
        intendedLessonRequestId: row.ilrId,
        tutorRequestId: row.tutorRequestId,
        serviceVersionId: row.serviceVersionId,
        payerUserId: input.payerUserId,
        familyAccountId: row.familyAccountId,
        tutorProfileId: row.tutorProfileId,
        currencyCode: breakdown.currencyCode,
        lessonAmountMinor: breakdown.lessonAmountMinor,
        platformFeeRateBps: breakdown.platformFeeRateBps,
        platformFeeRuleVersion: pricing.platformFeeRuleVersion,
        platformFeeAmountMinor: breakdown.platformFeeAmountMinor,
        tutorEntitlementMinor: breakdown.tutorEntitlementMinor,
        processingFeePayerCode: breakdown.processingFeePayer,
        processingFeeRuleVersion: pricing.processingFeeRuleVersion,
        processingFeeChargedMinor: breakdown.processingFeeChargedMinor,
        totalChargedMinor: breakdown.totalChargedMinor,
        statusCode: 'requires_payment',
        paymentDeadlineAt: deadline,
        // `provider` and every provider id stay null until Stripe answers.
      })
      // The partial unique index is the real double-payment guard. A concurrent
      // caller that loses simply reads the winner's row below.
      .onConflictDoNothing()
      .returning();

    if (created === undefined) {
      const [winner] = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.intendedLessonRequestId, row.ilrId),
            inArray(payments.statusCode, LIVE_PAYMENT_STATUSES),
          ),
        )
        .limit(1);
      if (winner === undefined) throw new PaymentRefusedError('not_awaiting_payment');
      return {
        paymentId: winner.id,
        reference: winner.reference,
        statusCode: winner.statusCode,
        providerPaymentIntentId: winner.providerPaymentIntentId,
        reused: true,
        currencyCode: winner.currencyCode,
        lessonAmountMinor: winner.lessonAmountMinor,
        platformFeeAmountMinor: winner.platformFeeAmountMinor,
        tutorEntitlementMinor: winner.tutorEntitlementMinor,
        processingFeeChargedMinor: winner.processingFeeChargedMinor,
        totalChargedMinor: winner.totalChargedMinor,
        paymentDeadlineAt: winner.paymentDeadlineAt,
        tutorProfileId: winner.tutorProfileId,
        intendedLessonRequestId: winner.intendedLessonRequestId,
        tutorRequestId: winner.tutorRequestId,
        serviceVersionId: winner.serviceVersionId,
      };
    }

    return {
      paymentId: created.id,
      reference: created.reference,
      statusCode: created.statusCode,
      providerPaymentIntentId: null,
      reused: false,
      currencyCode: created.currencyCode,
      lessonAmountMinor: created.lessonAmountMinor,
      platformFeeAmountMinor: created.platformFeeAmountMinor,
      tutorEntitlementMinor: created.tutorEntitlementMinor,
      processingFeeChargedMinor: created.processingFeeChargedMinor,
      totalChargedMinor: created.totalChargedMinor,
      paymentDeadlineAt: created.paymentDeadlineAt,
      tutorProfileId: created.tutorProfileId,
      intendedLessonRequestId: created.intendedLessonRequestId,
      tutorRequestId: created.tutorRequestId,
      serviceVersionId: created.serviceVersionId,
    };
  } finally {
    await sql.end();
  }
}

/**
 * Record the PaymentIntent the provider just created for a payment.
 *
 * Separate from creation because the ledger must not know Stripe. Guarded on
 * the intent still being unset, so a late or duplicated provider response
 * cannot overwrite an intent a parent may already be paying against.
 */
export async function attachProviderPaymentIntent(input: {
  readonly paymentId: string;
  readonly provider: string;
  readonly providerPaymentIntentId: string;
  readonly now?: Date;
}): Promise<void> {
  const { sql, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    await db
      .update(payments)
      .set({
        provider: input.provider,
        providerPaymentIntentId: input.providerPaymentIntentId,
        updatedAt: now,
      })
      .where(and(eq(payments.id, input.paymentId), eq(payments.statusCode, 'requires_payment')));
  } finally {
    await sql.end();
  }
}

/** The live payment for a family's request, or null. Ownership-scoped. */
export async function livePaymentForRequest(input: {
  readonly reference: string;
  readonly studentProfileIds: readonly string[];
}): Promise<PreparedPayment | null> {
  if (input.studentProfileIds.length === 0) return null;
  const { sql, db } = createDatabaseClient();
  try {
    const [live] = await db
      .select({ p: payments })
      .from(payments)
      .innerJoin(
        intendedLessonRequests,
        eq(payments.intendedLessonRequestId, intendedLessonRequests.id),
      )
      .innerJoin(
        studentSubjectSections,
        eq(intendedLessonRequests.studentSubjectSectionId, studentSubjectSections.id),
      )
      .where(
        and(
          eq(intendedLessonRequests.reference, input.reference),
          inArray(studentSubjectSections.studentProfileId, [...input.studentProfileIds]),
          inArray(payments.statusCode, LIVE_PAYMENT_STATUSES),
        ),
      )
      .limit(1);
    if (live === undefined) return null;
    const p = live.p;
    return {
      paymentId: p.id,
      reference: p.reference,
      statusCode: p.statusCode,
      providerPaymentIntentId: p.providerPaymentIntentId,
      reused: true,
      currencyCode: p.currencyCode,
      lessonAmountMinor: p.lessonAmountMinor,
      platformFeeAmountMinor: p.platformFeeAmountMinor,
      tutorEntitlementMinor: p.tutorEntitlementMinor,
      processingFeeChargedMinor: p.processingFeeChargedMinor,
      totalChargedMinor: p.totalChargedMinor,
      paymentDeadlineAt: p.paymentDeadlineAt,
      tutorProfileId: p.tutorProfileId,
      intendedLessonRequestId: p.intendedLessonRequestId,
      tutorRequestId: p.tutorRequestId,
      serviceVersionId: p.serviceVersionId,
    };
  } finally {
    await sql.end();
  }
}

/** Payments still open for a request, used to decide whether a retry is allowed. */
export async function paymentIsRetryable(input: {
  readonly paymentId: string;
  readonly now?: Date;
}): Promise<boolean> {
  const { sql, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    const [row] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.id, input.paymentId),
          eq(payments.statusCode, 'requires_payment'),
          gt(payments.paymentDeadlineAt, now),
        ),
      )
      .limit(1);
    return row !== undefined;
  } finally {
    await sql.end();
  }
}
