import Link from 'next/link';
import { Button, PublicShell } from '@studdy/design-system';
import type { ReactNode } from 'react';
import { PublicFooter, PublicHeader } from '@/components/layout/public-nav';
import { WorkspaceTopBar, workspaceHomeHref } from '@/components/layout/workspace-top-bar';
import { resolveIdentity } from '@/lib/identity/resolve';

/**
 * Tutor discovery is ONE route for everyone (`/tutors`), presented according
 * to who is looking:
 *
 *   * signed out — public navigation, and the public sign-in / join calls to
 *     action;
 *   * signed in — the authenticated header, workspace switcher, account menu
 *     and a way back to the dashboard, with no competing "Log in / Join
 *     Studdy" emphasis.
 *
 * The tutor results themselves are identical in both cases: the same
 * approved public projection, the same components.
 */
export default async function DiscoveryLayout({ children }: { children: ReactNode }) {
  const identity = await resolveIdentity();

  if (identity === null) {
    return (
      <PublicShell header={<PublicHeader />} footer={<PublicFooter />}>
        {children}
      </PublicShell>
    );
  }

  const [currentWorkspace] = identity.workspaces;
  const dashboardHref =
    currentWorkspace === undefined ? '/welcome' : workspaceHomeHref(currentWorkspace);

  return (
    <div className="flex min-h-screen flex-col bg-surface-page text-text-primary">
      <header className="sticky top-0 z-[1020] border-b border-surface-border bg-surface-card">
        <WorkspaceTopBar
          currentWorkspace={currentWorkspace ?? null}
          workspaces={identity.workspaces}
          accountLabel={identity.displayName ?? identity.email ?? 'Your account'}
        >
          <Button variant="quiet" size="sm" asChild>
            <Link href={dashboardHref}>← Back to dashboard</Link>
          </Button>
        </WorkspaceTopBar>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
