import { sql } from 'drizzle-orm';
import {
  bigint,
  char,
  check,
  index,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { paymentsSchema } from '../shared/schemas';
import { tutorProfiles } from '../tutors/tutor-profiles';
import { payments } from './payments';

/**
 * `payments.tutor_transfers` — what Studdy owes the tutor, from the moment the
 * parent's money arrives.
 *
 * THE OBLIGATION IS RECORDED BEFORE IT IS SETTLED, and that ordering is the
 * point. Settlement is manual for private alpha — reviewed weekly, sent only
 * for lessons whose scheduled end has passed, withheld for anything flagged for
 * refund. A manual process without a record is a spreadsheet nobody can audit;
 * with one, "what are we holding, and for whom" is a query rather than a memory.
 *
 * This row is written when a payment succeeds. Sending the money is a later
 * slice, and nothing in this one automates a payout.
 *
 * PROVIDER-NEUTRAL: the tutor is identified by their Studdy profile, not by a
 * Connect account. `provider_transfer_id` is nullable and unset until a
 * provider actually moves money; the connected-account table it will eventually
 * sit beside belongs to the Stripe slice, because its shape is dictated by
 * Stripe's onboarding rather than by anything Studdy owes.
 */
export const tutorTransfers = paymentsSchema.table(
  'tutor_transfers',
  {
    ...standardColumns,
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'restrict' }),
    tutorProfileId: uuid('tutor_profile_id')
      .notNull()
      .references(() => tutorProfiles.id, { onDelete: 'restrict' }),
    /** The tutor's entitlement, copied from the payment at the time it succeeded. */
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    currencyCode: char('currency_code', { length: 3 }).notNull(),
    /** pending | sent | failed | reversed */
    statusCode: text('status_code').notNull().default('pending'),
    /** Null until a provider has actually moved it. */
    providerTransferId: text('provider_transfer_id').unique(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    /** Why a send failed or was reversed. Operational, never tutor-facing verbatim. */
    failureNote: text('failure_note'),
    /**
     * Stable across retries, so a manual settlement run cannot pay twice.
     *
     * Unique in the database because "we ran the script again" is exactly the
     * situation a manual process produces, and the guarantee has to survive the
     * person rather than depend on them.
     */
    idempotencyKey: text('idempotency_key').notNull().unique(),
  },
  (table) => [
    check(
      'tutor_transfer_status_check',
      sql`${table.statusCode} in ('pending', 'sent', 'failed', 'reversed')`,
    ),
    check('tutor_transfer_amount_check', sql`${table.amountMinor} >= 0`),
    check('tutor_transfer_currency_check', sql`${table.currencyCode} ~ '^[A-Z]{3}$'`),
    // One live obligation per payment. A reversal is recorded on the same row.
    uniqueIndex('tutor_transfer_live_per_payment_unique_idx')
      .on(table.paymentId)
      .where(sql`${table.statusCode} in ('pending', 'sent')`),
    // The settlement run reads what is owed, oldest first.
    index('tutor_transfer_pending_idx')
      .on(table.statusCode, table.createdAt)
      .where(sql`${table.statusCode} = 'pending'`),
    index('tutor_transfer_tutor_idx').on(table.tutorProfileId),
  ],
);
