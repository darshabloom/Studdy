import { ROLE_TO_WORKSPACE, type WorkspaceCode } from '@studdy/permissions';
import type { ActiveRoleAssignment } from '../core/request-context';

/**
 * Pure workspace resolution (Blueprint §6.1): given the user's active role
 * assignments, determine which workspaces are available and which one to
 * enter. Entering a protected URL must never be sufficient to gain access —
 * callers re-check assignments server-side on every protected request.
 */
export function availableWorkspaces(
  assignments: readonly ActiveRoleAssignment[],
): readonly WorkspaceCode[] {
  const workspaces = new Set<WorkspaceCode>();
  for (const assignment of assignments) {
    if (!assignment.workspaceEnabled) continue;
    const workspace = ROLE_TO_WORKSPACE[assignment.roleCode];
    if (workspace !== undefined) {
      workspaces.add(workspace);
    }
  }
  return [...workspaces];
}

/**
 * Resolve the workspace to enter: the requested workspace when the user holds
 * it, otherwise the last-used workspace when still valid, otherwise the first
 * available, otherwise null (no workspace — e.g. supporter-only accounts).
 */
export function resolveActiveWorkspace(
  assignments: readonly ActiveRoleAssignment[],
  options: {
    requested?: WorkspaceCode | undefined;
    lastUsed?: WorkspaceCode | undefined;
  } = {},
): WorkspaceCode | null {
  const available = availableWorkspaces(assignments);
  if (available.length === 0) return null;
  if (options.requested !== undefined && available.includes(options.requested)) {
    return options.requested;
  }
  if (options.lastUsed !== undefined && available.includes(options.lastUsed)) {
    return options.lastUsed;
  }
  return available[0] ?? null;
}
