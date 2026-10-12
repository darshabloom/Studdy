import type { ReactNode } from 'react';
import { WorkspaceChrome } from '@/components/workspace/chrome';
import { PARENT_NAV } from '@/lib/parent/nav';

export const metadata = { title: 'Parent workspace' };

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceChrome accepts={['parent']} navItems={[]} topNav={PARENT_NAV} homeHref="/parent">
      {children}
    </WorkspaceChrome>
  );
}
