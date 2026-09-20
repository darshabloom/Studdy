import { sql } from 'drizzle-orm';
import { check, index, integer, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { communicationsSchema } from '../shared/schemas';
import { outboxEntries } from '../audit/outbox-entries';
import { users } from '../identity/users';

/**
 * `communications.notification_deliveries` — one row per RECIPIENT of one
 * outbox event, and the reason this slice needed a schema change at all.
 *
 * THE OUTBOX CANNOT REPRESENT THIS, AND THAT IS THE WHOLE JUSTIFICATION.
 * `audit.outbox_entries` carries ONE `status_code`, ONE `attempts` and ONE
 * `processed_at` for a whole event. `booking.confirmed` owes two emails — the
 * family's and the tutor's — and they fail independently. With one status the
 * partial-failure case has no honest answer:
 *
 *   - mark the event `sent` when the family's email went and the tutor's did
 *     not, and the tutor is never told, permanently; or
 *   - leave it `pending` and retry, and the family gets a second copy of a
 *     message they already had.
 *
 * Neither is acceptable, and no amount of care in the worker fixes it, because
 * the state simply is not writable. So the smallest correct change is a row per
 * recipient, with its own status, its own attempt count and its own provider
 * message id.
 *
 * NOTHING ABOUT THE OUTBOX ITSELF CHANGES. No column is added to it, no
 * semantics are altered, and every existing producer is untouched. The outbox
 * remains the record that something happened; this table records who was told.
 * An outbox entry becomes `sent` only when EVERY delivery it owes is `sent` —
 * never because one recipient succeeded.
 *
 * WHY IT IS NOT IN `audit`. This is operational delivery state that will be
 * queried, retried and eventually pruned; the audit schema is the immutable
 * record of what happened. `communications` was reserved for exactly this in
 * the database spec and has been an empty stub since bootstrap.
 */
export const notificationDeliveries = communicationsSchema.table(
  'notification_deliveries',
  {
    ...standardColumns,

    /**
     * The outbox event this delivers.
     *
     * `ON DELETE restrict`, like every other link in this codebase: a delivery
     * whose event has vanished is a record of an email nobody can explain.
     */
    outboxEntryId: uuid('outbox_entry_id')
      .notNull()
      .references(() => outboxEntries.id, { onDelete: 'restrict' }),
    /** Copied from the entry so this table can be read without joining. */
    eventType: text('event_type').notNull(),

    /** `family | tutor | ops` — the ROLE, which decides what may be said. */
    recipientRoleCode: text('recipient_role_code').notNull(),
    /**
     * The Studdy user being written to, when there is one.
     *
     * Nullable because `ops` is a configured mailbox rather than a person with
     * an account. Recorded for every customer recipient so "what were they
     * told, and when" is a query rather than a guess.
     */
    recipientUserId: uuid('recipient_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    /**
     * The address the message was actually addressed to.
     *
     * RESOLVED SERVER-SIDE at planning time and stored, so a later change to a
     * user's address does not rewrite the history of where mail went. In a
     * non-production environment this is the redirected development address,
     * not the intended one — which is the honest record of what happened.
     */
    toAddress: text('to_address').notNull(),

    /** `email`. A column rather than an assumption, as everywhere else. */
    channelCode: text('channel_code').notNull().default('email'),
    /** Which template rendered it, for support and for reproducing a message. */
    templateCode: text('template_code').notNull(),

    /** pending | sent | failed */
    statusCode: text('status_code').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    /**
     * A machine-readable reason, never a stack trace and never a provider body.
     *
     * The failure of a send is operational information; the provider's prose
     * about it is not something to keep, and is certainly not something to risk
     * rendering anywhere.
     */
    lastErrorCode: text('last_error_code'),

    /** `resend`, once one has accepted it. Null while nothing has. */
    provider: text('provider'),
    /**
     * The provider's own id for the accepted message.
     *
     * UNIQUE, so the same provider message can never be recorded against two
     * deliveries — the check that would catch a resolver bug pointing two
     * recipients at one send.
     */
    providerMessageId: text('provider_message_id').unique(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),

    /**
     * Stable across every retry, in every worker, forever.
     *
     * `<event-type>/<outbox-entry-id>/<role>`. Unique here so a second delivery
     * row is unrepresentable, and passed to the provider as ITS idempotency key
     * so a crash between "provider accepted" and "Studdy recorded it" cannot
     * produce a duplicate email. Those two writes are not in one transaction
     * and cannot be; this is what makes the gap safe rather than pretending it
     * is not there.
     */
    idempotencyKey: text('idempotency_key').notNull().unique(),
  },
  (table) => [
    check(
      'notification_delivery_status_check',
      sql`${table.statusCode} in ('pending', 'sent', 'failed')`,
    ),
    check(
      'notification_delivery_role_check',
      sql`${table.recipientRoleCode} in ('family', 'tutor', 'ops')`,
    ),
    check('notification_delivery_channel_check', sql`${table.channelCode} in ('email')`),
    check('notification_delivery_attempts_check', sql`${table.attempts} >= 0`),
    /*
     * A SENT DELIVERY CARRIES ITS PROOF. `sent` without a provider message id
     * would be a claim that an email went out with nothing to check it against,
     * which is the one thing this table exists to be able to answer.
     */
    check(
      'notification_delivery_sent_complete_check',
      sql`${table.statusCode} <> 'sent'
      or (${table.providerMessageId} is not null and ${table.sentAt} is not null)`,
    ),
    /*
     * ONE DELIVERY PER RECIPIENT PER EVENT — the guarantee this table exists
     * for, enforced by the database rather than by the worker that plans them.
     *
     * Planning is therefore idempotent by construction: a drain that re-plans
     * an entry it already planned collides and inserts nothing, so a retry
     * cannot double the work list even if it crashed halfway through creating
     * it last time.
     */
    uniqueIndex('notification_delivery_recipient_unique_idx').on(
      table.outboxEntryId,
      table.recipientRoleCode,
    ),
    // The drain reads what is still owed, oldest first.
    index('notification_delivery_pending_idx')
      .on(table.statusCode, table.createdAt)
      .where(sql`${table.statusCode} in ('pending', 'failed')`),
    index('notification_delivery_entry_idx').on(table.outboxEntryId),
    index('notification_delivery_recipient_user_idx').on(table.recipientUserId),
  ],
);
