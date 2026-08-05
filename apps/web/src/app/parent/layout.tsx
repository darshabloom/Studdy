import type { ReactNode } from 'react';
import { WorkspaceChrome } from '@/components/workspace/chrome';

const NAV_ITEMS = [
  'Students',
  'Bookings',
  'Progress',
  'Tutors',
  'Payments',
  'Resources',
  'Support',
] as const;

export const metadata = { title: 'Parent workspace' };

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceChrome accepts={['parent']} navItems={NAV_ITEMS} homeHref="/parent">
      {children}
    </WorkspaceChrome>
  );
}
