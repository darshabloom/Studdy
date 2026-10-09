import { sql } from 'drizzle-orm';
import {
  bigint,
  char,
  check,
  date,
  index,
  integer,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { bookingsSchema } from '../shared/schemas';
import { users } from '../identity/users';
import { familyAccounts } from '../families/family-accounts';
import { studentProfiles } from '../students/student-profiles';
import { studentSubjectSections } from '../students/student-subject-sections';
import { tutorProfiles } from '../tutors/tutor-profiles';
import { serviceVersions } from '../services/services';
import { subjects } from '../platform/subjects';
import { tutorTimeReservations } from '../availability/tutor-time-reservations';
import { payments } from '../payments/payments';
import { intendedLessonRequests } from './intended-lesson-requests';
import { tutorRequests } from './tutor-requests';

/**
 * `bookings.bookings` — the permanent record of a lesson that was agreed and
 * paid for.
 *
 * WHY THIS TABLE EXISTS. Until now a confirmed booking was a CONVENTION: an
 * intended lesson request at `fulfilled`, plus a reservation carried forward to
 * `booking_confirmed`, plus a payment. Three rows that together meant "booked"
 * and none of which could be pointed at as the booking. Lessons, homework,
 * progress, rescheduling, cancellation, refunds against a lesson and the
 * tutor's calendar all need something to attach to, and each of them would have
 * invented its own join across those three. This is the entity they attach to.
 *
 * THE FOUR-STATE VOCABULARY IS APPROVED (`docs/decisions/multi-tutor-state-
 * machine.md`, 7 Aug 2026) and overrides the planning pack's longer lists. A row
 * is WRITTEN AT CONFIRMATION, inside the fulfilment transaction, so in the
 * one-off flow it is born `confirmed`. Everything before that lives on the
 * request state machines.
 *
 * THE SCHEDULE AND THE MONEY ARE SNAPSHOTS. A booking must keep telling the
 * truth about what was agreed after the tutor edits their service, after the
 * commission changes, after the family's address changes. So the lesson's time,
 * format, duration and price are copied here, once, from the immutable rows
 * they came from, and are never recomputed. The foreign keys say WHERE they
 * came from; the columns say WHAT WAS AGREED, and only the second is allowed to
 * answer a dispute.
 *
 * NOT ON THIS TABLE, deliberately:
 *   - what actually HAPPENED at the lesson — attendance, notes, outcomes belong
 *     to the Lesson record (planning pack §9.3: "Booking is what was agreed,
 *     Lesson is what happened"), which does not exist yet;
 *   - payment state — read from the payment, which is the one authority on it;
 *     a denormalised copy here would be a second place for it to be wrong.
 */
export const bookings = bookingsSchema.table(
  'bookings',
  {
    ...standardColumns,
    reference: text('reference')
      .notNull()
      .unique()
      .default(sql`'BK-' || lpad(nextval('platform.global_reference_seq')::text, 8, '0')`),

    // --- where it came from ------------------------------------------------
    /** Not unique: a replacement booking for the same request is a future case. */
    intendedLessonRequestId: uuid('intended_lesson_request_id')
      .notNull()
      .references(() => intendedLessonRequests.id, { onDelete: 'restrict' }),
    /** The tutor request that won. ONE BOOKING PER WINNING REQUEST, enforced below. */
    selectedTutorRequestId: uuid('selected_tutor_request_id')
      .notNull()
      .references(() => tutorRequests.id, { onDelete: 'restrict' }),
    /**
     * The payment that confirmed it. Nullable because a later flow (a package, a
     * recurring series) confirms without a one-off payment; unique where set.
     */
    paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'restrict' }),
    /**
     * The claim on the tutor's calendar, carried forward from the hold. The same
     * row is the hold, then the booking's claim — so the exclusion constraint
     * never sees a gap another family could slip through.
     */
    reservationId: uuid('reservation_id')
      .notNull()
      .references(() => tutorTimeReservations.id, { onDelete: 'restrict' }),

    // --- who ---------------------------------------------------------------
    studentProfileId: uuid('student_profile_id')
      .notNull()
      .references(() => studentProfiles.id, { onDelete: 'restrict' }),
    studentSubjectSectionId: uuid('student_subject_section_id')
      .notNull()
      .references(() => studentSubjectSections.id, { onDelete: 'restrict' }),
    tutorProfileId: uuid('tutor_profile_id')
      .notNull()
      .references(() => tutorProfiles.id, { onDelete: 'restrict' }),
    /** Null for an independent student acting alone. */
    familyAccountId: uuid('family_account_id').references(() => familyAccounts.id, {
      onDelete: 'restrict',
    }),
    /** Who agreed and paid. */
    bookedByUserId: uuid('booked_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    // --- what ---------------------------------------------------------------
    serviceVersionId: uuid('service_version_id')
      .notNull()
      .references(() => serviceVersions.id, { onDelete: 'restrict' }),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'restrict' }),

    // --- state -------------------------------------------------------------
    /** pending_payment | confirmed | cancelled | completed (approved four). */
    statusCode: text('status_code').notNull().default('confirmed'),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    // --- the schedule, as agreed -------------------------------------------
    scheduledStartAt: timestamp('scheduled_start_at', { withTimezone: true }).notNull(),
    scheduledEndAt: timestamp('scheduled_end_at', { withTimezone: true }).notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    /** IANA zone the lesson was agreed in, so "4pm" stays 4pm across DST. */
    ianaTimeZone: text('iana_time_zone').notNull(),
    /** The calendar date and wall-clock start in that zone, for display and series. */
    localDate: date('local_date', { mode: 'string' }).notNull(),
    localStartTime: time('local_start_time').notNull(),
    lessonFormatCode: text('lesson_format_code').notNull(),

    // --- the price, as agreed ----------------------------------------------
    currencyCode: char('currency_code', { length: 3 }).notNull(),
    lessonAmountMinor: bigint('lesson_amount_minor', { mode: 'bigint' }).notNull(),
    totalChargedMinor: bigint('total_charged_minor', { mode: 'bigint' }).notNull(),
    platformFeeAmountMinor: bigint('platform_fee_amount_minor', { mode: 'bigint' }).notNull(),
    tutorEntitlementMinor: bigint('tutor_entitlement_minor', { mode: 'bigint' }).notNull(),
  },
  (table) => [
    check(
      'booking_status_check',
      sql`${table.statusCode} in ('pending_payment', 'confirmed', 'cancelled', 'completed')`,
    ),
    check('booking_time_order_check', sql`${table.scheduledEndAt} > ${table.scheduledStartAt}`),
    check('booking_duration_positive_check', sql`${table.durationMinutes} > 0`),
    check('booking_format_check', sql`${table.lessonFormatCode} in ('online', 'in_person')`),
    check('booking_currency_check', sql`${table.currencyCode} ~ '^[A-Z]{3}$'`),
    // The same invariants the payment holds, restated where the booking stands alone.
    check(
      'booking_amounts_check',
      sql`${table.lessonAmountMinor} >= 0
        and ${table.platformFeeAmountMinor} >= 0
        and ${table.tutorEntitlementMinor} >= 0
        and ${table.platformFeeAmountMinor} + ${table.tutorEntitlementMinor} = ${table.lessonAmountMinor}
        and ${table.totalChargedMinor} >= ${table.lessonAmountMinor}`,
    ),
    // A booking carries the timestamp of the status it is in — no more, no less.
    check(
      'booking_status_timestamps_check',
      sql`(${table.statusCode} <> 'confirmed' or ${table.confirmedAt} is not null)
        and (${table.statusCode} <> 'cancelled' or ${table.cancelledAt} is not null)
        and (${table.statusCode} <> 'completed' or ${table.completedAt} is not null)`,
    ),

    // ONE BOOKING PER WINNING TUTOR REQUEST, and one per payment. The fulfilment
    // transaction can then insert with ON CONFLICT DO NOTHING and stay idempotent
    // even against a hand-run caller.
    uniqueIndex('booking_selected_tutor_request_unique_idx').on(table.selectedTutorRequestId),
    uniqueIndex('booking_payment_unique_idx')
      .on(table.paymentId)
      .where(sql`${table.paymentId} is not null`),
    uniqueIndex('booking_reservation_unique_idx').on(table.reservationId),

    // The reads every role will make: my lessons, soonest first.
    index('booking_tutor_start_idx').on(table.tutorProfileId, table.scheduledStartAt),
    index('booking_student_start_idx').on(table.studentProfileId, table.scheduledStartAt),
    index('booking_family_start_idx')
      .on(table.familyAccountId, table.scheduledStartAt)
      .where(sql`${table.familyAccountId} is not null`),
    // What the completion and settlement runs scan: confirmed lessons by end time.
    index('booking_confirmed_end_idx')
      .on(table.scheduledEndAt)
      .where(sql`${table.statusCode} = 'confirmed'`),
  ],
);
