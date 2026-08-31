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
import { connectedAccounts } from './connected-accounts';
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
    /*
     * WHERE THE MONEY ACTUALLY WENT. Added in the Connect slice, once there was
     * a real account to point at.
     *
     * NOT added to `payments`, and the asymmetry is the whole justification.
     * Studdy uses separate charges and transfers: the parent's charge is created
     * on the PLATFORM account, so no connected account is party to it and a
     * column there would record a participant that did not participate. A
     * transfer is the opposite — the connected account is its destination, and
     * that is the fact this row exists to remember.
     *
     * It earns its place on durable integrity rather than convenience.
     * `tutor_profile_id` says who was owed; only this says which provider
     * account was actually paid. If a tutor's account is ever replaced — closed,
     * restricted, re-onboarded — the profile link would silently start pointing
     * at the new one, and a settled transfer would appear to have gone somewhere
     * it never went. `ON DELETE restrict` for the same reason as the other nine.
     *
     * NOT NULL, deliberately: a transfer with no destination is not an
     * incomplete record, it is a meaningless one. The table is empty and
     * unwritten, so there is nothing to backfill, and by the time slice 6 writes
     * a row the tutor has necessarily been payable — which requires this account
     * to exist. Failing loudly there is better than recording a payment to
     * nobody.
     */
    connectedAccountId: uuid('connected_account_id')
      .notNull()
      .references(() => connectedAccounts.id, { onDelete: 'restrict' }),
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
    index('tutor_transfer_connected_account_idx').on(table.connectedAccountId),
  ],
);
