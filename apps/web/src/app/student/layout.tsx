import type { ReactNode } from 'react';
import { WorkspaceChrome } from '@/components/workspace/chrome';

const NAV_ITEMS = ['Bookings', 'Progress', 'Tutors', 'Payments', 'Resources', 'Support'] as const;

export const metadata = { title: 'Student workspace' };

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceChrome
      accepts={['independent_student', 'dependent_student']}
      navItems={NAV_ITEMS}
      homeHref="/student"
    >
      {children}
    </WorkspaceChrome>
  );
}
