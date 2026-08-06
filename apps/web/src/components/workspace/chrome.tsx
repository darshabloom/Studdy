import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, RestrictedState, SidebarItem, WorkspaceShell } from '@studdy/design-system';
import { ROLE_DISPLAY_NAMES, type WorkspaceCode } from '@studdy/permissions';
import type { ReactNode } from 'react';
import { resolveIdentity } from '@/lib/identity/resolve';
import { chooseWorkspaceAction, signOutAction } from '@/lib/auth/actions';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const WORKSPACE_LABELS: Record<WorkspaceCode, string> = {
  parent: 'Parent',
  tutor: 'Tutor',
  dependent_student: 'Student',
  independent_student: 'Student',
  organisation: 'Organisation',
  platform_manager: 'Platform Manager',
  platform_owner: 'Platform Owner',
};

export interface WorkspaceChromeProps {
  /** Workspaces that may enter this shell (student accepts both student kinds). */
  accepts: readonly WorkspaceCode[];
  navItems: readonly string[];
  homeHref: string;
  /** TOTP MFA required to enter (Platform Manager / Owner — approved 6 Aug 2026). */
  requireMfa?: boolean;
  children: ReactNode;
}

/**
 * Workspace-aware authenticated shell. Server-side access re-check on every
 * request — entering a protected URL is never sufficient (Blueprint §6.1).
 */
export async function WorkspaceChrome({
  accepts,
  navItems,
  homeHref,
  requireMfa = false,
  children,
}: WorkspaceChromeProps) {
  const identity = await resolveIdentity();
  if (identity === null) {
    redirect(`/sign-in?next=${encodeURIComponent(homeHref)}`);
  }
  if (identity.needsSetup && identity.databaseAvailable) {
    redirect('/welcome');
  }

  const enteredWorkspace = accepts.find((code) => identity.workspaces.includes(code)) ?? null;
  const hasAccess = enteredWorkspace !== null;

  // MFA gate: managers and owners must hold aal2 before the workspace renders.
  if (hasAccess && requireMfa) {
    const supabase = await createSupabaseServerClient();
    if (supabase !== null) {
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (data !== null && data.currentLevel !== 'aal2') {
        redirect(data.nextLevel === 'aal2' ? '/mfa' : '/mfa/enroll');
      }
    }
  }

  // NOTE: the last-used workspace is persisted ONLY by explicit user actions
  // (workspace chooser and the switcher below) — never during render, because
  // Next.js prefetches links and would silently overwrite the preference.
  const currentLabel = WORKSPACE_LABELS[enteredWorkspace ?? accepts[0]!];
  const otherWorkspaces = identity.workspaces.filter((workspace) => !accepts.includes(workspace));

  const topBar = (
    <div className="flex items-center justify-between gap-4 px-4 py-2">
      <div className="flex items-center gap-3">
        <Link href="/" className="font-display text-xl font-semibold text-brand-purple-deep">
          Studdy
        </Link>
        <nav aria-label="Workspaces" className="flex items-center gap-1 text-sm">
          <span className="rounded-[var(--radius-pill)] bg-brand-lavender px-3 py-1 font-medium text-brand-purple">
            {currentLabel}
          </span>
          {otherWorkspaces.map((workspace) => (
            <form key={workspace} action={chooseWorkspaceAction} className="inline">
              <input type="hidden" name="workspace" value={workspace} />
              <button
                type="submit"
                className="rounded-[var(--radius-pill)] px-3 py-1 text-text-secondary hover:bg-surface-card-secondary"
              >
                {WORKSPACE_LABELS[workspace]}
              </button>
            </form>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="text-sm text-text-muted"
          title="Notifications (coming soon)"
        >
          🔔
        </span>
        <span className="hidden text-sm text-text-secondary sm:inline">
          {identity.displayName ?? identity.email}
        </span>
        <form action={signOutAction}>
          <button type="submit" className="text-sm font-medium text-brand-purple hover:underline">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );

  const sidebar = (
    <nav aria-label="Workspace" className="flex flex-col gap-1 p-3">
      <Link href={homeHref}>
        <SidebarItem active>Home</SidebarItem>
      </Link>
      {navItems.map((item) => (
        <SidebarItem key={item}>
          {item}
          <span className="ml-auto text-xs text-text-muted">soon</span>
        </SidebarItem>
      ))}
    </nav>
  );

  return (
    <WorkspaceShell topBar={topBar} sidebar={sidebar}>
      {!identity.databaseAvailable ? (
        <div className="mb-4">
          <Alert tone="warning" title="Workspace data unavailable">
            The development database is not reachable from this environment, so roles and workspace
            access cannot be resolved. Interface shown for layout review only.
          </Alert>
        </div>
      ) : null}
      {hasAccess || !identity.databaseAvailable ? (
        children
      ) : (
        <RestrictedState
          title={`You do not have access to the ${currentLabel} workspace`}
          description={
            identity.roleAssignments.length === 0 && identity.pendingRoleCodes.length > 0
              ? 'Your tutor application is registered but not yet approved. Tutor tools unlock after approval.'
              : identity.roleAssignments.length === 0
                ? 'Your account has no active roles yet.'
                : `Your roles: ${identity.roleAssignments
                    .map((assignment) => ROLE_DISPLAY_NAMES[assignment.roleCode])
                    .join(', ')}.`
          }
        />
      )}
    </WorkspaceShell>
  );
}
