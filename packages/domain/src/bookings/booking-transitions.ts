/**
 * The Booking's own state machine — the approved four states.
 *
 * `docs/decisions/multi-tutor-state-machine.md` settled this on 7 August 2026
 * and it overrides both competing lists in the planning pack (doc 09 §48 and
 * doc 10 §55). A Booking is the durable record of a lesson that was agreed and
 * paid for; everything that happens BEFORE that lives on the request state
 * machines, which is why the vocabulary here is short.
 *
 *     pending_payment → confirmed → completed
 *            ↓              ↓
 *        cancelled      cancelled
 *
 * ROWS ARE WRITTEN AT CONFIRMATION. In the one-off flow the Booking does not
 * exist while the family is still paying: the request is `awaiting_payment`
 * and that state already says everything a Booking row would. A row is created
 * by the fulfilment transaction, at `confirmed`. `pending_payment` stays in the
 * vocabulary because it is approved and because a later flow that creates the
 * row earlier (a recurring series generating bookings ahead of payment) needs
 * it — but nothing drives it today, and nothing should read it as evidence that
 * a payment is in flight.
 *
 * NO DATABASE TRIGGER, by the same approved decision: every command guards its
 * own move with `UPDATE ... WHERE status_code IN (...)`. These maps are what
 * those guards are written from, and the integration tests are the protection.
 */

export const BOOKING_STATUSES = ['pending_payment', 'confirmed', 'cancelled', 'completed'] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Statuses that still claim the tutor's time and a place on a calendar. */
export const ACTIVE_BOOKING_STATUSES: readonly BookingStatus[] = ['pending_payment', 'confirmed'];

const BOOKING_TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  pending_payment: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  /** Terminal. A cancelled lesson that is later rebooked is a NEW booking. */
  cancelled: [],
  /** Terminal. Corrections are recorded as adjustments, never as a re-opening. */
  completed: [],
};

export function canTransitionBooking(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to);
}

export function isTerminalBookingStatus(status: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[status].length === 0;
}

/** What a guarded `UPDATE ... WHERE status_code IN (...)` may move FROM, for a target. */
export function bookingStatusesThatMayMoveTo(target: BookingStatus): readonly BookingStatus[] {
  return BOOKING_STATUSES.filter((from) => canTransitionBooking(from, target));
}
