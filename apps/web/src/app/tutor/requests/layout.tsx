import type { ReactNode } from 'react';
import { CalendarTabs } from '@/components/tutor/kit';

/**
 * This screen is a view of the tutor's Calendar. The page beneath is unchanged;
 * the strip above it is what places it there.
 */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <CalendarTabs current="requests" />
      <div>{children}</div>
    </div>
  );
}
