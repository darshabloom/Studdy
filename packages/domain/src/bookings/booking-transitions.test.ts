import { describe, expect, it } from 'vitest';
import {
  ACTIVE_BOOKING_STATUSES,
  BOOKING_STATUSES,
  bookingStatusesThatMayMoveTo,
  canTransitionBooking,
  isTerminalBookingStatus,
} from './booking-transitions';

describe('the Booking state machine', () => {
  it('keeps exactly the four approved statuses', () => {
    expect([...BOOKING_STATUSES]).toEqual([
      'pending_payment',
      'confirmed',
      'cancelled',
      'completed',
    ]);
  });

  it('allows the approved forward paths', () => {
    expect(canTransitionBooking('pending_payment', 'confirmed')).toBe(true);
    expect(canTransitionBooking('pending_payment', 'cancelled')).toBe(true);
    expect(canTransitionBooking('confirmed', 'completed')).toBe(true);
    expect(canTransitionBooking('confirmed', 'cancelled')).toBe(true);
  });

  it('never re-opens a terminal booking', () => {
    for (const terminal of ['cancelled', 'completed'] as const) {
      expect(isTerminalBookingStatus(terminal)).toBe(true);
      for (const to of BOOKING_STATUSES) {
        expect(canTransitionBooking(terminal, to)).toBe(false);
      }
    }
  });

  it('does not move backwards or skip confirmation', () => {
    expect(canTransitionBooking('confirmed', 'pending_payment')).toBe(false);
    expect(canTransitionBooking('pending_payment', 'completed')).toBe(false);
  });

  it('has no self-transitions, so a repeated command matches zero rows', () => {
    for (const status of BOOKING_STATUSES) {
      expect(canTransitionBooking(status, status)).toBe(false);
    }
  });

  it('derives the guard set for an UPDATE from the map', () => {
    expect(bookingStatusesThatMayMoveTo('cancelled')).toEqual(['pending_payment', 'confirmed']);
    expect(bookingStatusesThatMayMoveTo('completed')).toEqual(['confirmed']);
    expect(bookingStatusesThatMayMoveTo('confirmed')).toEqual(['pending_payment']);
  });

  it('counts only the non-terminal statuses as active', () => {
    expect([...ACTIVE_BOOKING_STATUSES]).toEqual(['pending_payment', 'confirmed']);
    for (const status of ACTIVE_BOOKING_STATUSES) {
      expect(isTerminalBookingStatus(status)).toBe(false);
    }
  });
});
