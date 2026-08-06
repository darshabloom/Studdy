import type { ReactNode } from 'react';
import { WorkspaceChrome } from '@/components/workspace/chrome';

const NAV_ITEMS = [
  'Cases',
  'Tasks',
  'Users',
  'Tutors',
  'Organisations',
  'Marketplace',
  'Payments',
  'Reports',
  'Rules',
  'Integrations',
  'Audit',
  'Settings',
] as const;

export const metadata = { title: 'Platform Manager workspace' };

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceChrome
      requireMfa
      accepts={['platform_manager', 'platform_owner']}
      navItems={NAV_ITEMS}
      homeHref="/manager"
    >
      {children}
    </WorkspaceChrome>
  );
}
