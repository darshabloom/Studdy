import 'server-only';
import type { NotificationContext, NotificationWorkItem } from '@studdy/database';

/**
 * The three transactional emails, as plain HTML and a text fallback.
 *
 * DELIBERATELY PLAIN. No layout system, no logo pipeline, no marketing voice
 * and no unsubscribe machinery — these are transactional messages a person is
 * owed because of something that happened to their money or their calendar, and
 * dressing them up would make them look like the mail people ignore. The
 * subject line says what happened; the body says what to do about it.
 *
 * A TEMPLATE CAN RENDER ONLY WHAT IS ON `NotificationContext`, which is the
 * privacy boundary expressed as a type. There is no payment intent id, no
 * connected account, no provider cost, no other tutor and no shortlist anywhere
 * in that shape — so "the tutor's email must not mention the parent's payment
 * method" is a property of the data, not something to remember while editing
 * copy.
 */

export interface RenderedEmail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

/** Escape everything interpolated. Names and references are still user data. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(minor: bigint | null, currency: string | null): string {
  if (minor === null || currency === null) return '';
  const major = Number(minor) / 100;
  return `${currency} $${major.toFixed(2)}`;
}

function formatWhen(at: Date | null, timeZone: string | null): string {
  if (at === null) return '';
  return new Intl.DateTimeFormat('en-NZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timeZone ?? 'Pacific/Auckland',
  }).format(at);
}

function formatFormat(code: string | null): string {
  if (code === null) return '';
  return code === 'online' ? 'Online' : 'In person';
}

/** A minimal shell: readable in any client, and no external assets. */
function page(heading: string, bodyHtml: string): string {
  return [
    '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;',
    'font-size:15px;line-height:1.5;color:#1c1c1e;max-width:560px;margin:0 auto;padding:24px">',
    `<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(heading)}</h1>`,
    bodyHtml,
    '<p style="font-size:13px;color:#6b6b70;margin-top:28px">Studdy</p>',
    '</div>',
  ].join('');
}

function detailRows(rows: readonly (readonly [string, string])[]): string {
  const cells = rows
    .filter(([, value]) => value !== '')
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#6b6b70">${escapeHtml(label)}</td>` +
        `<td style="padding:4px 0"><strong>${escapeHtml(value)}</strong></td></tr>`,
    )
    .join('');
  return `<table style="border-collapse:collapse;margin:12px 0">${cells}</table>`;
}

function detailLines(rows: readonly (readonly [string, string])[]): string {
  return rows
    .filter(([, value]) => value !== '')
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n');
}

function button(href: string, label: string): string {
  return (
    `<p style="margin:20px 0"><a href="${escapeHtml(href)}" ` +
    'style="background:#5b3df5;color:#ffffff;text-decoration:none;padding:11px 18px;' +
    `border-radius:6px;display:inline-block">${escapeHtml(label)}</a></p>`
  );
}

/**
 * The parent has chosen a tutor and the clock is running.
 *
 * THE MOST IMPORTANT SENTENCE IS THAT THE LESSON IS NOT BOOKED YET, and it
 * appears before the button rather than under it — the same promise the payment
 * page makes, so the email and the screen cannot say different things.
 */
function paymentRequiredFamily(context: NotificationContext, siteUrl: string): RenderedEmail {
  const tutor = context.tutorFirstName ?? 'your tutor';
  const student = context.studentFirstName;
  const payUrl = `${siteUrl}/requests/${context.requestReference ?? ''}/pay`;
  const rows: (readonly [string, string])[] = [
    ['Tutor', tutor],
    ['When', formatWhen(context.lessonStartAt, context.timeZone)],
    [
      'Length',
      context.durationMinutes === null ? '' : `${String(context.durationMinutes)} minutes`,
    ],
    ['Format', formatFormat(context.formatCode)],
    ['Amount due', formatMoney(context.amountMinor, context.currencyCode)],
    ['Pay by', formatWhen(context.paymentDeadlineAt, context.timeZone)],
  ];

  const subject = `Pay to confirm ${student === null ? 'your' : `${student}'s`} lesson with ${tutor}`;
  const html = page(
    'Your tutor is holding this time',
    [
      `<p>${escapeHtml(tutor)} has accepted${student === null ? '' : ` ${escapeHtml(student)}'s`} lesson time.</p>`,
      detailRows(rows),
      '<p><strong>This lesson is not booked until your payment succeeds.</strong> ',
      'If payment is not completed by the time above, the tutor&rsquo;s time is released ',
      'to other families.</p>',
      button(payUrl, 'Pay for this lesson'),
    ].join(''),
  );
  const text = [
    `${tutor} has accepted${student === null ? '' : ` ${student}'s`} lesson time.`,
    '',
    detailLines(rows),
    '',
    'This lesson is not booked until your payment succeeds. If payment is not',
    'completed by the time above, the time is released to other families.',
    '',
    `Pay for this lesson: ${payUrl}`,
    '',
    'Studdy',
  ].join('\n');

  return { subject, html, text };
}

