import Link from 'next/link';
import type { ReactNode } from 'react';
import { STACEY, PRIYA, JACOB } from '@/lib/demo/fixtures';
import { inboxRequests, withPaid } from '@/lib/demo/schedule';
import { Disc } from './kit';

/**
 * The two workspaces the demo is set inside.
 *
 * Both are written here rather than reusing `components/workspace/chrome.tsx`,
 * which resolves a real identity and redirects to sign-in. The frame is the
 * product's own shape — persistent sidebar, compact top bar — with a fixed
 * person in place of a session.
 */

interface NavEntry {
  readonly label: string;
  readonly href?: string;
  readonly count?: number;
  readonly soon?: boolean;
}

/**
 * THE TUTOR'S NAVIGATION, and the fastest signal in the whole demo that Studdy
 * is a platform rather than a booking form — a reviewer reads a sidebar before
 * they read anything else.
 *
 * Seven populated destinations and two honestly marked as unbuilt. The count on
 * Requests is the ONLY number in the chrome; a badge on every item would flatten
 * it straight back into noise.
 */
const TUTOR_NAV: readonly NavEntry[] = [
  { label: 'Home', href: '/demo/tutor' },
  { label: 'Requests', href: '/demo/tutor/requests' },
  { label: 'Bookings', href: '/demo/tutor/bookings' },
  { label: 'Availability', href: '/demo/tutor/availability' },
  { label: 'Students', href: '/demo/tutor/students' },
  { label: 'Services', href: '/demo/tutor/services' },
  { label: 'Lessons', href: '/demo/tutor/lessons' },
  { label: 'Resources', href: '/demo/tutor/resources', soon: true },
  { label: 'Earnings', href: '/demo/tutor/earnings', soon: true },
];

const PARENT_NAV: readonly NavEntry[] = [
  { label: 'Home', href: '/demo/parent' },
  { label: `${JACOB.firstName}`, href: '/demo/parent/student' },
  { label: 'Lessons', href: '/demo/parent/lessons' },
  { label: 'Find a tutor', href: '/demo/parent/tutors' },
];

function NavItem({ entry, active }: { entry: NavEntry; active: boolean }): ReactNode {
  const body = (
    <span
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2 rounded-[4px] border-l-2 px-3 py-2 text-sm transition-colors ${
        active
          ? 'border-brand bg-brand-tint font-semibold text-brand-strong'
          : entry.soon === true
            ? 'border-transparent text-text-muted hover:bg-surface-card-secondary'
            : 'border-transparent text-text-secondary hover:bg-surface-card-secondary hover:text-text-primary'
      }`}
    >
      {entry.label}
      {entry.count === undefined ? null : (
        <span className="ml-auto rounded-full bg-brand px-2 py-px text-[11px] font-semibold tabular-nums text-brand-contrast">
          {entry.count}
        </span>
      )}
      {entry.soon === true ? (
        <span className="ml-auto text-[11px] text-text-muted">Coming soon</span>
      ) : null}
    </span>
  );
  return entry.href === undefined ? body : <Link href={entry.href}>{body}</Link>;
}

function Shell({
  nav,
  active,
  who,
  role,
  initials,
  children,
}: {
  nav: readonly NavEntry[];
  active: string;
  who: string;
  role: string;
  initials: string;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="flex min-h-[calc(100vh-42px)] flex-col bg-surface-page text-text-primary">
      <div className="sticky top-[42px] z-[1020] border-b border-surface-border bg-surface-card">
        <div className="flex items-center justify-between gap-4 px-5 py-2.5">
          <span className="font-display text-lg font-semibold text-brand-strong">Studdy</span>
          <div className="flex items-center gap-2.5">
            <span className="hidden text-[13px] text-text-muted sm:inline">{role}</span>
            <span className="text-[13px] font-medium text-text-primary">{who}</span>
            <Disc initials={initials} size="sm" />
          </div>
        </div>
      </div>
      <div className="flex flex-1">
        {/*
         * STICKY, AND SCROLLING ONLY IF IT HAS TO.
         *
         * Navigation that leaves with the content is navigation you have to
         * scroll back up to reach — on a workspace whose pages are deliberately
         * long, that is most of them. It is pinned below the two bars above it
         * (the demo bar and the workspace top bar, 42px and 45px), and given
         * its own scroll ONLY as the fallback for a nav taller than the
         * viewport, which nine items never is at these sizes.
         */}
        <aside className="sticky top-[87px] hidden h-[calc(100vh-87px)] w-[228px] shrink-0 overflow-y-auto border-r border-surface-border bg-surface-card md:block">
          <nav aria-label="Workspace" className="flex flex-col gap-0.5 p-3">
            {nav.map((entry) => (
              <NavItem key={entry.label} entry={entry} active={entry.href === active} />
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 px-6 py-7 md:px-9 md:py-9">
          <div className="mx-auto max-w-[880px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function TutorShell({
  active,
  children,
}: {
  active: string;
  children: ReactNode;
}): ReactNode {
  return (
    <Shell
      // COUNTED, NOT WRITTEN DOWN. The badge said three while the inbox held
      // four for one build, because the number was a literal in this file.
      nav={TUTOR_NAV.map((entry) =>
        entry.label === 'Requests' ? { ...entry, count: inboxRequests(new Date()).length } : entry,
      )}
      active={active}
      who={STACEY.firstName}
      role="Tutor workspace"
      initials={STACEY.initials}
    >
      {children}
    </Shell>
  );
}

/**
 * `paid` is the demo's one carried fact, and the NAVIGATION is what carries it.
 *
 * After the simulated payment the family should not find the same lesson still
 * demanding money the moment they click Home. There is nowhere to write that
 * down — no store, no session — so the flag rides in the URL, and every link in
 * this sidebar keeps it. Nothing else in the demo needs state, and this needs
 * only one bit of it.
 */
export function ParentShell({
  active,
  paid = false,
  children,
}: {
  active: string;
  paid?: boolean;
  children: ReactNode;
}): ReactNode {
  return (
    <Shell
      nav={PARENT_NAV.map((entry) =>
        entry.href === undefined ? entry : { ...entry, href: withPaid(entry.href, paid) },
      )}
      active={withPaid(active, paid)}
      who={PRIYA.firstName}
      role="Family"
      initials={PRIYA.initials}
    >
      {children}
    </Shell>
  );
}
