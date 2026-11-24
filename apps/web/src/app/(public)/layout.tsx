import { PublicShell } from '@studdy/design-system';
import type { ReactNode } from 'react';
import { PublicFooter, PublicHeader } from '@/components/layout/public-nav';

/** All public routes inherit the current Studdy brand rather than legacy Tutoryn tokens. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="studdy-public-theme">
      <PublicShell header={<PublicHeader />} footer={<PublicFooter />}>
        {children}
      </PublicShell>
    </div>
  );
}
