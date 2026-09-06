import Link from 'next/link';
import type { ReactNode } from 'react';
import type { DemoStep } from '@/lib/demo/steps';

/**
 * WHERE THE VIEWER IS IN THE STORY.
 *
 * The product itself does not carry a rail like this — its journeys keep the
 * running summary panel instead, which is better for someone actually booking a
 * lesson and useless to someone watching a two-minute walkthrough. A portfolio
 * reviewer needs to know how long the story is and how far in they are, and a
 * screenshot needs to carry that context on its own.
 *
 * Completed steps are links, so the demo can be walked backwards as easily as
 * forwards — a reviewer who wants a second look at the tutor profile should not
 * have to start again.
 */
export function DemoRail({
  steps,
  current,
}: {
  steps: readonly DemoStep[];
  current: string;
}): ReactNode {
  const currentIndex = steps.findIndex((step) => step.key === current);

  return (
    <nav aria-label="Demo progress" className="border-b border-surface-border bg-surface-card">
      <ol className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-1 gap-y-1 px-4 py-2">
        {steps.map((step, index) => {
          const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo';
          const body = (
            <span
              aria-current={state === 'current' ? 'step' : undefined}
              className={[
                'flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 text-xs transition-colors',
                state === 'current'
                  ? 'bg-brand-purple font-semibold text-text-on-brand'
                  : state === 'done'
                    ? 'font-medium text-brand-purple hover:bg-brand-lavender'
                    : 'text-text-muted',
              ].join(' ')}
            >
              <span
                aria-hidden
                className={[
                  'flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold',
                  state === 'current'
                    ? 'bg-white/25 text-text-on-brand'
                    : state === 'done'
                      ? 'bg-brand-lavender text-brand-purple-deep'
                      : 'bg-surface-card-secondary text-text-muted',
                ].join(' ')}
              >
                {state === 'done' ? '✓' : index + 1}
              </span>
              {step.label}
            </span>
          );

          return (
            <li key={step.key} className="flex items-center">
              {state === 'done' ? <Link href={step.href}>{body}</Link> : body}
              {index < steps.length - 1 ? (
                <span aria-hidden className="px-0.5 text-xs text-surface-border">
                  ›
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
