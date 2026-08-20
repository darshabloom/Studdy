import { sql } from 'drizzle-orm';
import { check, index, text, timestamp, uniqueIndex, uuid, unique } from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { bookingsSchema } from '../shared/schemas';
import { requestTimeOptions } from './request-time-options';
import { tutorRequests } from './tutor-requests';

/**
 * `bookings.tutor_request_time_options` — what ONE tutor was offered (design §4.4).
 *
 * This is the tutor-facing half of the option model, and the only one a tutor
 * projection may read. It carries their own subset and nothing about the size
 * or content of the family's full set.
 *
 * TIMES ARE SNAPSHOTTED, not joined from `request_time_options` at read time.
 * This row is the record of what this tutor was actually offered; a later
 * change to the family's options must not rewrite that history.
 */
export const tutorRequestTimeOptions = bookingsSchema.table(
  'tutor_request_time_options',
  {
    ...standardColumns,
    tutorRequestId: uuid('tutor_request_id')
      .notNull()
      .references(() => tutorRequests.id, { onDelete: 'restrict' }),
    /**
     * The family option this mirrors. Server-side integrity only — never
     * selected by a tutor-facing projection, since it is an identifier from
     * the family's side of the boundary.
     */
    requestTimeOptionId: uuid('request_time_option_id')
      .notNull()
      .references(() => requestTimeOptions.id, { onDelete: 'restrict' }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    /** offered | claimed | unavailable | lapsed */
    statusCode: text('status_code').notNull().default('offered'),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    /**
     * When the option was detected to be no longer takeable.
     *
     * The timestamp records *when*, never *why*. `unavailable` is the single
     * bucket for every cause — this tutor's own calendar filling, the family
     * withdrawing the option, another tutor claiming the underlying time — and
     * it must stay that way: a status or a rendering that separated them would
     * tell a tutor that someone else acted.
     */
    unavailableDetectedAt: timestamp('unavailable_detected_at', { withTimezone: true }),
  },
  (table) => [
    unique('tutor_request_time_option_unique').on(table.tutorRequestId, table.requestTimeOptionId),
    // D-4 made unrepresentable rather than merely guarded: one Tutor Request
    // can hold at most one claimed time, enforced by the database even if an
    // application guard were wrong.
    uniqueIndex('tutor_request_time_option_one_claim')
      .on(table.tutorRequestId)
      .where(sql`${table.statusCode} = 'claimed'`),
    check(
      'tutor_request_time_option_status_check',
      sql`${table.statusCode} in ('offered', 'claimed', 'unavailable', 'lapsed')`,
    ),
    check('tutor_request_time_option_time_order', sql`${table.endsAt} > ${table.startsAt}`),
    index('tutor_request_time_option_request_idx').on(table.tutorRequestId),
  ],
);
