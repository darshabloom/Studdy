import type { ReactNode } from 'react';
import { DemoBar } from '@/components/demo/demo-bar';
import './forest.css';

export const metadata = {
  title: 'Demo',
  description: 'A guided walkthrough of Studdy using sample data.',
};

/**
 * THE DEMO SUBTREE.
 *
 * Everything under /demo is self-contained. No route in here reads Supabase,
 * calls Stripe, Resend or Inngest, touches an environment secret, requires a
 * seeded user, or invokes a server action — and none of it is reachable from
 * production code, which is what keeps the demo out of the real state machines
 * rather than a flag somebody has to remember.
 *
 * `/demo` is not in `middleware.ts`'s protected prefixes, so it is public and
 * needs no session. A portfolio link that asks a reviewer to sign in is a
 * portfolio link nobody follows.
 *
 * RENDERED PER REQUEST. The demo's dates are a pure function of today
 * (`lib/demo/timeline.ts`), which is what keeps a lesson in the near future
 * however long after deployment somebody opens the link. Prerendering would
 * freeze that function's output into the bundle. It costs nothing: no route
 * under here performs any I/O.
 */
export const dynamic = 'force-dynamic';

export default function DemoLayout({ children }: { children: ReactNode }) {
  /*
   * `data-studdy-theme` re-points the four brand aliases at the forest palette
   * for everything inside it, and for nothing outside. See `forest.css`.
   */
  return (
    <div data-studdy-theme="forest" className="min-h-screen bg-surface-page text-text-primary">
      <DemoBar />
      {children}
    </div>
  );
}
