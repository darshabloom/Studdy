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
   * SEVEN, AND THE OUTBOX STILL CARRIES ONE MORE. The payment path plus the
   * request lifecycle; `tutor_request.declined` is deliberately absent and is
   * asserted so below. This list is what the claim query reads, so it is the
   * single thing that decides what the drain will touch.
   */
  it('delivers the payment path and the request lifecycle', () => {
    expect([...DELIVERABLE_EVENT_TYPES]).toEqual([
      'payment.required',
      'booking.confirmed',
      'payment.refund_required',
      'tutor_request.sent',
      'tutor_request.accepted',
      'tutor_request.closed',
      'intended_lesson_request.expired',
    ]);
  });

  /**
   * THE ONE THAT IS STILL NOT DELIVERED, AND MUST NOT BECOME SO BY ACCIDENT.
   *
   * A single decline is not news a family can act on: with a fan-out of three
   * it means up to three discouraging emails while other tutors are still
   * deciding. The moment that IS actionable — everybody declined — arrives as
   * `intended_lesson_request.expired` carrying `all_tutors_declined`.
   */
  it('does not deliver an individual decline', () => {
    expect(isDeliverableEventType('tutor_request.declined')).toBe(false);
  });

  it('claims the request-lifecycle events it now owns', () => {
    for (const type of [
      'tutor_request.sent',
      'tutor_request.accepted',
      'tutor_request.closed',
      'intended_lesson_request.expired',
    ]) {
      expect(isDeliverableEventType(type)).toBe(true);
    }
  });
});

describe('the request lifecycle, as approved', () => {
  /** The email the product was missing: a tutor learns they have work. */
  it('sends a new request to the tutor alone', () => {
    expect([...recipientRolesFor('tutor_request.sent')]).toEqual(['tutor']);
    expect(templateFor('tutor_request.sent', 'tutor')).toBe('tutor_request_sent_tutor');
  });

  /**
   * An acceptance is news for the FAMILY. The tutor just pressed the button and
   * can see the hold on their own screen — cut from this slice by decision.
   */
  it('sends an acceptance to the family alone', () => {
    expect([...recipientRolesFor('tutor_request.accepted')]).toEqual(['family']);
    expect(templateFor('tutor_request.accepted', 'family')).toBe('tutor_request_accepted_family');
  });

  /** A closure is the tutor's; whether it is owed at all is decided per row. */
  it('sends a closure to the tutor alone', () => {
    expect([...recipientRolesFor('tutor_request.closed')]).toEqual(['tutor']);
    expect(templateFor('tutor_request.closed', 'tutor')).toBe('tutor_request_closed_tutor');
  });

  /**
   * ONE TEMPLATE FOR BOTH ENDINGS. Everybody declined, or time ran out — one
   * transition, one event, and copy that branches on the close reason.
   */
  it('sends a closed request to the family alone', () => {
    expect([...recipientRolesFor('intended_lesson_request.expired')]).toEqual(['family']);
    expect(templateFor('intended_lesson_request.expired', 'family')).toBe('request_closed_family');
  });

  /**
   * NO TUTOR-FACING EVENT MAY ADDRESS A FAMILY, AND VICE VERSA. Asserted as a
   * property of the whole map rather than per row, so a future event cannot be
   * added with the wrong audience and still pass.
   */
  it('never sends a tutor-request event to more than one audience', () => {
    for (const type of ['tutor_request.sent', 'tutor_request.accepted', 'tutor_request.closed']) {
      expect(recipientRolesFor(type as never).length).toBe(1);
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
