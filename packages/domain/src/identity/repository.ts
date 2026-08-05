import type { AuthUserId, StuddyUserId } from '../core/ids';
import type { ActiveRoleAssignment } from '../core/request-context';
import type { AuthIdentityLink, StuddyUser } from './user';

/**
 * Repository interface implemented by @studdy/database (Blueprint §14).
 * The domain never sees Drizzle or Supabase types.
 */
export interface IdentityRepository {
  /** Resolve the permanent Studdy User for a Supabase auth identity, or null. */
  findUserByAuthId(authUserId: AuthUserId): Promise<StuddyUser | null>;
  findUserById(userId: StuddyUserId): Promise<StuddyUser | null>;
  activeRoleAssignments(userId: StuddyUserId): Promise<readonly ActiveRoleAssignment[]>;
  /**
   * Create the permanent Studdy User plus auth identity link in one
   * transaction. Idempotent on providerSubjectId: an existing active link
   * returns the existing user.
   */
  createUserWithAuthLink(input: {
    authUserId: AuthUserId;
    authenticationEmail: string;
    displayName: string;
    countryCode: string;
    timeZone: string;
    locale: string;
    correlationId: string;
  }): Promise<{ user: StuddyUser; link: AuthIdentityLink; created: boolean }>;
}
