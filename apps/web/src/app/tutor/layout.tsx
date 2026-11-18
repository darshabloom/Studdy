import type { ReactNode } from 'react';
import { WorkspaceChrome } from '@/components/workspace/chrome';
import { TUTOR_NAV, TUTOR_SECONDARY_NAV } from '@/lib/tutor/nav';

export const metadata = { title: 'Tutor workspace' };

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceChrome
      accepts={['tutor']}
      navItems={[]}
      topNav={TUTOR_NAV}
      topNavSecondary={TUTOR_SECONDARY_NAV}
      homeHref="/tutor"
    >
      {children}
    </WorkspaceChrome>
  );
}
