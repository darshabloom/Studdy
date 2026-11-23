import Image from 'next/image';
import Link from 'next/link';
import type { WorkspaceCode } from '@studdy/permissions';
import type { ReactNode } from 'react';
import logo from '@/assets/brand/studdy-logo-approved.webp';
import { chooseWorkspaceAction, signOutAction } from '@/lib/auth/actions';
import type { TopNavItem } from '@/lib/parent/nav';
import { TopNavLinks } from './top-nav-links';
import { WORKSPACE_LABELS } from './workspace-top-bar';

export interface TopNavBarProps {
  readonly homeHref: string;
  readonly items: readonly TopNavItem[];
  readonly currentWorkspace: WorkspaceCode;
  readonly workspaces: readonly WorkspaceCode[];
  readonly accountLabel: string;
  readonly accountAvatarUrl?: string | null;
}

/**
 * An accessible top bar with native disclosure menus. Workspace switching
 * continues to post to the server so permissions and last-used workspace
 * are checked and persisted by the existing authorised action.
 */
export function TopNavBar({
  homeHref,
  items,
  currentWorkspace,
  workspaces,
  accountLabel,
  accountAvatarUrl,
}: TopNavBarProps): ReactNode {
  const otherWorkspaces = workspaces.filter((workspace) => workspace !== currentWorkspace);
  const firstName = accountLabel.trim().split(' ')[0] || 'Account';
  const initials = accountLabel
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
  const profileHref = currentWorkspace === 'tutor' ? '/tutor/profile' : '/workspace';

  return (
    <div
      data-tutor-workspace={currentWorkspace === 'tutor' ? 'true' : undefined}
      className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-5 px-2 sm:px-3"
    >
      <Link href={homeHref} className="order-1 flex shrink-0 items-center py-1">
        <Image src={logo} alt="Studdy" unoptimized priority className="h-[46px] w-auto" />
      </Link>
      <div className="order-3 w-full min-w-0 md:order-2 md:w-auto md:flex-1">
        <TopNavLinks items={items} />
      </div>
      <div className="order-2 ml-auto flex shrink-0 items-center gap-2.5 md:order-3">
        <details className="group relative">
          <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full bg-parent-sky px-3 py-1.5 text-sm font-semibold text-parent-navy outline-offset-2 hover:bg-parent-gold-pale focus-visible:outline focus-visible:outline-2 focus-visible:outline-studdy-orange [&::-webkit-details-marker]:hidden">
            {WORKSPACE_LABELS[currentWorkspace]}
            <span aria-hidden="true" className="text-xs text-studdy-orange">
              ⌄
            </span>
          </summary>
          <div className="absolute right-0 z-50 mt-2 min-w-44 rounded-xl border border-surface-border bg-white p-1.5 shadow-lg">
            <p className="px-3 py-1.5 text-xs text-text-secondary">Switch workspace</p>
            <p
              aria-current="true"
              className="rounded-md bg-parent-gold-pale px-3 py-2 text-sm font-semibold text-parent-navy"
            >
              {WORKSPACE_LABELS[currentWorkspace]} ✓
            </p>
            {otherWorkspaces.map((workspace) => (
              <form action={chooseWorkspaceAction} key={workspace}>
                <input type="hidden" name="workspace" value={workspace} />
                <button
                  type="submit"
                  className="w-full rounded-md px-3 py-2 text-left text-sm text-text-primary hover:bg-parent-gold-pale"
                >
                  {WORKSPACE_LABELS[workspace]}
                </button>
              </form>
            ))}
          </div>
        </details>
        <details className="group relative">
          <summary
            aria-label={`Account menu for ${accountLabel}`}
            className="flex cursor-pointer list-none items-center gap-2 rounded-full px-1 py-1 text-sm font-medium text-parent-navy outline-offset-2 hover:bg-parent-gold-pale focus-visible:outline focus-visible:outline-2 focus-visible:outline-studdy-orange [&::-webkit-details-marker]:hidden"
          >
            <span className="hidden max-w-32 truncate sm:inline">{firstName}</span>
            <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-parent-gold bg-parent-navy text-xs font-bold text-white">
              {accountAvatarUrl ? (
                <Image
                  src={accountAvatarUrl}
                  alt=""
                  fill
                  sizes="36px"
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <span aria-hidden="true">{initials || 'S'}</span>
              )}
            </span>
            <span className="text-xs text-studdy-orange" aria-hidden="true">
              ⌄
            </span>
          </summary>
          <div className="absolute right-0 z-50 mt-2 min-w-44 rounded-xl border border-surface-border bg-white p-1.5 shadow-lg">
            <p className="truncate px-3 py-2 text-xs text-text-secondary">{accountLabel}</p>
            <Link
              href={profileHref}
              className="block rounded-md px-3 py-2 text-sm font-medium text-text-primary hover:bg-parent-gold-pale"
            >
              My profile
            </Link>
            <div className="my-1 border-t border-surface-border" />
            <form action={signOutAction}>
              <button
                type="submit"
                className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-text-primary hover:bg-parent-gold-pale"
              >
                Sign out
              </button>
            </form>
            <p className="px-3 py-1 text-[10px] text-text-muted">
              {process.env.NEXT_PUBLIC_STUDDY_ENVIRONMENT === 'production'
                ? ''
                : 'Development · synthetic data'}
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
