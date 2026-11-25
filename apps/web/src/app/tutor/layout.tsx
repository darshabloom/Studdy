import Link from 'next/link';
import type { ReactNode } from 'react';
import { WorkspaceChrome } from '@/components/workspace/chrome';
import type { TopNavItem } from '@/lib/parent/nav';

/** The six approved sections. Unbuilt sections remain visible but inert. */
const TUTOR_NAV: readonly TopNavItem[] = [
  { label: 'Home', href: '/tutor', exact: true },
  { label: 'Calendar', href: '/tutor/calendar' },
  { label: 'Students', href: '/tutor/students', comingSoon: true },
  { label: 'Lessons', href: '/tutor/lessons', comingSoon: true },
  { label: 'Earnings', href: '/tutor/earnings', comingSoon: true },
  { label: 'Resources', href: '/tutor/resources', comingSoon: true },
];

const TUTOR_TOOLS = [
  { label: 'Booking requests', href: '/tutor/requests' },
  { label: 'Availability', href: '/tutor/availability' },
  { label: 'Services', href: '/tutor/services' },
  { label: 'Getting paid', href: '/tutor/payments' },
] as const;

export const metadata = { title: 'Tutor workspace' };

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceChrome accepts={['tutor']} navItems={[]} topNav={TUTOR_NAV} homeHref="/tutor">
      <nav
        aria-label="Tutor tools"
        className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-surface-border pb-3 text-sm"
      >
        <span className="font-semibold text-parent-navy">Tutor tools</span>
        {TUTOR_TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="font-medium text-text-secondary underline-offset-4 hover:text-parent-navy hover:underline focus-visible:underline"
          >
            {tool.label}
          </Link>
        ))}
      </nav>
      {children}
    </WorkspaceChrome>
  );
}
