import 'server-only';
import type { NotificationContext, NotificationWorkItem } from '@studdy/database';

/**
 * The transactional emails, as plain HTML and a text fallback.
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

/* -------------------------------------------------------------------------- */
/* The request lifecycle                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A family has asked this tutor for a lesson. THE EMAIL THE PRODUCT WAS MISSING.
 *
 * Until this existed a tutor discovered work only by logging in, against a
 * response deadline measured in hours.
 *
 * NOTHING HERE HINTS AT A COMPETITOR. No `LR-` reference, no position, no
 * count, and only this tutor's own offered times — the size of the family's
 * full set would itself say how flexible they are. The template could not
 * render any of it if it tried: none of it is on `NotificationContext` for
 * this event.
 */
function tutorRequestSentTutor(context: NotificationContext, siteUrl: string): RenderedEmail {
  const student = context.studentFirstName ?? 'a student';
  const subjectName = context.subjectDisplayName ?? 'a lesson';
  const respondUrl = `${siteUrl}/tutor/requests/${context.tutorRequestReference ?? ''}`;
  const times = context.offeredStartAts.map((at) => formatWhen(at, context.timeZone));

  const rows: (readonly [string, string])[] = [
    ['Subject', subjectName],
    ['Student', student],
    [
      'Length',
      context.durationMinutes === null ? '' : `${String(context.durationMinutes)} minutes`,
    ],
    ['Format', formatFormat(context.formatCode)],
    ['Reply by', formatWhen(context.respondByAt, context.timeZone)],
  ];

  const subject = `New lesson request: ${subjectName} with ${student}`;
  const html = page(
    'You have a new lesson request',
    [
      `<p>A family has asked whether you can teach ${escapeHtml(student)}.</p>`,
      detailRows(rows),
      times.length === 0
        ? ''
        : `<p><strong>Times they can do</strong></p><ul>${times
            .map((time) => `<li>${escapeHtml(time)}</li>`)
            .join('')}</ul>`,
      '<p>Accept one of these times, or decline, before the reply deadline above. ',
      'Accepting holds that time in your calendar while the family confirms.</p>',
      button(respondUrl, 'Respond to this request'),
    ].join(''),
  );
  const text = [
    `A family has asked whether you can teach ${student}.`,
    '',
    detailLines(rows),
    '',
    ...(times.length === 0
      ? []
      : ['Times they can do:', ...times.map((time) => `  - ${time}`), '']),
    'Accept one of these times, or decline, before the reply deadline above.',
    'Accepting holds that time in your calendar while the family confirms.',
    '',
    `Respond to this request: ${respondUrl}`,
    '',
    'Studdy',
  ].join('\n');

  return { subject, html, text };
}

/**
 * A tutor said yes. The family now has something to choose.
 *
 * Careful not to imply this is the only answer: a family may have asked up to
 * three tutors, and more may still reply. That is the family's own knowledge,
 * so saying it here reveals nothing.
 */
function tutorRequestAcceptedFamily(context: NotificationContext, siteUrl: string): RenderedEmail {
  const tutor = context.tutorFirstName ?? 'A tutor';
  const student = context.studentFirstName;
  const selectUrl = `${siteUrl}/requests/${context.requestReference ?? ''}/select`;
  const rows: (readonly [string, string])[] = [
    ['Tutor', tutor],
    ['Subject', context.subjectDisplayName ?? ''],
    ['When', formatWhen(context.lessonStartAt, context.timeZone)],
    [
      'Length',
      context.durationMinutes === null ? '' : `${String(context.durationMinutes)} minutes`,
    ],
    ['Format', formatFormat(context.formatCode)],
  ];

  const subject = `${tutor} can take ${student === null ? 'your' : `${student}'s`} lesson`;
  const html = page(
    'A tutor has accepted a time',
    [
      `<p>${escapeHtml(tutor)} can teach${student === null ? '' : ` ${escapeHtml(student)}`} at one of the times you offered.</p>`,
      detailRows(rows),
      '<p>Choosing them holds the time while you pay. ',
      'Nothing is charged until you confirm, and you can wait to hear from anyone ',
      'else you asked before deciding.</p>',
      button(selectUrl, 'Choose your tutor'),
    ].join(''),
  );
  const text = [
    `${tutor} can teach${student === null ? '' : ` ${student}`} at one of the times you offered.`,
    '',
    detailLines(rows),
    '',
    'Choosing them holds the time while you pay. Nothing is charged until you',
    'confirm, and you can wait to hear from anyone else you asked before deciding.',
    '',
    `Choose your tutor: ${selectUrl}`,
    '',
    'Studdy',
  ].join('\n');

  return { subject, html, text };
}

