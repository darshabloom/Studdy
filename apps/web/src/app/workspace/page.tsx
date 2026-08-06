import { redirect } from 'next/navigation';
import { decideWorkspaceEntry } from '@studdy/domain/identity';
import { WORKSPACE_ROUTE_SEGMENTS } from '@studdy/permissions';
import { resolveIdentity } from '@/lib/identity/resolve';

/**
 * Post-sign-in router (approved rules, 6 Aug 2026):
 * one workspace → enter · several + saved preference → restore ·
 * several + none → chooser · none → /welcome (setup, pending or restricted).
 *
 * A server-component page (not a route handler) so redirects compose
 * correctly with server-action navigation.
 */
export default async function WorkspaceRouterPage() {
  const identity = await resolveIdentity();
  if (identity === null) {
    redirect('/sign-in');
  }
  if (identity.needsSetup || identity.workspaces.length === 0) {
    redirect('/welcome');
  }
  const decision = decideWorkspaceEntry(identity.roleAssignments, identity.lastActiveWorkspaceCode);
  if (decision.kind === 'choose') {
    redirect('/workspace/choose');
  }
  if (decision.kind === 'enter') {
    redirect(`/${WORKSPACE_ROUTE_SEGMENTS[decision.workspace]}`);
  }
  redirect('/welcome');
}
