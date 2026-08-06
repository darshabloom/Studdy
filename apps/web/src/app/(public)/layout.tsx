import { PublicShell } from '@studdy/design-system';
import type { ReactNode } from 'react';
import { PublicFooter, PublicHeader } from '@/components/layout/public-nav';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <PublicShell header={<PublicHeader />} footer={<PublicFooter />}>
      {children}
    </PublicShell>
  );
}
