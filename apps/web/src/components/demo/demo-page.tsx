import type { ReactNode } from 'react';
import type { DemoStep } from '@/lib/demo/steps';
import { DemoRail } from './demo-rail';

/**
 * The frame every parent-side demo screen sits in: the rail, then the screen.
 *
 * Deliberately thin. The demo's job is to show Studdy's screens, so anything
 * this frame adds is something the reviewer is looking at instead of the
 * product.
 */
export function DemoPage({
  steps,
  current,
  children,
}: {
  steps: readonly DemoStep[];
  current: string;
  children: ReactNode;
}): ReactNode {
  return (
    <>
      <DemoRail steps={steps} current={current} />
      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </>
  );
}

/**
 * "In the real product, this happens without you." — said out loud.
 *
 * The demo has to collapse things that take hours in reality: a tutor noticing
 * a request, a Stripe webhook confirming a payment. Every one of those moments
 * gets one of these, so a reviewer can tell what the product does from what the
 * demo is standing in for. It is the difference between a walkthrough and a
 * claim.
 */
export function DemoNote({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="rounded-[var(--radius-medium)] border border-dashed border-brand-purple/40 bg-brand-lavender/30 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-brand-purple-deep">
        <span
          aria-hidden
          className="rounded-[var(--radius-pill)] bg-brand-purple px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-on-brand"
        >
          Demo
        </span>
        {title}
      </p>
      <div className="mt-2 text-sm text-text-secondary">{children}</div>
    </div>
  );
}
