/**
 * Transactional notifications — the vocabulary, and nothing that sends.
 *
 * PURE, PROVIDER-NEUTRAL AND DATABASE-FREE. Which recipients a domain event
 * owes a message to is a product decision, so it lives here rather than in the
 * worker that happens to do the sending. Swapping Resend for something else,
 * or the Inngest drain for a different scheduler, must not be able to change
 * who gets told what.
 *
 * THIS IS A TRANSACTIONAL NOTIFICATION SLICE, NOT A MESSAGING SYSTEM. There are
 * no preferences, no subscriptions, no channels beyond email, and no campaign
 * vocabulary. Every message here is a consequence of something the recipient
 * did or is owed, which is exactly why none of them is optional.
 */

/**
 * Outbox event types this slice delivers.
 *
 * ONE TYPE IS STILL DELIBERATELY ABSENT: `tutor_request.declined`.
 *
 * A single tutor declining is not news a family can act on. With a fan-out of
 * three, emailing each one means up to three discouraging messages while other
 * tutors are still deciding, and nothing to do about any of them. The moment
 * that IS actionable — every tutor has declined, so the request is dead — is
 * not this event at all: it is the request closing, which arrives as
 * `intended_lesson_request.expired` carrying `all_tutors_declined`.
 *
 * An event type absent from this list is left `pending` and untouched, never
 * marked failed: nothing is wrong with it, and it must still be there if a
 * later slice decides it is owed to somebody.
 *
 * An event type absent from this list is left `pending` and untouched, never
 * marked failed: nothing is wrong with it, and it must still be there when its
 * own slice arrives.
 */
export const DELIVERABLE_EVENT_TYPES = [
  'payment.required',
  'booking.confirmed',
  'payment.refund_required',
  // The request lifecycle (feat/tutor-request-notifications).
  'tutor_request.sent',
  'tutor_request.accepted',
  'tutor_request.closed',
  'intended_lesson_request.expired',
] as const;

export type DeliverableEventType = (typeof DELIVERABLE_EVENT_TYPES)[number];

export function isDeliverableEventType(value: string): value is DeliverableEventType {
  return (DELIVERABLE_EVENT_TYPES as readonly string[]).includes(value);
}

/**
 * Who a notification is for.
 *
 * A ROLE, NOT A PERSON. The role decides the template and what that template is
 * allowed to say; the actual address is resolved server-side from Studdy's own
 * records at delivery time. Keeping the two apart is what makes "the tutor sees
 * only their own booking" a property of the code rather than of a careful query
 * somebody wrote once.
 */
export const RECIPIENT_ROLES = [
  /** The parent or guardian who made the request and pays for it. */
  'family',
  /** The tutor who was selected. */
  'tutor',
  /** Studdy operations. Never a customer. */
  'ops',
] as const;

export type RecipientRole = (typeof RECIPIENT_ROLES)[number];

/**
 * Which recipients each event owes a message to.
 *
 * ONE DOMAIN EVENT, POSSIBLY SEVERAL MESSAGES — and this is the fact the
 * original outbox row cannot represent, because it carries one status for the
 * whole event. `booking.confirmed` owes the family one email and the tutor a
 * different one, each with its own template and its own failure mode.
 *
 * `payment.refund_required` is an OPERATIONS ALERT and goes nowhere near a
 * customer. Studdy took a parent's money and could not deliver the booking;
 * telling the parent anything at this point would either promise a refund that
 * has not happened or explain an internal failure they cannot act on. A human
 * decides what the family is told, after they have looked.
 */
