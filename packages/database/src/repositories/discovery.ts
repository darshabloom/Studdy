import { and, eq } from 'drizzle-orm';
import { createDatabaseClient } from '../client';
import { subjectSectionShortlistEntries, tutorProfiles } from '../schema/index';

/**
 * Discovery repository. Public tutor data is read exclusively through
 * `public.public_tutor_search` — the approved projection — never from the
 * tutor tables directly, so the server cannot accidentally surface a field
 * the public boundary excludes.
 */

export interface PublicTutorRow {
  tutorReference: string;
  firstName: string;
  headline: string | null;
  teachingApproach: string | null;
  subjectCode: string;
  subjectDisplayName: string;
  yearLevelFrom: number | null;
  yearLevelTo: number | null;
  offersOnline: boolean;
  offersInPerson: boolean;
  availabilityLabelCode: string;
  completedLessonCount: number;
  ratingHundredths: number | null;
  isNewToStuddy: boolean;
  startingPriceAmountMinor: bigint;
  currencyCode: string;
  startingPriceDurationMinutes: number;
  verificationLabels: readonly string[];
}

interface RawTutorRow {
  [key: string]: unknown;
}

function mapTutorRow(row: RawTutorRow): PublicTutorRow {
  return {
    tutorReference: row['tutor_reference'] as string,
    firstName: row['first_name'] as string,
    headline: (row['headline'] as string | null) ?? null,
    teachingApproach: (row['teaching_approach'] as string | null) ?? null,
    subjectCode: row['subject_code'] as string,
    subjectDisplayName: row['subject_display_name'] as string,
    yearLevelFrom: (row['year_level_from'] as number | null) ?? null,
    yearLevelTo: (row['year_level_to'] as number | null) ?? null,
    offersOnline: row['offers_online'] as boolean,
    offersInPerson: row['offers_in_person'] as boolean,
    availabilityLabelCode: row['availability_label_code'] as string,
    completedLessonCount: row['completed_lesson_count'] as number,
    ratingHundredths: (row['rating_hundredths'] as number | null) ?? null,
    isNewToStuddy: row['is_new_to_studdy'] as boolean,
    startingPriceAmountMinor: BigInt(row['starting_price_amount_minor'] as string | number),
    currencyCode: row['currency_code'] as string,
    startingPriceDurationMinutes: row['starting_price_duration_minutes'] as number,
    verificationLabels: (row['verification_labels'] as string[] | null) ?? [],
  };
}

export interface TutorSearchQuery {
  subjectCode?: string | null;
  schoolYearNumber?: number | null;
  formatCode?: string | null;
  maxPriceAmountMinor?: bigint | null;
  limit?: number;
}

export async function searchPublicTutors(
  query: TutorSearchQuery = {},
): Promise<readonly PublicTutorRow[]> {
  const { sql } = createDatabaseClient();
  try {
    const subjectCode: string | null = query.subjectCode ?? null;
    const schoolYear: number | null = query.schoolYearNumber ?? null;
    const formatCode: string | null = query.formatCode ?? null;
    // postgres.js has no bigint parameter type; pass the numeric literal as
    // text and let the ::bigint cast do the conversion.
    const maxPrice: string | null =
      query.maxPriceAmountMinor === null || query.maxPriceAmountMinor === undefined
        ? null
        : query.maxPriceAmountMinor.toString();
    const limit = Math.min(query.limit ?? 50, 100);

    const rows = await sql`
      select *
      from public.public_tutor_search
      where (${subjectCode}::text is null or subject_code = ${subjectCode})
        and (
          ${schoolYear}::int is null
          or (
            coalesce(year_level_from, 1) <= ${schoolYear}
            and coalesce(year_level_to, 13) >= ${schoolYear}
          )
        )
        and (
          ${formatCode}::text is null
          or ${formatCode} = 'either'
          or (${formatCode} = 'online' and offers_online)
          or (${formatCode} = 'in_person' and offers_in_person)
        )
        and (${maxPrice}::bigint is null or starting_price_amount_minor <= ${maxPrice})
      order by
        is_new_to_studdy desc,
        rating_hundredths desc nulls last,
        starting_price_amount_minor asc
      limit ${limit}
    `;
    return rows.map((row) => mapTutorRow(row as RawTutorRow));
  } finally {
    await sql.end();
  }
}

export async function findPublicTutorByReference(
  reference: string,
): Promise<readonly PublicTutorRow[]> {
  const { sql } = createDatabaseClient();
  try {
    const rows = await sql`
      select * from public.public_tutor_search
      where tutor_reference = ${reference}
      order by subject_display_name
    `;
    return rows.map((row) => mapTutorRow(row as RawTutorRow));
  } finally {
    await sql.end();
  }
}

export interface ShortlistEntryRow {
  readonly entryId: string;
  readonly tutorProfileId: string;
  readonly tutorReference: string;
  readonly position: number;
  readonly firstName: string;
  readonly headline: string | null;
  readonly subjectDisplayName: string;
  readonly startingPriceAmountMinor: bigint;
  readonly currencyCode: string;
  readonly availabilityLabelCode: string;
}

