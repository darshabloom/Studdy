import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, RestrictedState, SidebarItem, WorkspaceShell } from '@studdy/design-system';
import {
  ROLE_DISPLAY_NAMES,
  WORKSPACE_ROUTE_SEGMENTS,
  type WorkspaceCode,
} from '@studdy/permissions';
import type { ReactNode } from 'react';
import { resolveIdentity } from '@/lib/identity/resolve';
import { signOutAction } from '@/lib/auth/actions';

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
  children: ReactNode;
}

/**
 * Workspace-aware authenticated shell (brief §5): universal top bar with
 * workspace switcher placeholder and account menu, role-specific sidebar
 * foundation, and a server-side access re-check on every request —
 * entering a protected URL is never sufficient (Blueprint §6.1).
 */
export async function WorkspaceChrome({
  accepts,
  navItems,
  homeHref,
  children,
}: WorkspaceChromeProps) {
  const identity = await resolveIdentity();
  if (identity === null) {
    redirect(`/sign-in?next=${encodeURIComponent(homeHref)}`);
  }

  const hasAccess = identity.workspaces.some((workspace) => accepts.includes(workspace));
  const currentLabel =
    WORKSPACE_LABELS[accepts.find((code) => identity.workspaces.includes(code)) ?? accepts[0]!];

  const otherWorkspaces = identity.workspaces.filter((workspace) => !accepts.includes(workspace));

  const topBar = (
    <div className="flex items-center justify-between gap-4 px-4 py-2">
      <div className="flex items-center gap-3">
        <Link href="/" className="font-display text-xl font-semibold text-brand-purple-deep">
          Studdy
        </Link>
        {/* Workspace switcher placeholder — full switcher lands with identity slice. */}
        <nav aria-label="Workspaces" className="flex items-center gap-1 text-sm">
          <span className="rounded-[var(--radius-pill)] bg-brand-lavender px-3 py-1 font-medium text-brand-purple">
            {currentLabel}
          </span>
          {otherWorkspaces.map((workspace) => (
            <Link
              key={workspace}
              href={`/${WORKSPACE_ROUTE_SEGMENTS[workspace]}`}
              className="rounded-[var(--radius-pill)] px-3 py-1 text-text-secondary hover:bg-surface-card-secondary"
            >
              {WORKSPACE_LABELS[workspace]}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        {/* Notifications placeholder */}
        <span
          aria-hidden="true"
          className="text-sm text-text-muted"
          title="Notifications (coming soon)"
        >
          🔔
        </span>
        <span className="hidden text-sm text-text-secondary sm:inline">{identity.email}</span>
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
            identity.roleAssignments.length === 0
              ? 'Your account has no active roles yet. Role setup arrives with family and student onboarding.'
              : `Your roles: ${identity.roleAssignments
                  .map((assignment) => ROLE_DISPLAY_NAMES[assignment.roleCode])
                  .join(', ')}.`
          }
        />
      )}
    </WorkspaceShell>
  );
}
