import { and, eq, inArray, asc } from 'drizzle-orm';
import type { LessonFormat, LessonFormatScope } from '@studdy/domain/availability';
import { createDatabaseClient } from '../client';
import { services, serviceVersions, subjects, tutorProfiles } from '../schema/index';

/**
 * What a tutor actually publishes for one subject.
 *
 * WHY THIS EXISTS RATHER THAN A READ OF `public_tutor_search`. That view is
 * built for discovery, so it collapses each service to its CHEAPEST current
 * version — exactly one duration per tutor per subject — and it deliberately
 * never exposes a tutor profile id. A booking journey needs both: every length
 * the tutor genuinely offers, so a family can choose one, and the internal id
 * so availability can be derived for them.
 *
 * The visibility rules are the SAME allow-list the view applies, restated here
 * because they are a boundary rather than an optimisation: a suspended,
 * unlisted or restricted tutor must be as unbookable as they are unfindable.
 * Any status or visibility state not named is excluded, so a state added later
 * is hidden until someone decides otherwise.
 */

/** Tutor profile states that may be booked. Anything else is not offered. */
const BOOKABLE_PROFILE_STATUSES = ['approved', 'active'] as const;
/** Visibility states that may be booked. Mirrors the discovery view. */
const BOOKABLE_VISIBILITY_STATES = ['public_recommended', 'public_reduced'] as const;

export interface BookableServiceVersion {
  readonly serviceVersionId: string;
  readonly serviceId: string;
  readonly durationMinutes: number;
  readonly priceAmountMinor: bigint;
  readonly currencyCode: string;
  /** online | in_person | either — what this version may be delivered as. */
  readonly formatCode: LessonFormatScope | 'either';
}

export interface BookableTutorServices {
  /** Internal id. Never rendered; used to derive availability server-side. */
  readonly tutorProfileId: string;
  readonly tutorReference: string;
  readonly tutorFirstName: string;
  readonly subjectId: string;
  readonly versions: readonly BookableServiceVersion[];
}

/**
 * Every current, published version this tutor offers for this subject.
 *
 * Returns null when the tutor cannot be booked at all — unknown reference,
 * hidden profile, or no published service for the subject. ONE null for every
 * cause: a family learning "this tutor exists but is suspended" would be a
 * disclosure, and a booking journey has no use for the distinction.
 */
export async function listBookableServices(input: {
  readonly tutorReference: string;
  readonly subjectId: string;
}): Promise<BookableTutorServices | null> {
  const { sql, db } = createDatabaseClient();
  try {
    const rows = await db
      .select({
        tutorProfileId: tutorProfiles.id,
        tutorReference: tutorProfiles.reference,
        tutorFirstName: tutorProfiles.publicFirstName,
        serviceId: services.id,
        serviceVersionId: serviceVersions.id,
        durationMinutes: serviceVersions.durationMinutes,
        priceAmountMinor: serviceVersions.priceAmountMinor,
        currencyCode: serviceVersions.currencyCode,
        formatCode: serviceVersions.formatCode,
      })
      .from(serviceVersions)
      .innerJoin(services, eq(serviceVersions.serviceId, services.id))
      .innerJoin(tutorProfiles, eq(services.tutorProfileId, tutorProfiles.id))
      .innerJoin(subjects, eq(services.subjectId, subjects.id))
      .where(
        and(
          eq(tutorProfiles.reference, input.tutorReference),
          eq(services.subjectId, input.subjectId),
          eq(services.statusCode, 'published'),
          eq(serviceVersions.statusCode, 'current'),
          eq(subjects.statusCode, 'active'),
          inArray(tutorProfiles.statusCode, [...BOOKABLE_PROFILE_STATUSES]),
          inArray(tutorProfiles.visibilityStateCode, [...BOOKABLE_VISIBILITY_STATES]),
        ),
      )
      // Cheapest first, so the option a family met on the discovery card — the
      // "from" price — is the one they see first here too.
      .orderBy(asc(serviceVersions.priceAmountMinor), asc(serviceVersions.durationMinutes));

    const first = rows[0];
    if (first === undefined) return null;

    return {
      tutorProfileId: first.tutorProfileId,
      tutorReference: first.tutorReference,
      tutorFirstName: first.tutorFirstName,
      subjectId: input.subjectId,
      versions: rows.map((row) => ({
        serviceVersionId: row.serviceVersionId,
        serviceId: row.serviceId,
        durationMinutes: row.durationMinutes,
        priceAmountMinor: row.priceAmountMinor,
        currencyCode: row.currencyCode,
        formatCode: asVersionFormat(row.formatCode),
      })),
    };
  } finally {
    await sql.end();
  }
}

/**
 * The concrete formats a version may be delivered as.
 *
 * A family never books "either" — a lesson happens one way or the other, and
 * `validateFanOut` refuses anything but a concrete choice. This is where the
 * tutor's permissive setting becomes the actual options on screen.
 */
export function formatsForVersion(version: BookableServiceVersion): readonly LessonFormat[] {
  return formatsForCode(version.formatCode);
}

/**
 * The same rule, from a raw column value.
 *
 * The request path reads service versions straight out of its own query rather
 * than through `listBookableServices`, and still has to answer "may this tutor
 * teach it this way?". One rule, two callers — a second copy of the mapping is
 * how an online-only tutor ends up sent an in-person lesson.
 */
export function formatsForCode(value: string): readonly LessonFormat[] {
  const scope = asVersionFormat(value);
  if (scope === 'online') return ['online'];
  if (scope === 'in_person') return ['in_person'];
  return ['online', 'in_person'];
}

function asVersionFormat(value: string): LessonFormatScope | 'either' {
  if (value === 'online' || value === 'in_person') return value;
  // 'any' and 'either' both mean "the tutor has not restricted this". Unknown
  // values land here too: permissive on the tutor's side, and still narrowed to
  // a concrete choice before anything is sent.
  return 'either';
}
