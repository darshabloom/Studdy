import type { ReactNode } from 'react';
import { isFeatureEnabled } from '@studdy/configuration';
import { RestrictedState } from '@studdy/design-system';
import { WorkspaceChrome } from '@/components/workspace/chrome';

const NAV_ITEMS = [
  'Tutors',
  'Students',
  'Programmes',
  'Bookings',
  'Resources',
  'Finance',
  'Reports',
  'Settings',
] as const;

export const metadata = { title: 'Organisation workspace' };

export default function Layout({ children }: { children: ReactNode }) {
  if (!isFeatureEnabled('organisation_workspace')) {
    return (
      <RestrictedState
        title="The organisation workspace is not yet available"
        description="Organisation tools are planned and will be enabled without structural changes. This area is feature-flagged off in the current release."
      />
    );
  }

  return (
    <WorkspaceChrome accepts={['organisation']} navItems={NAV_ITEMS} homeHref="/organisation">
      {children}
    </WorkspaceChrome>
  );
}
