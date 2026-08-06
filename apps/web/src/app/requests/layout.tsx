import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@studdy/design-system';
import type { ReactNode } from 'react';
import { WorkspaceTopBar, workspaceHomeHref } from '@/components/layout/workspace-top-bar';
import { resolveIdentity } from '@/lib/identity/resolve';

export const metadata = { title: 'Lesson requests' };

/**
 * Lesson requests are shared by both booking paths — a guardian acting for a
 * dependent student, and an independent student acting for themselves — so
 * they live at one route with the authenticated chrome, exactly like
 * /shortlist.
 */
export default async function RequestsLayout({ children }: { children: ReactNode }) {
  const identity = await resolveIdentity();
  if (identity === null) {
    redirect('/sign-in?next=%2Frequests');
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
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
