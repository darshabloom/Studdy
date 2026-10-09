import type { ReactNode } from 'react';
import { WorkspaceChrome } from '@/components/workspace/chrome';

const NAV_ITEMS = ['Bookings', 'Students', 'Lessons', 'Resources', 'Earnings'] as const;

export const metadata = { title: 'Tutor workspace' };

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceChrome
      accepts={['tutor']}
      navItems={NAV_ITEMS}
      navLinks={[
        { label: 'Lesson requests', href: '/tutor/requests' },
        { label: 'Services', href: '/tutor/services' },
        { label: 'Availability', href: '/tutor/availability' },
        { label: 'Profile', href: '/tutor/profile' },
        { label: 'Getting paid', href: '/tutor/payments' },
      ]}
      homeHref="/tutor"
    >
      {children}
    </WorkspaceChrome>
  );
}
