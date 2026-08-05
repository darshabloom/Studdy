import type { AuthUserId, StuddyUserId } from '../core/ids';
import type { IsoInstant } from '../core/time';

/** Account status codes for `identity.users` (Database spec §3 conventions). */
export const ACCOUNT_STATUS_CODES = ['active', 'suspended', 'archived'] as const;

export type AccountStatusCode = (typeof ACCOUNT_STATUS_CODES)[number];

/**
 * The permanent Studdy User — the business identity. Supabase Auth owns
 * credentials and sessions only; the two are linked through
 * `identity.auth_identity_links` (Technical Architecture §4).
 */
export interface StuddyUser {
  readonly id: StuddyUserId;
  readonly reference: string;
  readonly legalName: string | null;
  readonly preferredName: string | null;
  readonly displayName: string;
  readonly countryCode: string;
  readonly timeZone: string;
  readonly locale: string;
  readonly accountStatusCode: AccountStatusCode;
  readonly createdAt: IsoInstant;
  readonly recordVersion: number;
}

export interface AuthIdentityLink {
  readonly userId: StuddyUserId;
  readonly providerType: 'supabase';
  readonly providerSubjectId: AuthUserId;
  readonly authenticationEmail: string;
  readonly statusCode: 'active' | 'unlinked';
  readonly isPrimary: boolean;
  readonly linkedAt: IsoInstant;
}
