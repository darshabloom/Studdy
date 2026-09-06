import Link from 'next/link';
import { SidebarItem, WorkspaceShell } from '@studdy/design-system';
import type { ReactNode } from 'react';
import { DEMO_TUTOR_STEPS } from '@/lib/demo/steps';
import { DEMO_TUTORS, STORY_TUTOR_SLUG } from '@/lib/demo/fixtures';
import { DemoAvatar } from './demo-avatar';
import { DemoRail } from './demo-rail';

const PENDING_NAV = ['Bookings', 'Students', 'Services', 'Lessons', 'Resources', 'Earnings'] as const;

const LIVE_NAV = [
  { label: 'Lesson requests', href: '/demo/tutor/requests' },
  { label: 'Availability', href: '/demo/tutor/calendar' },
] as const;

/**
 * The tutor workspace, without the auth.
 *
 * Uses the production `WorkspaceShell` and `SidebarItem` directly rather than
 * `components/workspace/chrome.tsx`, which resolves a real identity and
 * redirects to sign-in. What a reviewer sees is therefore the real workspace
 * frame — sidebar, top bar, the "soon" markers on sections that genuinely are
 * not built yet — with a fixed tutor in place of a session.
 *
 * The unbuilt sections are left in on purpose. Hiding them would show a product
 * more finished than Studdy is, and the demo is meant to be honest about where
 * the alpha actually stands.
 */
export function DemoTutorShell({
  current,
  children,
}: {
  current: string;
  children: ReactNode;
}): ReactNode {
  const tutor = DEMO_TUTORS.find((candidate) => candidate.slug === STORY_TUTOR_SLUG);

  const topBar = (
    <div className="mx-auto flex max-w-full items-center justify-between gap-4 px-4 py-2">
      <span className="font-display text-lg font-semibold text-brand-purple-deep">Studdy</span>
      <div className="flex items-center gap-2">
        <span className="hidden text-sm text-text-secondary sm:inline">Tutor workspace</span>
        <span className="text-sm font-medium text-text-primary">{tutor?.firstName ?? 'Tutor'}</span>
        <DemoAvatar initials={tutor?.initials ?? 'ST'} size="sm" />
      </div>
    </div>
  );

  const sidebar = (
    <nav aria-label="Workspace" className="flex flex-col gap-1 p-3">
      <Link href="/demo/tutor">
        <SidebarItem active>Home</SidebarItem>
      </Link>
      {LIVE_NAV.map((link) => (
        <Link key={link.href} href={link.href}>
          <SidebarItem>{link.label}</SidebarItem>
        </Link>
      ))}
      {PENDING_NAV.map((item) => (
        <SidebarItem key={item}>
          {item}
          <span className="ml-auto text-xs text-text-muted">soon</span>
        </SidebarItem>
      ))}
    </nav>
  );

  return (
    <>
      <DemoRail steps={DEMO_TUTOR_STEPS} current={current} />
      <WorkspaceShell topBar={topBar} sidebar={sidebar}>
        {children}
      </WorkspaceShell>
    </>
  );
}