/** The parent's money arrived and the lesson is real. */
function bookingConfirmedFamily(context: NotificationContext, siteUrl: string): RenderedEmail {
  const tutor = context.tutorFirstName ?? 'your tutor';
  const student = context.studentFirstName;
  const rows: (readonly [string, string])[] = [
    ['Tutor', tutor],
    ['When', formatWhen(context.lessonStartAt, context.timeZone)],
    [
      'Length',
      context.durationMinutes === null ? '' : `${String(context.durationMinutes)} minutes`,
    ],
    ['Format', formatFormat(context.formatCode)],
    ['Paid', formatMoney(context.amountMinor, context.currencyCode)],
  ];
  const requestUrl = `${siteUrl}/requests/${context.requestReference ?? ''}`;

  return {
    subject: `Booked: ${student === null ? 'your lesson' : `${student}'s lesson`} with ${tutor}`,
    html: page(
      'This lesson is booked',
      [
        `<p>Your payment went through and ${escapeHtml(tutor)} has this time reserved`,
        `${student === null ? '' : ` for ${escapeHtml(student)}`}. Nothing else is needed from you.</p>`,
        detailRows(rows),
        button(requestUrl, 'View your booking'),
      ].join(''),
    ),
    text: [
      `Your payment went through and ${tutor} has this time reserved${student === null ? '' : ` for ${student}`}.`,
      'Nothing else is needed from you.',
      '',
      detailLines(rows),
      '',
      `View your booking: ${requestUrl}`,
      '',
      'Studdy',
    ].join('\n'),
  };
}

/**
 * The tutor's copy of the same booking.
 *
 * A DIFFERENT TEMPLATE, NOT A DIFFERENT GREETING. The tutor is told the student
 * first name, the time, the length and the format — what they need to teach the
 * lesson. They are NOT told what the parent paid: the amount is on the family's
 * copy only, and the tutor's own earnings are shown on their own screen where
 * the fee split can be explained properly.
 */
function bookingConfirmedTutor(context: NotificationContext, siteUrl: string): RenderedEmail {
  const student = context.studentFirstName ?? 'a student';
  const rows: (readonly [string, string])[] = [
    ['Student', student],
    ['When', formatWhen(context.lessonStartAt, context.timeZone)],
    [
      'Length',
      context.durationMinutes === null ? '' : `${String(context.durationMinutes)} minutes`,
    ],
    ['Format', formatFormat(context.formatCode)],
  ];
  const scheduleUrl = `${siteUrl}/tutor/availability`;

  return {
    subject: `Booked: your lesson with ${student}`,
    html: page(
      'This lesson is booked',
      [
        `<p>The family has paid, and this time is confirmed on your calendar.</p>`,
        detailRows(rows),
        button(scheduleUrl, 'View your calendar'),
      ].join(''),
    ),
    text: [
      'The family has paid, and this time is confirmed on your calendar.',
      '',
      detailLines(rows),
      '',
      `View your calendar: ${scheduleUrl}`,
      '',
      'Studdy',
    ].join('\n'),
  };
}

/**
 * An operations alert. NEVER a customer message.
 *
 * IT DOES NOT CLAIM A REFUND HAS HAPPENED, because none has: this slice does
 * not execute refunds, and a message saying otherwise would be false at the
 * moment it was sent. It says money arrived, the booking could not be
 * confirmed, and a person now has to act — with the references support needs to
 * find it, and no provider identifier at all.
 */
function paymentRefundRequiredOps(context: NotificationContext, siteUrl: string): RenderedEmail {
  const rows: (readonly [string, string])[] = [
    ['Payment', context.paymentReference ?? ''],
    ['Request', context.requestReference ?? ''],
    ['Amount taken', formatMoney(context.amountMinor, context.currencyCode)],
    ['Why fulfilment stopped', context.reason ?? ''],
  ];

  return {
    subject: `Action needed: payment succeeded but the booking was not confirmed (${context.paymentReference ?? 'unknown'})`,
    html: page(
      'A payment needs manual intervention',
      [
        '<p>A Stripe payment <strong>succeeded</strong>, but Studdy could not confirm the ',
        'booking because the booking state was no longer valid. The payment is recorded as ',
        'succeeded and flagged as requiring a refund.</p>',
        detailRows(rows),
        '<p><strong>No refund has been issued.</strong> Studdy does not process refunds ',
        'automatically. Someone needs to review this payment and refund it in Stripe, and ',
        'decide what the family is told.</p>',
        `<p style="font-size:13px;color:#6b6b70">${escapeHtml(siteUrl)}</p>`,
      ].join(''),
    ),
    text: [
      'A Stripe payment SUCCEEDED, but Studdy could not confirm the booking because the',
      'booking state was no longer valid. The payment is recorded as succeeded and flagged',
      'as requiring a refund.',
      '',
      detailLines(rows),
      '',
      'NO REFUND HAS BEEN ISSUED. Studdy does not process refunds automatically.',
      'Someone needs to review this payment, refund it in Stripe, and decide what the',
      'family is told.',
      '',
      'Studdy',
    ].join('\n'),
  };
}

/**
 * Render one work item.
 *
 * The template is chosen by the stored `template_code`, which the domain
 * decided from (event, role) — so the worker never picks copy, and a delivery
 * row always says exactly which message it was.
 */
export function renderNotification(item: NotificationWorkItem, siteUrl: string): RenderedEmail {
  switch (item.templateCode) {
    case 'payment_required_family':
      return paymentRequiredFamily(item.context, siteUrl);
    case 'booking_confirmed_family':
      return bookingConfirmedFamily(item.context, siteUrl);
    case 'booking_confirmed_tutor':
      return bookingConfirmedTutor(item.context, siteUrl);
    case 'payment_refund_required_ops':
      return paymentRefundRequiredOps(item.context, siteUrl);
    default:
      throw new Error(`Unknown notification template: ${item.templateCode}`);
  }
}
