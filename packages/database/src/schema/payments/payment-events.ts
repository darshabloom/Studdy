import { sql } from 'drizzle-orm';
import { check, index, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { paymentsSchema } from '../shared/schemas';
import { payments } from './payments';

/**
 * `payments.payment_events` — the provider-event ledger, and the idempotency
 * spine the webhook slice will stand on.
 *
 * SCHEMA ONLY IN THIS SLICE. Nothing writes it until webhooks exist. It lands
 * now because the guarantee it provides is a DATABASE CONSTRAINT rather than a
 * code path, and that is a decision worth making before the code that depends
 * on it is being written under deadline.
 *
 * The guarantee: `provider_event_id` is UNIQUE. A provider retrying delivery —
 * which Stripe does, freely, and which is the normal case rather than the
 * exception — collides on insert, and the handler returns success without
 * applying anything a second time. Idempotency that lives in an `if` statement
 * is idempotency somebody eventually forgets.
 *
 * Deliberately provider-neutral: `provider` is a column, not an assumption.
 */
export const paymentEvents = paymentsSchema.table(
  'payment_events',
  {
    ...standardColumns,
    /** `stripe` when one exists. A column so a second provider needs no table. */
    provider: text('provider').notNull(),
    /**
     * The provider's own event id. THE IDEMPOTENCY KEY, enforced by the unique
     * constraint rather than checked before inserting.
     */
    providerEventId: text('provider_event_id').notNull().unique(),
    /** The provider's event name, e.g. `payment_intent.succeeded`. */
    eventType: text('event_type').notNull(),
    /**
     * The event, kept so a decision can be re-examined later.
     *
     * "WHOLE" HAS ONE DOCUMENTED EXCEPTION, added by the Connect slice.
     * Payment events are stored as they arrive. `account.updated` is NOT: a raw
     * Connect account payload carries the tutor's name, date of birth, address
     * and document details, none of which Studdy reads. Storing identity data
     * the product never uses would create a liability in exchange for nothing,
     * so the webhook writes a redacted projection — capability and payability
     * flags, plus requirement IDENTIFIERS, never their values.
     *
     * Recorded here rather than left to be discovered, because a column whose
     * contract quietly varies by event type is worse than one whose exception
     * is written down.
     */
    payload: jsonb('payload').notNull(),
    /**
     * The payment it concerns, once resolved. Nullable: an event can arrive
     * for something Studdy does not recognise, and losing it would be worse
     * than storing it unattached.
     */
    paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'restrict' }),
    /** received | applied | ignored | failed */
    statusCode: text('status_code').notNull().default('received'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    /** Why it could not be applied. Never a payload dump. */
    errorNote: text('error_note'),
  },
  (table) => [
    check(
      'payment_event_status_check',
      sql`${table.statusCode} in ('received', 'applied', 'ignored', 'failed')`,
    ),
    // The retry drain reads the oldest unapplied events first.
    index('payment_event_pending_idx')
      .on(table.statusCode, table.receivedAt)
      .where(sql`${table.statusCode} in ('received', 'failed')`),
    index('payment_event_payment_idx').on(table.paymentId),
  ],
);
