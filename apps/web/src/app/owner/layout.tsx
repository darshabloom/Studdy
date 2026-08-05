import type { ReactNode } from 'react';
import { WorkspaceChrome } from '@/components/workspace/chrome';

const NAV_ITEMS = [
  'Managers',
  'Platform Health',
  'Countries and Regions',
  'Global Configuration',
  'Financial Rules',
  'Data Retention',
  'Emergency Controls',
  'Platform Security',
] as const;

export const metadata = { title: 'Platform Owner workspace' };

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceChrome accepts={['platform_owner']} navItems={NAV_ITEMS} homeHref="/owner">
      {children}
    </WorkspaceChrome>
  );
}
