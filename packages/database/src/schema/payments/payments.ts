import { sql } from 'drizzle-orm';
import {
  bigint,
  char,
  check,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { paymentsSchema } from '../shared/schemas';
import { users } from '../identity/users';
import { familyAccounts } from '../families/family-accounts';
import { tutorProfiles } from '../tutors/tutor-profiles';
import { serviceVersions } from '../services/services';
import { intendedLessonRequests } from '../bookings/intended-lesson-requests';
import { tutorRequests } from '../bookings/tutor-requests';

/**
 * `payments.payments` — what money was supposed to move, and later what did.
 *
 * ONE ROW ANSWERS FIVE QUESTIONS, months later, without reading any other
 * table and without re-running any rule: what did the parent pay, what did
 * Studdy take, what did the tutor earn, which pricing rules produced that, and
 * what did the provider actually cost us.
 *
 * That is why the rates and rule versions are SNAPSHOTTED rather than joined.
 * Studdy's commission will change one day; when it does, every historical
 * payment must still explain itself in the terms that applied at the time. A
 * join to the live rule would silently rewrite history.
 *
 * PROVIDER-NEUTRAL BY CONSTRUCTION. Every provider column is nullable and this
 * slice writes none of them — no Stripe SDK, no PaymentIntent, no Connect
 * account. The ledger has to be able to say what is owed before anything can
 * be charged, and building it first means the provider slice adds identifiers
 * to a shape that already balances rather than inventing the shape under
 * deadline.
 */
export const payments = paymentsSchema.table(
  'payments',
  {
    ...standardColumns,
    reference: text('reference')
      .notNull()
      .unique()
      .default(sql`'PAY-' || lpad(nextval('platform.global_reference_seq')::text, 8, '0')`),

    // --- what is being paid for ------------------------------------------
    /** The request this pays for. One live payment per request; see below. */
    intendedLessonRequestId: uuid('intended_lesson_request_id')
      .notNull()
      .references(() => intendedLessonRequests.id, { onDelete: 'restrict' }),
    /** The winning tutor request — the tutor and time actually chosen. */
    tutorRequestId: uuid('tutor_request_id')
      .notNull()
      .references(() => tutorRequests.id, { onDelete: 'restrict' }),
    /**
     * The priced version this was charged from.
     *
     * THE SERVER'S SOURCE OF PRICE. Amounts below are snapshots of what this
     * version said at the time; the version id records where they came from, so
     * a dispute can be settled by looking rather than by remembering. Service
     * versions are immutable rows, so the pointer stays true.
     */
    serviceVersionId: uuid('service_version_id')
      .notNull()
      .references(() => serviceVersions.id, { onDelete: 'restrict' }),

    // --- who ---------------------------------------------------------------
    payerUserId: uuid('payer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** Null for an independent student, mirroring the ILR's own payer scope. */
    familyAccountId: uuid('family_account_id').references(() => familyAccounts.id, {
      onDelete: 'restrict',
    }),
    tutorProfileId: uuid('tutor_profile_id')
      .notNull()
      .references(() => tutorProfiles.id, { onDelete: 'restrict' }),

    // --- the money ---------------------------------------------------------
    /** NZD at launch. Stored per row so a second currency needs no backfill. */
    currencyCode: char('currency_code', { length: 3 }).notNull(),
    /** The tutor's listed price. What the parent sees as the lesson price. */
    lessonAmountMinor: bigint('lesson_amount_minor', { mode: 'bigint' }).notNull(),
    /** 1000 = 10%. Snapshotted, because the rate will change one day. */
    platformFeeRateBps: integer('platform_fee_rate_bps').notNull(),
    /** The `payments.platform_fee_rate_bps` version that produced it. */
    platformFeeRuleVersion: integer('platform_fee_rule_version').notNull(),
    /** Studdy's commission. */
    platformFeeAmountMinor: bigint('platform_fee_amount_minor', { mode: 'bigint' }).notNull(),
    /** The tutor's money: the listed price less Studdy's fee, exactly. */
    tutorEntitlementMinor: bigint('tutor_entitlement_minor', { mode: 'bigint' }).notNull(),

    /**
     * Who bore the cost of taking the payment: `platform` | `payer`.
     *
     * THREE SEPARATE CONCEPTS live in this table and must not be conflated:
     * Studdy's commission above, the parent's disclosed fee here, and the
     * provider's actual cost below. Only the middle one changes when the policy
     * changes, which is what makes the policy testable with parents later
     * without redesigning anything.
     */
    processingFeePayerCode: text('processing_fee_payer_code').notNull(),
    /** The `payments.processing_fee_payer` version. Versioned SEPARATELY. */
    processingFeeRuleVersion: integer('processing_fee_rule_version').notNull(),
    /** What the parent was explicitly charged on top. Zero while Studdy absorbs. */
    processingFeeChargedMinor: bigint('processing_fee_charged_minor', { mode: 'bigint' })
      .notNull()
      // A SQL literal rather than `0n`: drizzle-kit serialises the schema
      // snapshot as JSON, and a BigInt default kills generation outright.
      .default(sql`0`),
    /** What the parent actually pays: the lesson plus any disclosed fee. */
    totalChargedMinor: bigint('total_charged_minor', { mode: 'bigint' }).notNull(),
    /**
     * What the provider actually took. NEVER ESTIMATED.
     *
     * Nullable and unset until the provider supplies it — for Stripe, from the
     * balance transaction after settlement. Real card costs vary by card, so a
     * modelled figure here would be a guess wearing a ledger's clothes. Its
     * absence is honest; a plausible wrong number would not be.
     */
    providerCostMinor: bigint('provider_cost_minor', { mode: 'bigint' }),

    // --- tax: recorded, never computed -------------------------------------
    /**
     * NOT IMPLEMENTED, and deliberately empty at launch.
     *
     * The commercial intent is that Studdy's 10% stays 10% from the tutor's
     * perspective — GST-inclusive rather than added on top, which would deduct
     * more than 10%. That treatment needs a New Zealand accountant's
     * confirmation before production money moves, and tutor GST registration
     * varies per tutor and is not assumed anywhere.
     *
     * These two columns exist so the answer can be recorded without migrating
     * over live money. Nothing writes them in this slice, and no tax is
     * calculated anywhere in the codebase.
     */
    taxTreatmentCode: text('tax_treatment_code'),
    taxMetadata: jsonb('tax_metadata'),

    // --- the provider, all nullable until Stripe arrives -------------------
    /** `stripe` once a provider exists. Null while nothing has charged. */
    provider: text('provider'),
    providerPaymentIntentId: text('provider_payment_intent_id').unique(),
    providerChargeId: text('provider_charge_id'),
    /** Where `provider_cost_minor` is eventually read from. */
    providerBalanceTransactionId: text('provider_balance_transaction_id'),

    // --- state -------------------------------------------------------------
    /** requires_payment | processing | succeeded | failed | cancelled | expired */
    statusCode: text('status_code').notNull().default('requires_payment'),
    /** Copied from the tutor request's snapshot, so the ledger stands alone. */
    paymentDeadlineAt: timestamp('payment_deadline_at', { withTimezone: true }).notNull(),
    /**
     * How many attempts have been declined.
     *
     * A RECOVERABLE DECLINE IS NOT A STATUS CHANGE. The payment stays
     * `requires_payment` and this counts up, so the family retries the same
     * payment rather than accumulating a row per attempt — which is also what
     * lets the live-payment index below stay a single-row guarantee.
     */
    failedAttemptCount: integer('failed_attempt_count').notNull().default(0),
    /** The provider's last decline reason, for support. Never shown verbatim. */
    lastFailureCode: text('last_failure_code'),
    succeededAt: timestamp('succeeded_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    /**
     * Set when a payment succeeded but its lesson could not be confirmed —
     * a webhook arriving after the sweep released the slot and somebody else
     * took it. Rare, real, and it must have somewhere to be recorded rather
     * than leaving a paid row looking ordinary.
     */
    refundRequiredAt: timestamp('refund_required_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'payment_status_check',
      sql`${table.statusCode} in ('requires_payment', 'processing', 'succeeded', 'failed', 'cancelled', 'expired')`,
    ),
    check(
      'payment_processing_fee_payer_check',
      sql`${table.processingFeePayerCode} in ('platform', 'payer')`,
    ),
    // NZD only at launch, but shaped so a second currency is a data change.
    check('payment_currency_check', sql`${table.currencyCode} ~ '^[A-Z]{3}$'`),

    /*
     * THE ARITHMETIC INVARIANTS, in the database rather than in a code comment.
     *
     * The fee and the entitlement must sum to the lesson exactly. The domain
     * computes the fee and takes the entitlement as the REMAINDER precisely so
     * this can never fail — and the constraint is here to catch the writer that
     * forgets, including a hand-run UPDATE.
     */
    check(
      'payment_fee_split_check',
      sql`${table.lessonAmountMinor} = ${table.platformFeeAmountMinor} + ${table.tutorEntitlementMinor}`,
    ),
    check(
      'payment_total_check',
      sql`${table.totalChargedMinor} = ${table.lessonAmountMinor} + ${table.processingFeeChargedMinor}`,
    ),
    // Absorbing the cost means charging the parent nothing. Not "roughly
    // nothing" — the policy and the number cannot disagree.
    check(
      'payment_platform_absorbs_check',
      sql`${table.processingFeePayerCode} <> 'platform' or ${table.processingFeeChargedMinor} = 0`,
    ),
    /*
     * A PAYABLE LESSON IS WORTH SOMETHING. The ledger says so itself.
     *
     * Not a duplicate of an upstream guarantee — there isn't one.
     * `services.service_versions.price_amount_minor` carries NO check
     * constraint at all, so a zero-priced version is writable today, and slice
     * 5 prices server-side by copying that column straight into
     * `lesson_amount_minor`. Every other check here would pass on the result:
     * 0 = 0 + 0 splits, 0 = 0 + 0 totals, and all six amounts are >= 0. A
     * zero-value payment row is therefore reachable through the real payment
     * path, and nothing else would refuse it.
     *
     * This is a HISTORICAL invariant, which is why it belongs on the ledger
     * rather than only upstream: a payment row is the durable record that money
     * was owed. A row saying nothing was owed is not a free lesson Studdy
     * offers — it is a record that should never have been written.
     *
     * Deliberately NOT free-lesson support, and deliberately not a change to
     * `computePaymentBreakdown`, which stays total at zero because arithmetic
     * with a hole in it is harder to reason about than the constraint here.
     */
    check('payment_lesson_amount_positive_check', sql`${table.lessonAmountMinor} > 0`),
    // `lesson_amount_minor` is absent below: `> 0` above already subsumes it,
    // and repeating it would make two constraints answer for one column.
    check(
      'payment_amounts_non_negative_check',
      sql`${table.platformFeeAmountMinor} >= 0
      and ${table.tutorEntitlementMinor} >= 0
      and ${table.processingFeeChargedMinor} >= 0
      and ${table.totalChargedMinor} >= 0
      and (${table.providerCostMinor} is null or ${table.providerCostMinor} >= 0)`,
    ),
    check('payment_fee_rate_range_check', sql`${table.platformFeeRateBps} between 0 and 10000`),
    check('payment_attempts_non_negative_check', sql`${table.failedAttemptCount} >= 0`),

    /*
     * ONE LIVE PAYMENT PER REQUEST — the double-payment guard, and a database
     * constraint rather than a code path so no caller can forget it.
     *
     * `succeeded` is inside the set deliberately: once a lesson is paid for, a
     * second payment for it is unrepresentable. The three terminal failures are
     * outside it, so a family whose payment genuinely failed can begin a fresh
     * attempt while their window is still open — and because a recoverable
     * decline leaves the row `requires_payment`, ordinary retries never create
     * a second row to collide here at all.
     */
    uniqueIndex('payment_live_per_request_unique_idx')
      .on(table.intendedLessonRequestId)
      .where(sql`${table.statusCode} in ('requires_payment', 'processing', 'succeeded')`),

    index('payment_tutor_idx').on(table.tutorProfileId),
    index('payment_request_idx').on(table.intendedLessonRequestId),
    // The expiry sweep and reconciliation both scan by deadline within a status.
    index('payment_open_deadline_idx')
      .on(table.paymentDeadlineAt)
      .where(sql`${table.statusCode} in ('requires_payment', 'processing')`),
  ],
);
