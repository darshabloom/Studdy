/**
 * Branded identifier types. Business tables reference permanent Studdy User
 * IDs — never Supabase Auth IDs (brief §5; Database spec §13).
 */

declare const brand: unique symbol;

export type Branded<T, B extends string> = T & { readonly [brand]: B };

/** `identity.users.id` — the permanent Studdy User. */
export type StuddyUserId = Branded<string, 'StuddyUserId'>;
/** Supabase `auth.users.id` — authentication identity only. */
export type AuthUserId = Branded<string, 'AuthUserId'>;
export type RoleAssignmentId = Branded<string, 'RoleAssignmentId'>;
export type FamilyAccountId = Branded<string, 'FamilyAccountId'>;
export type StudentProfileId = Branded<string, 'StudentProfileId'>;
export type TutorProfileId = Branded<string, 'TutorProfileId'>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function assertUuid(value: string, label: string): void {
  if (!isUuid(value)) {
    throw new TypeError(`${label} must be a UUID, received: ${JSON.stringify(value)}`);
  }
}

export function studdyUserId(value: string): StuddyUserId {
  assertUuid(value, 'StuddyUserId');
  return value as StuddyUserId;
}

export function authUserId(value: string): AuthUserId {
  assertUuid(value, 'AuthUserId');
  return value as AuthUserId;
}

/**
 * Human-readable reference prefixes (Database spec §3): permanent references
 * drawn from one concurrency-safe global sequence.
 */
export const REFERENCE_PREFIXES = [
  'USER',
  'FAM',
  'STUDENT',
  'TUTOR',
  'SERVICE',
  'BOOK',
  'SERIES',
  'LESSON',
  'PAY',
  'PAYOUT',
  'CASE',
  'RESOURCE',
] as const;

export type ReferencePrefix = (typeof REFERENCE_PREFIXES)[number];
