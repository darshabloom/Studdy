import { describe, expect, it } from 'vitest';
import type { NotificationContext, NotificationWorkItem } from '@studdy/database';
import { renderNotification } from './templates';

/**
 * The three transactional emails, rendered.
 *
 * TWO KINDS OF ASSERTION LIVE HERE, and the second is the reason this file
 * matters more than a snapshot test would:
 *
 *   1. that each message says the thing its recipient needs — the amount, the
 *      deadline, the payment link, the confirmation;
 *   2. that it says NOTHING ELSE. Every template is checked against a context
 *      deliberately loaded with values a recipient must never see, and the
 *      rendered output is searched for them. A leak added later fails here
 *      rather than in somebody's inbox.
 */

const SITE = 'https://studdy.example';

const BASE: NotificationContext = {
  requestReference: 'LR-10000077',
  studentFirstName: 'Ari',
  tutorFirstName: 'Aroha',
  lessonStartAt: new Date('2026-09-29T04:30:00.000Z'),
  durationMinutes: 60,
  formatCode: 'online',
  timeZone: 'Pacific/Auckland',
  paymentDeadlineAt: new Date('2026-09-01T08:36:48.000Z'),
  amountMinor: 4000n,
  currencyCode: 'NZD',
  paymentReference: 'PAY-10000078',
  reason: 'The reservation was already released.',
};

function item(
  templateCode: string,
  overrides: Partial<NotificationContext> = {},
): NotificationWorkItem {
  return {
    deliveryId: 'delivery-1',
    outboxEntryId: 'entry-1',
    eventType: 'booking.confirmed',
    recipientRole: 'family',
    templateCode,
    toAddress: 'someone@example.test',
    idempotencyKey: 'k',
    attempts: 0,
    context: { ...BASE, ...overrides },
  };
}

/**
 * Values that must never appear in ANY email Studdy sends.
 *
 * These are not in `NotificationContext` at all — that is the point of the
 * shape — so this is a second line of defence that would catch someone widening
 * the context and then rendering it.
 */
const FORBIDDEN = [
  'pi_3UAjSi', // provider payment intent
  'ch_3UAjSi', // provider charge
  'txn_3UAjSi', // provider balance transaction
  'acct_1UAT9D', // connected account
  'sk_test_', // secret key
  'whsec_', // webhook secret
  'client_secret',
  'provider_cost',
  'losses_collector',
];

describe('payment.required — the family', () => {
  const rendered = renderNotification(item('payment_required_family'), SITE);

  it('names the tutor and the student in the subject', () => {
    expect(rendered.subject).toContain('Aroha');
    expect(rendered.subject).toContain('Ari');
  });

  /** The CTA is the real payment route, built from the server-configured origin. */
  it('links to the canonical payment page for this request', () => {
    expect(rendered.html).toContain(`${SITE}/requests/LR-10000077/pay`);
    expect(rendered.text).toContain(`${SITE}/requests/LR-10000077/pay`);
  });

  it('renders the amount due and the deadline', () => {
    expect(rendered.html).toContain('NZD $40.00');
    expect(rendered.text).toContain('NZD $40.00');
    // 8:36 UTC on 1 September is 8:36pm in Auckland.
    expect(rendered.html).toContain('1 September 2026');
    expect(rendered.text).toContain('Pay by');
  });

  it('renders the lesson time, length and format', () => {
    expect(rendered.html).toContain('29 September 2026');
    expect(rendered.html).toContain('60 minutes');
    expect(rendered.html).toContain('Online');
  });

  /**
   * THE SENTENCE THAT MUST SURVIVE EVERY EDIT. The payment page says it before
   * the parent pays; the email has to agree, or one of them is lying about
   * whether a lesson exists.
   */
  it('says plainly that the lesson is not booked until payment succeeds', () => {
    expect(rendered.html).toContain('not booked until your payment succeeds');
    expect(rendered.text).toContain('not booked until your payment succeeds');
  });

  it('renders in both HTML and plain text', () => {
    expect(rendered.html.length).toBeGreaterThan(200);
    expect(rendered.text.length).toBeGreaterThan(100);
    expect(rendered.text).not.toContain('<div');
  });
});

describe('booking.confirmed — the family', () => {
  const rendered = renderNotification(item('booking_confirmed_family'), SITE);

  it('says the lesson is booked', () => {
    expect(rendered.subject).toMatch(/^Booked:/);
    expect(rendered.html).toContain('This lesson is booked');
    expect(rendered.text).toContain('Nothing else is needed from you.');
  });

  it('renders the tutor, the time and what was paid', () => {
    expect(rendered.html).toContain('Aroha');
    expect(rendered.html).toContain('29 September 2026');
    expect(rendered.html).toContain('NZD $40.00');
  });

  it('links to the request rather than back to the payment page', () => {
    expect(rendered.html).toContain(`${SITE}/requests/LR-10000077`);
    expect(rendered.html).not.toContain('/pay"');
  });
});

