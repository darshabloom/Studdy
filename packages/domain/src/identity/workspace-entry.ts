import type { WorkspaceCode } from '@studdy/permissions';
import type { ActiveRoleAssignment } from '../core/request-context';
import { availableWorkspaces } from './workspace-resolution';

/**
 * Post-sign-in workspace entry (approved 6 Aug 2026):
 *  - one active workspace → enter it;
 *  - several + saved preference (still valid) → restore it;
 *  - several + no valid preference → show the chooser (no silent priority order);
 *  - none → no workspace (e.g. pending tutor, supporter, or no roles yet).
 */
export type WorkspaceEntryDecision =
  | { readonly kind: 'enter'; readonly workspace: WorkspaceCode }
  | { readonly kind: 'choose'; readonly options: readonly WorkspaceCode[] }
  | { readonly kind: 'none' };

export function decideWorkspaceEntry(
  assignments: readonly ActiveRoleAssignment[],
  savedPreference: WorkspaceCode | null,
): WorkspaceEntryDecision {
  const available = availableWorkspaces(assignments);
  if (available.length === 0) return { kind: 'none' };
  const [first] = available;
  if (available.length === 1 && first !== undefined) return { kind: 'enter', workspace: first };
  if (savedPreference !== null && available.includes(savedPreference)) {
    return { kind: 'enter', workspace: savedPreference };
  }
  return { kind: 'choose', options: available };
}
