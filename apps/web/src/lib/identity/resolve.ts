import 'server-only';
import { ensureIdentityForAuthUser } from '@studdy/database';
import type { ActiveRoleAssignment } from '@studdy/domain';
import { availableWorkspaces } from '@studdy/domain/identity';
import type { RoleCode, WorkspaceCode } from '@studdy/permissions';
import { createSupabaseServerClient } from '../supabase/server';

export interface ResolvedIdentity {
  readonly authUserId: string;
  readonly email: string | null;
  readonly studdyUserId: string | null;
  readonly displayName: string | null;
  readonly roleAssignments: readonly ActiveRoleAssignment[];
  readonly workspaces: readonly WorkspaceCode[];
  /** True when the database was reachable — otherwise workspace data is unknown. */
  readonly databaseAvailable: boolean;
}

/**
 * Server-side identity + workspace resolution (Blueprint §6.1). Runs on every
 * protected request: authenticate, resolve the permanent Studdy User via the
 * identity repository (created + linked on first authenticated visit), load
 * active role assignments, derive workspaces.
 */
export async function resolveIdentity(): Promise<ResolvedIdentity | null> {
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
    workspaces: [],
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

    return {
      authUserId: user.id,
      email: user.email ?? null,
      studdyUserId: record.studdyUserId,
      displayName: record.displayName,
      roleAssignments: active,
      workspaces: availableWorkspaces(active),
      databaseAvailable: true,
    };
  } catch {
    return unavailable;
  }
}
