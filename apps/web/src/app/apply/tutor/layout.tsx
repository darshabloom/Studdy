import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@studdy/design-system';
import type { ReactNode } from 'react';
import { WorkspaceTopBar } from '@/components/layout/workspace-top-bar';
import { resolveIdentity } from '@/lib/identity/resolve';

export const metadata = { title: 'Apply to tutor with Studdy' };

/**
 * The applicant's frame: signed in, and nothing more.
 *
 * AN APPLICANT HAS NO WORKSPACE, which is the point — their tutor role is pending
 * and grants nothing until a person approves them — so this sits outside the
 * workspace chrome, the way `/requests` does. It resolves identity itself because
 * the page below it loads the applicant's own application, and a layout's guard is
 * not a reason for a page to skip its own.
 */
export default async function ApplyLayout({ children }: { children: ReactNode }) {
  const identity = await resolveIdentity();
  if (identity === null) {
    redirect('/sign-in?next=%2Fapply%2Ftutor');
  }

  const [currentWorkspace] = identity.workspaces;
  return (
    <div className="flex min-h-screen flex-col bg-surface-page text-text-primary">
      <header className="sticky top-0 z-[1020] border-b border-surface-border bg-surface-card">
        <WorkspaceTopBar
          currentWorkspace={currentWorkspace ?? null}
          workspaces={identity.workspaces}
          accountLabel={identity.displayName ?? identity.email ?? 'Your account'}
        >
          <Button variant="quiet" size="sm" asChild>
            <Link href="/">← Back to Studdy</Link>
          </Button>
        </WorkspaceTopBar>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
