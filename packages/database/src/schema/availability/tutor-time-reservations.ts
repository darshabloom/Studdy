import { sql } from 'drizzle-orm';
import { check, index, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { availabilitySchema } from '../shared/schemas';
import { tutorProfiles } from '../tutors/tutor-profiles';
import { tutorRequests } from '../bookings/tutor-requests';

/**
 * `availability.tutor_time_reservations` — temporary calendar holds.
 *
 * Each Tutor Request holds the proposed slot independently while the tutor
 * decides. Overlapping ACTIVE reservations for one tutor are made
 * unrepresentable by a GiST exclusion constraint (Database spec §9.6), added
 * in reviewed SQL because Drizzle cannot express EXCLUDE:
 *
 *   exclude using gist (
 *     tutor_profile_id with =,
 *     tstzrange(start_at, end_at, '[)') with &&
 *   ) where (status_code = 'active')
 *
 * The tutor interface labels these as temporary and shows `expires_at`
 * (approved correction 3). When a request closes for any reason the hold is
 * released in the same transaction.
 */
export const tutorTimeReservations = availabilitySchema.table(
  'tutor_time_reservations',
  {
    ...standardColumns,
    tutorProfileId: uuid('tutor_profile_id')
      .notNull()
      .references(() => tutorProfiles.id, { onDelete: 'restrict' }),
    /**
     * The request this hold serves. Nullable because a confirmed booking will
     * later carry the same reservation row forward (selection slice).
     */
    tutorRequestId: uuid('tutor_request_id').references(() => tutorRequests.id, {
      onDelete: 'restrict',
    }),
    /** The lesson itself. Exactly what was offered, and never padded. */
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    /**
     * The tutor's minimum gap AS IT WAS when this reservation was taken.
     *
     * Snapshotted, like the deadline rule version on a request: a tutor who
     * widens their gap tomorrow must not retroactively invalidate a hold a
     * family already has, nor silently move the line under a lesson that was
     * agreed. The live value on the profile governs what can be taken NEXT.
     */
    gapMinutes: integer('gap_minutes').notNull().default(0),
    /**
     * `end_at + gap_minutes` — the interval this reservation actually blocks.
     *
     * The exclusion constraint compares THIS rather than the lesson, because
     * `tstzrange(start_at, end_at)` catches only true overlap: 5:00–6:00 and
     * 6:05–7:05 do not overlap and would both be accepted however large the
     * gap. It is stored rather than computed in the constraint because an
     * exclusion expression cannot reach the profile table, and because padding
     * `end_at` itself would corrupt the time the tutor and the family read.
     *
     * PADDED ON ONE SIDE ONLY. Both rows carry their own padding, so one gap
     * between them is enforced once; padding both sides of both rows would
     * demand two gaps. A new lesson placed too close BEFORE an existing one is
     * caught by its own padding running into that lesson's start.
     */
    effectiveEndAt: timestamp('effective_end_at', { withTimezone: true }).notNull(),
    /** active | released */
    statusCode: text('status_code').notNull().default('active'),
    /** request_hold | booking_confirmed (the latter arrives with selection). */
    reservationTypeCode: text('reservation_type_code').notNull().default('request_hold'),
    /** Shown to the tutor so a hold is never open-ended in appearance. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    releaseReasonCode: text('release_reason_code'),
  },
  (table) => [
    check('reservation_status_check', sql`${table.statusCode} in ('active', 'released')`),
    check(
      'reservation_type_check',
      sql`${table.reservationTypeCode} in ('request_hold', 'booking_confirmed')`,
    ),
    check('reservation_time_order_check', sql`${table.endAt} > ${table.startAt}`),
    check('reservation_gap_minutes_check', sql`${table.gapMinutes} >= 0`),
    // The effective end may equal the lesson end (a zero gap) but never precede
    // it: a reservation that blocked less than its own lesson would be a lie.
    check('reservation_effective_end_check', sql`${table.effectiveEndAt} >= ${table.endAt}`),
    index('reservation_tutor_active_idx')
      .on(table.tutorProfileId)
      .where(sql`${table.statusCode} = 'active'`),
    index('reservation_expiry_idx')
      .on(table.expiresAt)
      .where(sql`${table.statusCode} = 'active'`),
  ],
);
