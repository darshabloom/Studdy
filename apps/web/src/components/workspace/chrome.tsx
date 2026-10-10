import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, RestrictedState, SidebarItem, WorkspaceShell } from '@studdy/design-system';
import { ROLE_DISPLAY_NAMES, type WorkspaceCode } from '@studdy/permissions';
import type { ReactNode } from 'react';
import { resolveIdentity } from '@/lib/identity/resolve';
import { TopNavBar } from '@/components/layout/top-nav-bar';
import { WORKSPACE_LABELS, WorkspaceTopBar } from '@/components/layout/workspace-top-bar';
import type { TopNavItem } from '@/lib/parent/nav';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface WorkspaceChromeProps {
  /** Workspaces that may enter this shell (student accepts both student kinds). */
  accepts: readonly WorkspaceCode[];
  navItems: readonly string[];
  /** Destinations that actually exist, rendered above the pending ones. */
  navLinks?: readonly { label: string; href: string }[];
  homeHref: string;
  /**
   * Render this workspace with its navigation across the top and no sidebar.
   * The access check, the MFA gate and the restricted state are identical in
   * both frames — only the furniture around them differs.
   */
  topNav?: readonly TopNavItem[];
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
  navLinks = [],
  homeHref,
  topNav,
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
  // Deliberately independent of `hasAccess` — it must not be skippable by any
  // access-check bypass, including a database outage (see `databaseAvailable`
  // below, which never grants access but must not grant an MFA-free path
  // either).
  if (requireMfa) {
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

  const topBar = (
    <WorkspaceTopBar
      currentWorkspace={enteredWorkspace ?? accepts[0] ?? null}
      workspaces={identity.workspaces}
      accountLabel={identity.displayName ?? identity.email ?? 'Your account'}
    />
  );

  const sidebar = (
    <nav aria-label="Workspace" className="flex flex-col gap-1 p-3">
      <Link href={homeHref}>
        <SidebarItem active>Home</SidebarItem>
      </Link>
      {navLinks.map((link) => (
        <Link key={link.href} href={link.href}>
          <SidebarItem>{link.label}</SidebarItem>
        </Link>
      ))}
      {navItems.map((item) => (
        <SidebarItem key={item}>
          {item}
          <span className="ml-auto text-xs text-text-muted">soon</span>
        </SidebarItem>
      ))}
    </nav>
  );

  const unavailable = !identity.databaseAvailable ? (
    <div className="mb-4">
      <Alert tone="warning" title="Workspace data unavailable">
        The development database is not reachable from this environment, so roles and workspace
        access cannot be resolved. Interface shown for layout review only.
      </Alert>
    </div>
  ) : null;

  const content = hasAccess ? (
    children
  ) : (
    <RestrictedState
      title={`You do not have access to the ${currentLabel} workspace`}
      description={
        !identity.databaseAvailable
          ? 'Workspace access could not be verified while the database is unavailable. Try again shortly.'
          : identity.roleAssignments.length === 0 && identity.pendingRoleCodes.length > 0
            ? 'Your tutor application is registered but not yet approved. Tutor tools unlock after approval.'
            : identity.roleAssignments.length === 0
              ? 'Your account has no active roles yet.'
              : `Your roles: ${identity.roleAssignments
                  .map((assignment) => ROLE_DISPLAY_NAMES[assignment.roleCode])
                  .join(', ')}.`
      }
    />
  );

  // Both frames take the SAME two children, so the access decision is made
  // once and cannot differ between them.
  if (topNav !== undefined) {
    return (
      <TopNavFrame
        bar={
          <TopNavBar
            homeHref={homeHref}
            items={topNav}
            currentWorkspace={enteredWorkspace ?? accepts[0]!}
            workspaces={identity.workspaces}
            accountLabel={identity.displayName ?? identity.email ?? 'Your account'}
          />
        }
      >
        {unavailable}
        {content}
      </TopNavFrame>
    );
  }

  return (
    <WorkspaceShell topBar={topBar} sidebar={sidebar}>
      {unavailable}
      {content}
    </WorkspaceShell>
  );
}

/** The top-navigation frame: one bar, then the page. No sidebar. */
function TopNavFrame({ bar, children }: { bar: ReactNode; children: ReactNode }): ReactNode {
  return (
    <div className="flex min-h-screen flex-col bg-surface-page text-text-primary">
      <header className="sticky top-0 z-[1020] border-b border-surface-border bg-surface-card">
        {bar}
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 md:py-6">{children}</main>
    </div>
  );
}
