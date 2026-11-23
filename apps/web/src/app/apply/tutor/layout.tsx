import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { WORKSPACE_ROUTE_SEGMENTS } from '@studdy/permissions';
import logo from '@/assets/brand/studdy-logo-approved.webp';
import { chooseWorkspaceAction, signOutAction } from '@/lib/auth/actions';
import { WORKSPACE_LABELS } from '@/components/layout/workspace-top-bar';
import { TopNavFrame } from '@/components/layout/top-nav-frame';
import { resolveIdentity } from '@/lib/identity/resolve';

export const metadata = { title: 'Apply to tutor with Studdy' };

/**
 * The application is a pre-approval flow: applicants do not gain tutor
 * workspace access by opening this route. Keep the approved Studdy branding
 * consistent with Tutor Home, without claiming a pending tutor role is active.
 */
export default async function ApplyLayout({ children }: { children: ReactNode }) {
  const identity = await resolveIdentity();
  if (identity === null) {
    redirect('/sign-in?next=%2Fapply%2Ftutor');
  }

  const accountLabel = identity.displayName ?? identity.email ?? 'Your account';
  const firstName = accountLabel.trim().split(' ')[0] || 'Account';
  const initials = accountLabel
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((name) => name.charAt(0))
    .join('')
    .toUpperCase();

  return (
    <TopNavFrame
      mainClassName="mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:py-8"
      bar={
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-2 sm:px-3">
          <Link href="/" className="flex shrink-0 items-center py-1">
            <Image src={logo} alt="Studdy" unoptimized priority className="h-[40px] w-auto" />
          </Link>
          <nav aria-label="Application navigation" className="ml-2 flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold text-parent-navy">Tutor application</span>
            <Link href="/" className="font-medium text-parent-navy hover:underline">
              Back to Studdy
            </Link>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {identity.workspaces.length > 0 ? (
              <details className="group relative">
                <summary className="cursor-pointer list-none rounded-full bg-parent-sky px-3 py-1.5 text-sm font-semibold text-parent-navy hover:bg-parent-gold-pale [&::-webkit-details-marker]:hidden">
                  Workspaces <span aria-hidden="true" className="text-studdy-orange">⌄</span>
                </summary>
                <div className="absolute right-0 z-50 mt-2 min-w-44 rounded-xl border border-surface-border bg-white p-2 shadow-lg">
                  {identity.workspaces.map((workspace) => (
                    <form key={workspace} action={chooseWorkspaceAction}>
                      <input type="hidden" name="workspace" value={workspace} />
                      <button type="submit" className="w-full rounded-md px-3 py-2 text-left text-sm text-text-primary hover:bg-parent-gold-pale">
                        {WORKSPACE_LABELS[workspace]}
                      </button>
                    </form>
                  ))}
                </div>
              </details>
            ) : null}
            <details className="group relative">
              <summary
                aria-label={`Account menu for ${accountLabel}`}
                className="flex cursor-pointer list-none items-center gap-2 rounded-full px-1 py-1 text-sm font-medium text-parent-navy hover:bg-parent-gold-pale [&::-webkit-details-marker]:hidden"
              >
                <span className="hidden max-w-32 truncate sm:inline">{firstName}</span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-parent-gold bg-parent-navy text-xs font-bold text-white">
                  {initials || 'S'}
                </span>
                <span aria-hidden="true" className="text-xs text-studdy-orange">⌄</span>
              </summary>
              <div className="absolute right-0 z-50 mt-2 min-w-44 rounded-xl border border-surface-border bg-white p-1.5 shadow-lg">
                <p className="truncate px-3 py-2 text-xs text-text-secondary">{accountLabel}</p>
                <form action={signOutAction}>
                  <button type="submit" className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-parent-gold-pale">
                    Sign out
                  </button>
                </form>
              </div>
            </details>
          </div>
        </div>
      }
    >
      {children}
    </TopNavFrame>
  );
}