/**
 * A request this tutor had accepted has closed. ONE MESSAGE FOR EVERY CAUSE.
 *
 * The family withdrew, another tutor was chosen, the request expired, the
 * selection window lapsed, the payment window lapsed — five reasons, and this
 * email must read identically for all of them. A tutor who could tell "someone
 * else was picked" from "the family changed their mind" would learn that there
 * WAS a someone else, which SP-006 exists to prevent.
 *
 * It cannot leak even by accident: `closeReasonCode` is never resolved onto the
 * context for a tutor-facing event, so there is nothing here to render.
 *
 * Sent only where the tutor had accepted and had time held, so it always
 * carries something they can act on rather than being a note about a request
 * they never answered.
 */
function tutorRequestClosedTutor(context: NotificationContext, siteUrl: string): RenderedEmail {
  const subjectName = context.subjectDisplayName ?? 'A lesson';
  const requestsUrl = `${siteUrl}/tutor/requests`;

  const subject = 'A lesson request has closed — your time is free again';
  const html = page(
    'This request is no longer active',
    [
      `<p>The ${escapeHtml(subjectName.toLowerCase())} request you accepted is no longer active.</p>`,
      '<p><strong>The time you had held has been released</strong> and is bookable again, ',
      'so you do not need to keep it free.</p>',
      '<p>Nothing else is needed from you.</p>',
      button(requestsUrl, 'View your requests'),
    ].join(''),
  );
  const text = [
    `The ${subjectName.toLowerCase()} request you accepted is no longer active.`,
    '',
    'The time you had held has been released and is bookable again, so you do not',
    'need to keep it free.',
    '',
    'Nothing else is needed from you.',
    '',
    `View your requests: ${requestsUrl}`,
    '',
    'Studdy',
  ].join('\n');

  return { subject, html, text };
}

/**
 * The family's request ended without a booking.
 *
 * TWO ENDINGS, ONE EVENT. Every tutor declined, or the request ran out of
 * time. The difference matters to a family — "nobody could" and "you ran out of
 * time" lead to different next steps — so the copy branches here rather than
 * the delivery machinery carrying two event types for one transition.
 *
 * Individual declines are deliberately never emailed (matrix row 4). This is
 * the one message that says the search is over, and it always offers a way on.
 */
function requestClosedFamily(context: NotificationContext, siteUrl: string): RenderedEmail {
  const student = context.studentFirstName;
  const subjectName = context.subjectDisplayName ?? 'the lesson';
  const everyoneDeclined = context.closeReasonCode === 'all_tutors_declined';
  const findUrl = `${siteUrl}/tutors`;
  const who = student === null ? 'your request' : `${student}'s request`;
  const capitalisedWho = who.charAt(0).toUpperCase() + who.slice(1);

  const openingText = everyoneDeclined
    ? `None of the tutors you asked are able to take ${subjectName.toLowerCase()} at the times you offered.`
    : `${capitalisedWho} for ${subjectName.toLowerCase()} ran out of time before it could be arranged.`;

  const subject = everyoneDeclined
    ? `No tutor is available for ${subjectName}`
    : `${subjectName} request closed`;

  const html = page(
    'Your request has closed',
    [
      `<p>${escapeHtml(openingText)}</p>`,
      '<p><strong>Nothing has been charged.</strong> ',
      'Choosing different times, or asking a wider set of tutors, usually helps.</p>',
      button(findUrl, 'Find another tutor'),
    ].join(''),
  );
  const text = [
    openingText,
    '',
    'Nothing has been charged. Choosing different times, or asking a wider set of',
    'tutors, usually helps.',
    '',
    `Find another tutor: ${findUrl}`,
    '',
    'Studdy',
  ].join('\n');

  return { subject, html, text };
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
    case 'tutor_request_sent_tutor':
      return tutorRequestSentTutor(item.context, siteUrl);
    case 'tutor_request_accepted_family':
      return tutorRequestAcceptedFamily(item.context, siteUrl);
    case 'tutor_request_closed_tutor':
      return tutorRequestClosedTutor(item.context, siteUrl);
    case 'request_closed_family':
      return requestClosedFamily(item.context, siteUrl);
    default:
      throw new Error(`Unknown notification template: ${item.templateCode}`);
  }
}
