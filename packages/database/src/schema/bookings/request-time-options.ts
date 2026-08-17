import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  text,
  time,
  timestamp,
  uuid,
  unique,
} from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { bookingsSchema } from '../shared/schemas';
import { intendedLessonRequests } from './intended-lesson-requests';

/**
 * `bookings.request_time_options` — the family's acceptable times (design §4.3).
 *
 * SERVER-ONLY, FAMILY-SIDE. **No tutor projection ever reads this table.** It
 * holds the family's *whole* set, and the size of that set alone would tell a
 * tutor how flexible the family is — and by extension how likely they are to
 * have other options. A tutor sees only their own subset, in
 * `tutor_request_time_options`.
 *
 * Both the instant and the local wall-clock are stored. The instant is what
 * everything compares against; the local date, time and zone are what the
 * family actually chose, kept so a rendered time can never drift from what they
 * were shown even if zone rules change beneath it.
 */
export const requestTimeOptions = bookingsSchema.table(
  'request_time_options',
  {
    ...standardColumns,
    intendedLessonRequestId: uuid('intended_lesson_request_id')
      .notNull()
      .references(() => intendedLessonRequests.id, { onDelete: 'restrict' }),
    /** 1–5, the order the family listed them in. */
    position: integer('position').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    localDate: date('local_date').notNull(),
    localStartTime: time('local_start_time').notNull(),
    ianaTimeZone: text('iana_time_zone').notNull(),
    /** offered | taken | lapsed | withdrawn */
    statusCode: text('status_code').notNull().default('offered'),
  },
  (table) => [
    unique('request_time_option_position_unique').on(table.intendedLessonRequestId, table.position),
    check(
      'request_time_option_status_check',
      sql`${table.statusCode} in ('offered', 'taken', 'lapsed', 'withdrawn')`,
    ),
    check('request_time_option_time_order', sql`${table.endsAt} > ${table.startsAt}`),
    // A sixth option is unrepresentable rather than merely rejected, mirroring
    // the shortlist cap: the bound is a property of the data, not of whichever
    // code path happened to write it.
    check('request_time_option_position_range', sql`${table.position} between 1 and 5`),
    index('request_time_option_request_idx').on(table.intendedLessonRequestId),
    // The expiry sweep lapses options whose start has passed.
    index('request_time_option_open_start_idx')
      .on(table.startsAt)
      .where(sql`${table.statusCode} = 'offered'`),
  ],
);