const RECIPIENTS_BY_EVENT: Record<DeliverableEventType, readonly RecipientRole[]> = {
  'payment.required': ['family'],
  'booking.confirmed': ['family', 'tutor'],
  'payment.refund_required': ['ops'],
  /*
   * THE ONE THAT MATTERS MOST. Until this, a tutor learned they had work only
   * by logging in — against a response deadline measured in hours.
   */
  'tutor_request.sent': ['tutor'],
  /*
   * The FAMILY, not the tutor. An acceptance is new information to the family
   * — another option they can now choose. The tutor just pressed the button
   * and can see the hold on their own screen, so telling them again is noise
   * (cut from this slice by decision, not by oversight).
   */
  'tutor_request.accepted': ['family'],
  /*
   * The tutor, and ONLY where they had time held — see `closureOwesTheTutor`
   * in the repository. A tutor who never responded has nothing released and
   * nothing to do.
   */
  'tutor_request.closed': ['tutor'],
  /*
   * The family, whether the request ran out of time or every tutor declined.
   * ONE EVENT, because it is one transition: the request closed without a
   * booking. The copy distinguishes the two; the delivery does not need to.
   */
  'intended_lesson_request.expired': ['family'],
};

export function recipientRolesFor(eventType: DeliverableEventType): readonly RecipientRole[] {
  return RECIPIENTS_BY_EVENT[eventType];
}

/**
 * The template each (event, recipient) pair renders.
 *
 * Named rather than derived, so the pairing is greppable and a missing template
 * is a type error rather than a string that silently resolves to nothing.
 */
export const NOTIFICATION_TEMPLATES = [
  'payment_required_family',
  'booking_confirmed_family',
  'booking_confirmed_tutor',
  'payment_refund_required_ops',
  'tutor_request_sent_tutor',
  'tutor_request_accepted_family',
  'tutor_request_closed_tutor',
  'request_closed_family',
] as const;

export type NotificationTemplate = (typeof NOTIFICATION_TEMPLATES)[number];

const TEMPLATE_BY_EVENT_AND_ROLE: Record<string, NotificationTemplate> = {
  'payment.required:family': 'payment_required_family',
  'booking.confirmed:family': 'booking_confirmed_family',
  'booking.confirmed:tutor': 'booking_confirmed_tutor',
  'payment.refund_required:ops': 'payment_refund_required_ops',
  'tutor_request.sent:tutor': 'tutor_request_sent_tutor',
  'tutor_request.accepted:family': 'tutor_request_accepted_family',
  'tutor_request.closed:tutor': 'tutor_request_closed_tutor',
  /*
   * ONE TEMPLATE FOR BOTH ENDINGS, branching on the close reason inside.
   * Keying this map on the reason as well would make the (event, role) pair
   * stop being a pair, for two messages that differ by one sentence.
   */
  'intended_lesson_request.expired:family': 'request_closed_family',
};

export function templateFor(
  eventType: DeliverableEventType,
  role: RecipientRole,
): NotificationTemplate {
  const template = TEMPLATE_BY_EVENT_AND_ROLE[`${eventType}:${role}`];
  if (template === undefined) {
    throw new Error(`No template for ${eventType} to ${role}.`);
  }
  return template;
}

/**
 * A single recipient's delivery state.
 *
 * `failed` is NOT terminal here, and that is deliberate: a provider outage is
 * the ordinary reason a send fails, and the row is retried on the next drain
 * with its attempt count incremented. What makes retrying safe is the
 * deterministic idempotency key, not a status that refuses to try again.
 */
export const DELIVERY_STATUSES = ['pending', 'sent', 'failed'] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/**
 * The delivery idempotency key for one recipient of one outbox entry.
 *
 * DETERMINISTIC, so the same logical message computes the same key on every
 * retry, in every worker, forever. It is used twice over:
 *
 *   1. as a UNIQUE column, so the database refuses a second delivery row for
 *      the same (event, recipient); and
 *   2. as the PROVIDER's idempotency key, which is the only available answer to
 *      a worker that crashes after the provider accepted the message but before
 *      Studdy recorded it. The two writes cannot be made atomic — the provider
 *      is not in the transaction — so the retry is instead made harmless at the
 *      far end.
 *
 * `<event-type>/<outbox-entry-id>/<role>` is Resend's own recommended shape and
 * is well inside its 256-character limit.
 */
export function deliveryIdempotencyKey(
  eventType: DeliverableEventType,
  outboxEntryId: string,
  role: RecipientRole,
): string {
  return `${eventType}/${outboxEntryId}/${role}`;
}
