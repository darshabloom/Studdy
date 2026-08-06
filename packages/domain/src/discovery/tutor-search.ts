/**
 * Public tutor discovery — filter contract and presentation helpers.
 *
 * Every field here comes from `public.public_tutor_search`, the approved
 * public projection. The domain never sees internal tutor state.
 */

export interface TutorSearchFilters {
  readonly subjectCode: string | null;
  readonly schoolYearCode: string | null;
  /** online | in_person | either (either = no format filter) */
  readonly formatCode: string | null;
  /** Inclusive ceiling in minor units. */
  readonly maxPriceAmountMinor: bigint | null;
}

export const EMPTY_TUTOR_SEARCH_FILTERS: TutorSearchFilters = {
  subjectCode: null,
  schoolYearCode: null,
  formatCode: null,
  maxPriceAmountMinor: null,
};

export interface PublicTutorResult {
  readonly tutorReference: string;
  readonly firstName: string;
  readonly headline: string | null;
  readonly teachingApproach: string | null;
  readonly subjectCode: string;
  readonly subjectDisplayName: string;
  readonly yearLevelFrom: number | null;
  readonly yearLevelTo: number | null;
  readonly offersOnline: boolean;
  readonly offersInPerson: boolean;
  readonly availabilityLabelCode: string;
  readonly completedLessonCount: number;
  readonly ratingHundredths: number | null;
  readonly isNewToStuddy: boolean;
  readonly startingPriceAmountMinor: bigint;
  readonly currencyCode: string;
  readonly startingPriceDurationMinutes: number;
  readonly verificationLabels: readonly string[];
}

/** Availability labels (doc 14 §13) — fixed strings, never free text. */
export const AVAILABILITY_LABELS: Record<string, string> = {
  available_this_week: 'Available this week',
  accepting_new: 'Accepting new students',
  limited: 'Limited availability',
  existing_only: 'Existing students only',
  waiting_list: 'Waiting list available',
};

/** Verification labels (doc 01 §14.3) — fixed strings. */
export const VERIFICATION_LABELS: Record<string, string> = {
  identity_verified: 'Identity verified',
  qualification_verified: 'Qualification verified',
  references_completed: 'References completed',
  studdy_interviewed: 'Studdy interviewed',
};

export function availabilityLabel(code: string): string {
  return AVAILABILITY_LABELS[code] ?? 'Availability on request';
}

export function verificationLabel(code: string): string {
  return VERIFICATION_LABELS[code] ?? code;
}

export function yearLevelRangeLabel(from: number | null, to: number | null): string {
  if (from === null && to === null) return 'All year levels';
  if (from !== null && to !== null) return `Years ${from}–${to}`;
  if (from !== null) return `Year ${from} and above`;
  return `Up to Year ${to ?? ''}`;
}

export function formatLabel(offersOnline: boolean, offersInPerson: boolean): string {
  if (offersOnline && offersInPerson) return 'Online and in person';
  if (offersOnline) return 'Online';
  if (offersInPerson) return 'In person';
  return 'Format on request';
}

/** Rating stored in hundredths (450 = 4.5) — integers only, never floats. */
export function ratingLabel(ratingHundredths: number | null): string | null {
  if (ratingHundredths === null) return null;
  return (ratingHundredths / 100).toFixed(1);
}

export function priceLabel(amountMinor: bigint, currencyCode: string): string {
  const major = Number(amountMinor) / 100;
  const formatted = Number.isInteger(major) ? major.toFixed(0) : major.toFixed(2);
  return currencyCode === 'NZD' ? `$${formatted}` : `${formatted} ${currencyCode}`;
}

/**
 * Does a tutor's advertised year range cover the student's year? Used to sort
 * and label results; the database applies the same rule when filtering.
 */
export function coversSchoolYear(
  result: Pick<PublicTutorResult, 'yearLevelFrom' | 'yearLevelTo'>,
  schoolYear: number,
): boolean {
  const from = result.yearLevelFrom ?? 1;
  const to = result.yearLevelTo ?? 13;
  return schoolYear >= from && schoolYear <= to;
}
