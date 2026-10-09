import { sql } from 'drizzle-orm';
import {
  bigint,
  char,
  check,
  index,
  integer,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { paymentsSchema } from '../shared/schemas';
import { users } from '../identity/users';
import { payments } from './payments';

/**
 * `payments.refunds` — money given back to a parent, recorded BEFORE it is
 * attempted.
 *
 * A REFUND IS ITS OWN ROW, never an edit to the payment. The payment stays
 * `succeeded` for ever, because it did succeed; what happened afterwards is a
 * separate fact with its own state, its own provider id and its own history.
 * That is what "immutable financial history" means in practice: corrections are
 * entries beside the original, so "what did the parent pay, and what came back"
 * is two rows read together rather than one row that forgot.
 *
 * `requested` IS INTENT, COMMITTED FIRST. Studdy writes this row and commits it
 * before the provider is called. If the process dies between the provider
 * accepting and Studdy recording the answer, the row is still here and still
 * `requested`, and the reconcile pass re-asks the provider with the SAME
 * idempotency key and receives the SAME refund. Without the row, a crash there
 * would be a refund Studdy could neither see nor safely repeat.
 *
 * ONE LIVE REFUND PER PAYMENT, FOR NOW. The partial unique index below makes a
 * second concurrent refund for the same payment unrepresentable. It is a
 * deliberate over-restriction: refunds here are always the whole remaining
 * amount, and the cancellation slice — which introduces partial refunds under a
 * policy — replaces this index with a sum guard in its own migration.
 *
 * Server-only, like every table that holds money or a provider identifier.
 */
export const refunds = paymentsSchema.table(
  'refunds',
  {
    ...standardColumns,
    reference: text('reference')
      .notNull()
      .unique()
      .default(sql`'RF-' || lpad(nextval('platform.global_reference_seq')::text, 8, '0')`),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'restrict' }),
    /** 1, 2, 3... A retry after a FAILED refund is a new row with the next number. */
    attempt: integer('attempt').notNull().default(1),
    /** `booking_not_confirmed` today; the cancellation slice adds its own. */
    reasonCode: text('reason_code').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    currencyCode: char('currency_code', { length: 3 }).notNull(),
    /** requested | pending | succeeded | failed */
    statusCode: text('status_code').notNull().default('requested'),

    // --- the provider, nullable until it has answered ----------------------
    provider: text('provider'),
    providerRefundId: text('provider_refund_id').unique(),
    /** The provider's own word, untouched, for support. */
    providerStatus: text('provider_status'),
    /** The provider's machine-readable reason a refund failed. Operational only. */
    failureCode: text('failure_code'),
    /**
     * Stable per attempt, so a repeated or resumed run reaches the refund it
     * already made. Unique in the database because "the job ran twice" is the
     * ordinary condition this guards, not an edge case.
     */
    idempotencyKey: text('idempotency_key').notNull().unique(),

    // --- who and when ------------------------------------------------------
    /** The operator, once the admin tooling can say who. Null for the ops job. */
    requestedByUserId: uuid('requested_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'refund_status_check',
      sql`${table.statusCode} in ('requested', 'pending', 'succeeded', 'failed')`,
    ),
    check('refund_reason_check', sql`${table.reasonCode} in ('booking_not_confirmed')`),
    check('refund_amount_positive_check', sql`${table.amountMinor} > 0`),
    check('refund_currency_check', sql`${table.currencyCode} ~ '^[A-Z]{3}$'`),
    check('refund_attempt_positive_check', sql`${table.attempt} >= 1`),
    // The provider has to have answered for a refund to be pending or succeeded,
    // and a refund that ended has to say when.
    check(
      'refund_provider_answered_check',
      sql`${table.statusCode} not in ('pending', 'succeeded') or ${table.providerRefundId} is not null`,
    ),
    check(
      'refund_completed_check',
      sql`${table.statusCode} not in ('succeeded', 'failed') or ${table.completedAt} is not null`,
    ),

    uniqueIndex('refund_attempt_unique_idx').on(table.paymentId, table.attempt),
    // One live refund per payment; see the table comment.
    uniqueIndex('refund_live_per_payment_unique_idx')
      .on(table.paymentId)
      .where(sql`${table.statusCode} in ('requested', 'pending', 'succeeded')`),
    // The reconcile pass reads what is still unresolved, oldest first.
    index('refund_unsettled_idx')
      .on(table.statusCode, table.requestedAt)
      .where(sql`${table.statusCode} in ('requested', 'pending')`),
  ],
);
