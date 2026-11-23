import type { ReactNode } from 'react';
import { WorkspaceChrome } from '@/components/workspace/chrome';
import type { TopNavItem } from '@/lib/parent/nav';

/**
 * Tutor desktop navigation uses the shared horizontal workspace header.
 * Link only to implemented destinations until Calendar, Students and Lessons
 * receive their dedicated routes. This preserves working tutor workflows.
 */
const TUTOR_NAV: readonly TopNavItem[] = [
  { label: 'Home', href: '/tutor', exact: true },
  { label: 'Booking requests', href: '/tutor/requests' },
  { label: 'Availability', href: '/tutor/availability' },
  { label: 'Services', href: '/tutor/services' },
  { label: 'Profile', href: '/tutor/profile' },
  { label: 'Getting paid', href: '/tutor/payments' },
];

export const metadata = { title: 'Tutor workspace' };

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceChrome accepts={['tutor']} navItems={[]} topNav={TUTOR_NAV} homeHref="/tutor">
      {children}
    </WorkspaceChrome>
  );
}
