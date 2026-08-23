import type { LessonFormat } from '@studdy/domain/availability';

/**
 * The booking journey's state, as it travels: search parameters and nothing else.
 *
 * NOTHING IS PERSISTED WHILE A FAMILY BROWSES. A draft row, a session blob or a
 * half-made `student_subject_section` would all mean that looking at a tutor
 * changed a child's record, and the whole point of the redesign is that a
 * subject appears on a child because a request was sent, not because a wizard
 * was opened. The URL holds the answers; the database learns them once.
 *
 * The corollary is that every value here is attacker-controlled. This module
 * only PARSES; `resolveBookingDraft` is where each id is checked against what
 * the signed-in user may actually act on, and price and duration are never read
 * from here at all — only a service version id, resolved server-side.
 */

/** The steps, in order. The wizard sends a family to the first unanswered one. */
export const BOOKING_STEPS = [
  'child',
  'subject',
  'tutor',
  'length',
  'format',
  'times',
  'review',
] as const;

export type BookingStep = (typeof BOOKING_STEPS)[number];

export interface BookingParams {
  readonly child: string | null;
  readonly subject: string | null;
  readonly tutor: string | null;
  readonly version: string | null;
  readonly format: LessonFormat | null;
  readonly times: readonly string[];
  /** Which page of the availability horizon the times step is showing. */
  readonly week: number;
}

/** What a Next.js page receives. Every field may be absent, repeated or junk. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | null {
  if (value === undefined) return null;
  const first = Array.isArray(value) ? value[0] : value;
  return first === undefined || first === '' ? null : first;
}

function many(value: string | string[] | undefined): readonly string[] {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).filter((entry) => entry !== '');
}

export function parseBookingParams(raw: RawSearchParams): BookingParams {
  const format = one(raw['format']);
  const week = Number(one(raw['week']) ?? '1');
  return {
    child: one(raw['child']),
    subject: one(raw['subject']),
    tutor: one(raw['tutor']),
    version: one(raw['version']),
    // A lesson happens one way or the other. 'either' is a tutor's permission,
    // never a family's answer, so it is not accepted here.
    format: format === 'online' || format === 'in_person' ? format : null,
    times: many(raw['time']),
    week: Number.isFinite(week) ? Math.trunc(week) : 1,
  };
}

/**
 * Rebuild the journey's URL.
 *
 * Takes the params it is given rather than merging into the current ones, so a
 * caller that drops an answer really drops it. That matters: changing the tutor
 * has to discard the chosen length, and a merge would carry it forward into a
 * tutor who never offered it.
 */
export function bookingHref(step: BookingStep, params: Partial<BookingParams>): string {
  const query = new URLSearchParams();
  if (params.child != null) query.set('child', params.child);
  if (params.subject != null) query.set('subject', params.subject);
  if (params.tutor != null) query.set('tutor', params.tutor);
  if (params.version != null) query.set('version', params.version);
  if (params.format != null) query.set('format', params.format);
  for (const time of params.times ?? []) query.append('time', time);
  if (params.week != null && params.week > 1) query.set('week', String(params.week));
  const stringified = query.toString();
  return stringified === '' ? `/book/${step}` : `/book/${step}?${stringified}`;
}

/**
 * Everything the answers to earlier steps imply, without the later ones.
 *
 * Used when a family changes an answer part-way through: keeping `version` after
 * a tutor change would carry one tutor's price onto another, and keeping a time
 * after a length change would keep a slot derived for a different lesson.
 */
export function paramsUpTo(step: BookingStep, params: BookingParams): Partial<BookingParams> {
  const index = BOOKING_STEPS.indexOf(step);
  return {
    child: index >= BOOKING_STEPS.indexOf('child') ? params.child : null,
    subject: index >= BOOKING_STEPS.indexOf('subject') ? params.subject : null,
    tutor: index >= BOOKING_STEPS.indexOf('tutor') ? params.tutor : null,
    version: index >= BOOKING_STEPS.indexOf('length') ? params.version : null,
    format: index >= BOOKING_STEPS.indexOf('format') ? params.format : null,
    times: index >= BOOKING_STEPS.indexOf('times') ? params.times : [],
  };
}
