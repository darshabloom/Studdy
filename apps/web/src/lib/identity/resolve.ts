import 'server-only';
import { cache } from 'react';
import { ensureIdentityForAuthUser } from '@studdy/database';
import type { ActiveRoleAssignment } from '@studdy/domain';
import { availableWorkspaces } from '@studdy/domain/identity';
import type { RoleCode, WorkspaceCode } from '@studdy/permissions';
import { WORKSPACE_CODES } from '@studdy/permissions';
import { createSupabaseServerClient } from '../supabase/server';

export interface ResolvedIdentity {
  readonly authUserId: string;
  readonly email: string | null;
  readonly studdyUserId: string | null;
  readonly displayName: string | null;
  readonly roleAssignments: readonly ActiveRoleAssignment[];
  readonly pendingRoleCodes: readonly string[];
  readonly workspaces: readonly WorkspaceCode[];
  readonly lastActiveWorkspaceCode: WorkspaceCode | null;
  /** True when the user has not completed /welcome (no live role assignment). */
  readonly needsSetup: boolean;
  /** True when the database was reachable — otherwise workspace data is unknown. */
  readonly databaseAvailable: boolean;
}

/**
 * Server-side identity + workspace resolution (Blueprint §6.1). Runs on every
 * protected request: authenticate, resolve the permanent Studdy User via the
 * identity repository (created + linked on first authenticated visit), load
 * active role assignments, derive workspaces.
 */
/**
 * ONE RESOLUTION PER REQUEST.
 *
 * A layout and the page beneath it render side by side, and each asks who is
 * signed in; so do the loaders a page calls. Uncached, one page view made that
 * many separate round trips to the auth service and that many concurrent
 * `ensureIdentityForAuthUser` calls for the same person. React's `cache` shares
 * the first call's promise with every later caller in the same request, and
 * nothing beyond it: the next request resolves afresh, so a role revoked a
 * moment ago is still seen as revoked.
 */
export const resolveIdentity = cache(resolveIdentityUncached);

async function resolveIdentityUncached(): Promise<ResolvedIdentity | null> {
  const supabase = await createSupabaseServerClient();
  if (supabase === null) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return null;

  const unavailable: ResolvedIdentity = {
    authUserId: user.id,
    email: user.email ?? null,
    studdyUserId: null,
    displayName: null,
    roleAssignments: [],
    pendingRoleCodes: [],
    workspaces: [],
    lastActiveWorkspaceCode: null,
    needsSetup: false,
    databaseAvailable: false,
  };

  if (process.env.DATABASE_URL === undefined && process.env.STUDDY_ENVIRONMENT !== 'local') {
    return unavailable;
  }

  try {
    const record = await ensureIdentityForAuthUser({
      authUserId: user.id,
      authenticationEmail: user.email ?? '',
      fallbackDisplayName: user.email?.split('@')[0] ?? 'New user',
      countryCode: 'NZ',
      timeZone: 'Pacific/Auckland',
      locale: 'en-NZ',
    });

    const active: ActiveRoleAssignment[] = record.roleAssignments.map((assignment) => ({
      id: assignment.id as ActiveRoleAssignment['id'],
      roleCode: assignment.roleCode as RoleCode,
      workspaceEnabled: assignment.workspaceEnabled,
      scopeType: assignment.scopeType,
      scopeId: assignment.scopeId,
    }));

    const saved = record.lastActiveWorkspaceCode;
    const savedWorkspace =
      saved !== null && (WORKSPACE_CODES as readonly string[]).includes(saved)
        ? (saved as WorkspaceCode)
        : null;

    return {
      authUserId: user.id,
      email: user.email ?? null,
      studdyUserId: record.studdyUserId,
      displayName: record.displayName,
      roleAssignments: active,
      pendingRoleCodes: record.pendingRoleCodes,
      workspaces: availableWorkspaces(active),
      lastActiveWorkspaceCode: savedWorkspace,
      needsSetup: !record.hasAnyRoleAssignment,
      databaseAvailable: true,
    };
  } catch {
    return unavailable;
  }
}
