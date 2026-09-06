import type { ReactNode } from 'react';
import { DemoBar } from '@/components/demo/demo-bar';

export const metadata = {
  title: 'Demo',
  description: 'A guided walkthrough of Studdy using sample data.',
};

/**
 * THE DEMO SUBTREE.
 *
 * Everything under /demo is self-contained. No route in here reads Supabase,
 * calls Stripe, Resend or Inngest, touches an environment secret, requires a
 * seeded user, or invokes a server action — and none of them is reachable from
 * production code, which is what keeps the demo out of the real state machines
 * rather than a flag that has to be remembered.
 *
 * `/demo` is not in `middleware.ts`'s protected prefixes, so it is public and
 * needs no session. That is deliberate: a portfolio link that asks a reviewer
 * to sign in is a portfolio link nobody follows.
 */
/**
 * RENDERED PER REQUEST, NOT AT BUILD TIME.
 *
 * The demo's dates are a pure function of today (`lib/demo/timeline.ts`), which
 * is what keeps a lesson in the near future however long after deployment
 * somebody opens the link. Prerendering would freeze that function's output
 * into the bundle, and the "believable lesson time" would quietly become
 * whatever week the site was last built in.
 *
 * Costs nothing: no route under here performs any I/O.
 */
export const dynamic = 'force-dynamic';

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-page text-text-primary">
      <DemoBar />
      {children}
    </div>
  );
}