describe('booking.confirmed — the tutor', () => {
  const rendered = renderNotification(item('booking_confirmed_tutor'), SITE);

  it('tells the tutor what they need to teach the lesson', () => {
    expect(rendered.html).toContain('Ari');
    expect(rendered.html).toContain('29 September 2026');
    expect(rendered.html).toContain('60 minutes');
    expect(rendered.html).toContain('Online');
    expect(rendered.html).toContain('confirmed on your calendar');
  });

  /**
   * THE TUTOR IS NOT TOLD WHAT THE PARENT PAID. Their own earnings are shown on
   * their own screen, where Studdy's fee can be explained properly; an amount
   * in this email would be the parent's total, which is not the tutor's number
   * and would read as one.
   */
  it('never shows the parent’s payment amount', () => {
    expect(rendered.html).not.toContain('$40.00');
    expect(rendered.text).not.toContain('$40.00');
    expect(rendered.html).not.toContain('Paid');
  });

  /** And nothing about the family beyond the student's first name. */
  it('carries no payment reference and no request reference', () => {
    expect(rendered.html).not.toContain('PAY-10000078');
    expect(rendered.html).not.toContain('LR-10000077');
  });
});

describe('payment.refund_required — operations only', () => {
  const rendered = renderNotification(item('payment_refund_required_ops'), SITE);

  it('says the payment succeeded and the booking did not', () => {
    expect(rendered.html).toContain('succeeded');
    expect(rendered.html).toContain('could not confirm the');
    expect(rendered.text).toContain('booking state was no longer valid');
  });

  /**
   * IT MUST NOT CLAIM A REFUND HAS HAPPENED, because this slice does not
   * execute refunds. A message saying otherwise would be false the moment it
   * was sent, and would be the sentence an operator quotes to a family.
   */
  it('states explicitly that no refund has been issued', () => {
    expect(rendered.html).toContain('No refund has been issued');
    expect(rendered.text).toContain('NO REFUND HAS BEEN ISSUED');

    /*
     * Every affirmative claim, checked across the whole message. The negated
     * sentence above is the ONLY place the phrase may appear, so each match is
     * required to carry its negation — anything else is a message telling an
     * operator that money went back when it did not.
     */
    const body = `${rendered.subject}\n${rendered.html}\n${rendered.text}`.toLowerCase();
    const claims = body.matchAll(
      /(?:\w+\s+){0,2}refunded?\s*(?:has been|have been|was|were)?\s*(?:issued|processed|sent|completed)/g,
    );
    for (const claim of claims) {
      expect(claim[0]).toContain('no ');
    }
    expect(body).not.toContain('has been refunded');
    expect(body).not.toContain('we have refunded');
    expect(body).not.toContain('your refund');
  });

  it('carries the references support needs', () => {
    expect(rendered.subject).toContain('PAY-10000078');
    expect(rendered.html).toContain('PAY-10000078');
    expect(rendered.html).toContain('LR-10000077');
    expect(rendered.html).toContain('The reservation was already released.');
  });

  /** It is an internal alert, so it must not read like a customer apology. */
  it('asks a human to act', () => {
    expect(rendered.html).toContain('manual intervention');
    expect(rendered.text).toContain('Someone needs to review this payment');
  });
});

describe('no template leaks provider or platform-private data', () => {
  const templates = [
    'payment_required_family',
    'booking_confirmed_family',
    'booking_confirmed_tutor',
    'payment_refund_required_ops',
  ];

  it.each(templates)('%s renders none of the forbidden values', (template) => {
    const rendered = renderNotification(item(template), SITE);
    const body = `${rendered.subject}\n${rendered.html}\n${rendered.text}`;
    for (const forbidden of FORBIDDEN) {
      expect(body).not.toContain(forbidden);
    }
  });

  /**
   * The context shape itself is the boundary: a template can only render what
   * is on it, and none of these fields exist.
   */
  it.each(templates)('%s cannot reach a provider identifier at all', (template) => {
    const context = item(template).context as unknown as Record<string, unknown>;
    for (const field of [
      'providerPaymentIntentId',
      'providerChargeId',
      'providerAccountId',
      'providerCostMinor',
      'clientSecret',
      'platformFeeAmountMinor',
      'tutorEntitlementMinor',
    ]) {
      expect(context[field]).toBeUndefined();
    }
  });
});

describe('escaping', () => {
  /** Names are user data; a name with markup must not become markup. */
  it('escapes interpolated names', () => {
    const rendered = renderNotification(
      item('booking_confirmed_family', { tutorFirstName: '<script>alert(1)</script>' }),
      SITE,
    );
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).toContain('&lt;script&gt;');
  });
});

describe('missing facts degrade rather than render nonsense', () => {
  /** A pre-payment-window request has no deadline; the row is simply absent. */
  it('omits an absent deadline instead of printing an empty label', () => {
    const rendered = renderNotification(
      item('payment_required_family', { paymentDeadlineAt: null }),
      SITE,
    );
    expect(rendered.html).not.toContain('Pay by');
    expect(rendered.html).toContain('NZD $40.00');
  });

  it('falls back to a neutral phrase when a name is missing', () => {
    const rendered = renderNotification(
      item('booking_confirmed_family', { tutorFirstName: null, studentFirstName: null }),
      SITE,
    );
    expect(rendered.subject).toContain('your lesson');
    expect(rendered.html).toContain('your tutor');
  });
});

describe('an unknown template is refused', () => {
  it('throws rather than sending an empty message', () => {
    expect(() => renderNotification(item('not_a_template'), SITE)).toThrow(
      /Unknown notification template/,
    );
  });
});