export async function listShortlist(
  subjectSectionId: string,
): Promise<readonly ShortlistEntryRow[]> {
  const { sql } = createDatabaseClient();
  try {
    const rows = await sql`
      select
        entry.id            as entry_id,
        entry.tutor_profile_id,
        entry.position,
        profile.reference   as tutor_reference,
        profile.public_first_name,
        profile.headline,
        coalesce(search.subject_display_name, '')            as subject_display_name,
        coalesce(search.starting_price_amount_minor, 0)      as starting_price_amount_minor,
        coalesce(search.currency_code, 'NZD')                as currency_code,
        profile.availability_label_code
      from students.subject_section_shortlist_entries as entry
      join tutors.tutor_profiles as profile on profile.id = entry.tutor_profile_id
      left join lateral (
        select s.subject_display_name, s.starting_price_amount_minor, s.currency_code
        from public.public_tutor_search as s
        where s.tutor_reference = profile.reference
        order by s.starting_price_amount_minor asc
        limit 1
      ) as search on true
      where entry.student_subject_section_id = ${subjectSectionId}
        and entry.status_code = 'active'
      order by entry.position
    `;
    return rows.map((row) => ({
      entryId: row['entry_id'] as string,
      tutorProfileId: row['tutor_profile_id'] as string,
      tutorReference: row['tutor_reference'] as string,
      position: row['position'] as number,
      firstName: row['public_first_name'] as string,
      headline: (row['headline'] as string | null) ?? null,
      subjectDisplayName: row['subject_display_name'] as string,
      startingPriceAmountMinor: BigInt(row['starting_price_amount_minor'] as string | number),
      currencyCode: row['currency_code'] as string,
      availabilityLabelCode: row['availability_label_code'] as string,
    }));
  } finally {
    await sql.end();
  }
}

export type ShortlistAddOutcome =
  | { readonly kind: 'added'; readonly position: number }
  | { readonly kind: 'already_present' }
  | { readonly kind: 'full' };

const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';

/**
 * Drizzle wraps driver errors in a DrizzleQueryError, so the PostgreSQL
 * SQLSTATE lives on `cause` rather than the thrown object. Walk the chain.
 */
function isPgError(error: unknown, code: string): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth += 1) {
    if ((current as { code?: unknown }).code === code) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Add a tutor to a shortlist.
 *
 * The three-tutor cap is guaranteed by the database (CHECK on position 1..3
 * plus a partial unique index on (section, position) WHERE active), so two
 * concurrent callers racing for the last slot cannot both succeed. The loser
 * receives a unique violation, which is translated here into a plain 'full'
 * outcome rather than an error page — no lock, no retry loop, no trigger.
 */
export async function addToShortlist(input: {
  subjectSectionId: string;
  tutorReference: string;
  actorUserId: string;
}): Promise<ShortlistAddOutcome> {
  const { sql, db } = createDatabaseClient();
  try {
    const [tutor] = await db
      .select({ id: tutorProfiles.id })
      .from(tutorProfiles)
      .where(
        and(
          eq(tutorProfiles.reference, input.tutorReference),
          eq(tutorProfiles.statusCode, 'active'),
        ),
      );
    if (tutor === undefined) return { kind: 'already_present' };

    const existing = await db
      .select({
        tutorProfileId: subjectSectionShortlistEntries.tutorProfileId,
        position: subjectSectionShortlistEntries.position,
      })
      .from(subjectSectionShortlistEntries)
      .where(
        and(
          eq(subjectSectionShortlistEntries.studentSubjectSectionId, input.subjectSectionId),
          eq(subjectSectionShortlistEntries.statusCode, 'active'),
        ),
      );

    if (existing.some((entry) => entry.tutorProfileId === tutor.id)) {
      return { kind: 'already_present' };
    }
    const taken = new Set(existing.map((entry) => entry.position));
    let position = 0;
    for (let candidate = 1; candidate <= 3; candidate += 1) {
      if (!taken.has(candidate)) {
        position = candidate;
        break;
      }
    }
    if (position === 0) return { kind: 'full' };

    try {
      await db.insert(subjectSectionShortlistEntries).values({
        studentSubjectSectionId: input.subjectSectionId,
        tutorProfileId: tutor.id,
        position,
        addedByUserId: input.actorUserId,
      });
      return { kind: 'added', position };
    } catch (error: unknown) {
      // Lost a race for the last slot, or the same tutor was added twice
      // concurrently. Both are ordinary outcomes, not failures.
      if (isPgError(error, UNIQUE_VIOLATION) || isPgError(error, CHECK_VIOLATION)) {
        return { kind: 'full' };
      }
      throw error;
    }
  } finally {
    await sql.end();
  }
}

/** Remove a tutor from a shortlist. Archival, not deletion. */
export async function removeFromShortlist(input: {
  subjectSectionId: string;
  entryId: string;
}): Promise<void> {
  const { sql, db } = createDatabaseClient();
  try {
    await db
      .update(subjectSectionShortlistEntries)
      .set({ statusCode: 'removed', archivedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(subjectSectionShortlistEntries.id, input.entryId),
          eq(subjectSectionShortlistEntries.studentSubjectSectionId, input.subjectSectionId),
          eq(subjectSectionShortlistEntries.statusCode, 'active'),
        ),
      );
  } finally {
    await sql.end();
  }
}
