import { describe, expect, it } from 'vitest';
import {
  DELIVERABLE_EVENT_TYPES,
  DELIVERY_STATUSES,
  RECIPIENT_ROLES,
  deliveryIdempotencyKey,
  isDeliverableEventType,
  recipientRolesFor,
  templateFor,
} from './delivery';

/**
 * Who gets told what — the product decision, tested where it lives.
 *
 * These are pure and cheap, and they are the assertions that would catch the
 * two mistakes that matter most: an operations alert acquiring a customer
 * recipient, and a confirmation quietly losing one.
 */

describe('the events this slice delivers', () => {
  /**
   * THREE, AND THE OUTBOX CARRIES MORE. `tutor_request.sent`,
   * `tutor_request.closed` and the rest are left `pending` on purpose; this
   * list is what stops the drain touching them.
   */
  it('delivers exactly the three payment-path events', () => {
    expect([...DELIVERABLE_EVENT_TYPES]).toEqual([
      'payment.required',
      'booking.confirmed',
      'payment.refund_required',
    ]);
  });

  it('does not claim the request-lifecycle events', () => {
    for (const type of [
      'tutor_request.sent',
      'tutor_request.accepted',
      'tutor_request.closed',
      'intended_lesson_request.expired',
    ]) {
      expect(isDeliverableEventType(type)).toBe(false);
    }
  });
});

describe('recipients', () => {
  it('sends payment.required to the family alone', () => {
    expect([...recipientRolesFor('payment.required')]).toEqual(['family']);
  });

  /** The fact the single-status outbox could not represent. */
  it('sends booking.confirmed to both the family and the tutor', () => {
    expect([...recipientRolesFor('booking.confirmed')]).toEqual(['family', 'tutor']);
  });

  /**
   * THE ALERT THAT MUST NEVER REACH A CUSTOMER. Studdy took a parent's money
   * and could not deliver the booking; a human decides what the family is told,
   * after they have looked. This is the assertion that fails if anyone adds a
   * "let the parent know too" recipient without that conversation.
   */
  it('sends payment.refund_required to operations and nobody else', () => {
    const roles = recipientRolesFor('payment.refund_required');
    expect([...roles]).toEqual(['ops']);
    expect(roles).not.toContain('family');
    expect(roles).not.toContain('tutor');
  });

  it('knows exactly three roles', () => {
    expect([...RECIPIENT_ROLES]).toEqual(['family', 'tutor', 'ops']);
  });
});

describe('templates', () => {
  it('pairs every event and role with its own template', () => {
    expect(templateFor('payment.required', 'family')).toBe('payment_required_family');
    expect(templateFor('booking.confirmed', 'family')).toBe('booking_confirmed_family');
    expect(templateFor('booking.confirmed', 'tutor')).toBe('booking_confirmed_tutor');
    expect(templateFor('payment.refund_required', 'ops')).toBe('payment_refund_required_ops');
  });

  /** The family and the tutor get DIFFERENT copy, not the same mail twice. */
  it('gives the family and the tutor different templates for one booking', () => {
    expect(templateFor('booking.confirmed', 'family')).not.toBe(
      templateFor('booking.confirmed', 'tutor'),
    );
  });

  it('refuses a pairing it has no copy for', () => {
    expect(() => templateFor('payment.required', 'tutor')).toThrow(/No template/);
    expect(() => templateFor('booking.confirmed', 'ops')).toThrow(/No template/);
  });

  /** Every declared recipient has somewhere to get its words from. */
  it('has a template for every event and recipient pair it declares', () => {
    for (const eventType of DELIVERABLE_EVENT_TYPES) {
      for (const role of recipientRolesFor(eventType)) {
        expect(templateFor(eventType, role)).toBeTruthy();
      }
    }
  });
});

describe('the delivery idempotency key', () => {
  /**
   * DETERMINISTIC, and used twice: as a unique column so a second delivery row
   * cannot exist, and as the provider's own key so a crash between "accepted"
   * and "recorded" cannot produce a second email.
   */
  it('is stable for the same event, entry and role', () => {
    const first = deliveryIdempotencyKey('booking.confirmed', 'entry-1', 'family');
    const second = deliveryIdempotencyKey('booking.confirmed', 'entry-1', 'family');
    expect(first).toBe(second);
  });

  it('differs per recipient of the same event', () => {
    expect(deliveryIdempotencyKey('booking.confirmed', 'entry-1', 'family')).not.toBe(
      deliveryIdempotencyKey('booking.confirmed', 'entry-1', 'tutor'),
    );
  });

  it('differs per event', () => {
    expect(deliveryIdempotencyKey('booking.confirmed', 'entry-1', 'family')).not.toBe(
      deliveryIdempotencyKey('payment.required', 'entry-1', 'family'),
    );
  });

  /** Resend keeps idempotency keys of up to 256 characters. */
  it('stays inside the provider limit even with a uuid entry id', () => {
    const key = deliveryIdempotencyKey(
      'payment.refund_required',
      '00000000-0000-0000-0000-000000000000',
      'ops',
    );
    expect(key.length).toBeLessThanOrEqual(256);
    expect(key).toBe('payment.refund_required/00000000-0000-0000-0000-000000000000/ops');
  });
});

describe('delivery statuses', () => {
  /**
   * `failed` IS NOT TERMINAL. A provider outage is the ordinary reason a send
   * fails, and the next drain retries it; what makes that safe is the
   * idempotency key, not a status that refuses to try again.
   */
  it('has exactly pending, sent and failed', () => {
    expect([...DELIVERY_STATUSES]).toEqual(['pending', 'sent', 'failed']);
  });
});
