import Link from 'next/link';
import type { WorkspaceCode } from '@studdy/permissions';
import type { ReactNode } from 'react';
import { chooseWorkspaceAction, signOutAction } from '@/lib/auth/actions';
import type { TopNavItem } from '@/lib/parent/nav';
import { TopNavLinks } from './top-nav-links';
import { WORKSPACE_LABELS } from './workspace-top-bar';

export interface TopNavBarProps {
  readonly homeHref: string;
  readonly items: readonly TopNavItem[];
  readonly currentWorkspace: WorkspaceCode;
  /** Every workspace the user holds; the others are offered as a switch. */
  readonly workspaces: readonly WorkspaceCode[];
  readonly accountLabel: string;
}

/**
 * A workspace whose navigation runs across the top, with no sidebar.
 *
 * The destinations are rendered ONCE, in a row that wraps beneath the wordmark
 * on a phone and sits beside it from `md` up — one `nav` landmark, never two
 * copies hidden from each other.
 *
 * Switching workspace posts through `chooseWorkspaceAction` rather than
 * linking, for the same reason as the sidebar shell: the last-used workspace
 * is only ever persisted by a deliberate act, never by a prefetched link.
 */
export function TopNavBar({
  homeHref,
  items,
  currentWorkspace,
  workspaces,
  accountLabel,
}: TopNavBarProps): ReactNode {
  const others = workspaces.filter((workspace) => workspace !== currentWorkspace);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-5 px-4">
      <Link
        href={homeHref}
        className="order-1 py-2 font-display text-xl font-semibold text-brand-purple-deep"
      >
        Studdy
      </Link>
      <div className="order-3 w-full min-w-0 md:order-2 md:w-auto md:flex-1">
        <TopNavLinks items={items} />
      </div>
      <div className="order-2 ml-auto flex shrink-0 items-center gap-3 md:order-3">
        {others.length > 0 ? (
          <nav aria-label="Workspaces" className="flex items-center gap-1 text-sm">
            <span className="rounded-[var(--radius-pill)] bg-brand-lavender px-3 py-1 font-medium text-brand-purple">
              {WORKSPACE_LABELS[currentWorkspace]}
            </span>
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
        ) : null}
        <span className="hidden max-w-[14rem] truncate text-sm text-text-secondary lg:inline">
          {accountLabel}
        </span>
        <form action={signOutAction}>
          <button type="submit" className="text-sm font-medium text-brand-purple hover:underline">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
