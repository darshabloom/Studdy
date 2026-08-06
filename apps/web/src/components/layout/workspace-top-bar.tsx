import Link from 'next/link';
import { WORKSPACE_ROUTE_SEGMENTS, type WorkspaceCode } from '@studdy/permissions';
import type { ReactNode } from 'react';
import { chooseWorkspaceAction, signOutAction } from '@/lib/auth/actions';

export const WORKSPACE_LABELS: Record<WorkspaceCode, string> = {
  parent: 'Parent',
  tutor: 'Tutor',
  dependent_student: 'Student',
  independent_student: 'Student',
  organisation: 'Organisation',
  platform_manager: 'Platform Manager',
  platform_owner: 'Platform Owner',
};

export function workspaceHomeHref(workspace: WorkspaceCode): string {
  return `/${WORKSPACE_ROUTE_SEGMENTS[workspace]}`;
}

export interface WorkspaceTopBarProps {
  /** The workspace the user is currently in. */
  currentWorkspace: WorkspaceCode | null;
  /** Every workspace the user holds, used for the switcher. */
  workspaces: readonly WorkspaceCode[];
  accountLabel: string;
  /** Rendered between the switcher and the account menu (e.g. a back link). */
  children?: ReactNode;
}

/**
 * The authenticated top bar: workspace switcher, account menu and sign out.
 * Shared by the workspace shells and by signed-in tutor discovery, so a
 * signed-in user never sees the public "Log in / Join Studdy" chrome.
 *
 * Switching posts through chooseWorkspaceAction rather than linking, so the
 * last-used workspace is only persisted by a deliberate user action (link
 * prefetching would otherwise rewrite it silently).
 */
export function WorkspaceTopBar({
  currentWorkspace,
  workspaces,
  accountLabel,
  children,
}: WorkspaceTopBarProps): ReactNode {
  const others = workspaces.filter((workspace) => workspace !== currentWorkspace);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/" className="font-display text-xl font-semibold text-brand-purple-deep">
          Studdy
        </Link>
        <nav aria-label="Workspaces" className="flex items-center gap-1 text-sm">
          {currentWorkspace !== null ? (
            <span className="rounded-[var(--radius-pill)] bg-brand-lavender px-3 py-1 font-medium text-brand-purple">
              {WORKSPACE_LABELS[currentWorkspace]}
            </span>
          ) : null}
          {others.map((workspace) => (
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
        {children}
      </div>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="text-sm text-text-muted"
          title="Notifications (coming soon)"
        >
          🔔
        </span>
        <span className="hidden text-sm text-text-secondary sm:inline">{accountLabel}</span>
        <form action={signOutAction}>
          <button type="submit" className="text-sm font-medium text-brand-purple hover:underline">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
