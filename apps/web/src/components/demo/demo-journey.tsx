import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * WHERE THE VIEWER IS IN THE LONGER JOURNEY.
 *
 * Only the discovery flow carries this. The rebooking flow is four screens and
 * does not need a map; putting one there would make a short journey look long,
 * which is the opposite of the point that flow exists to make.
 *
 * Completed steps are links, so the demo can be walked backwards as easily as
 * forwards — a reviewer wanting a second look at a profile should not have to
 * start again.
 */

export interface JourneyStep {
  readonly key: string;
  readonly label: string;
  readonly href: string;
}

export const DISCOVERY_STEPS: readonly JourneyStep[] = [
  { key: 'find', label: 'Find', href: '/demo/parent/tutors' },
  { key: 'profile', label: 'Profile', href: '/demo/parent/tutors/daniel' },
  { key: 'lesson', label: 'Lesson', href: '/demo/parent/find/format' },
  { key: 'times', label: 'Times', href: '/demo/parent/find/times' },
  { key: 'review', label: 'Review', href: '/demo/parent/find/review' },
  { key: 'sent', label: 'Sent', href: '/demo/parent/find/sent' },
  { key: 'pay', label: 'Pay', href: '/demo/parent/find/pay' },
  { key: 'booked', label: 'Booked', href: '/demo/parent/find/booked' },
];

export function JourneyProgress({ current }: { current: string }): ReactNode {
  const index = DISCOVERY_STEPS.findIndex((step) => step.key === current);

  return (
    <nav aria-label="Progress" className="border-b border-surface-border pb-3">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1">
        {DISCOVERY_STEPS.map((step, position) => {
          const state = position < index ? 'done' : position === index ? 'current' : 'todo';
          const body = (
            <span
              aria-current={state === 'current' ? 'step' : undefined}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] transition-colors ${
                state === 'current'
                  ? 'bg-brand font-semibold text-brand-contrast'
                  : state === 'done'
                    ? 'font-medium text-brand hover:bg-brand-tint'
                    : 'text-text-muted'
              }`}
            >
              <span
                aria-hidden
                className={`flex h-[15px] w-[15px] items-center justify-center rounded-full text-[9px] font-semibold ${
                  state === 'current'
                    ? 'bg-brand-contrast/25 text-brand-contrast'
                    : state === 'done'
                      ? 'bg-brand-tint text-brand-strong'
                      : 'bg-surface-card-secondary text-text-muted'
                }`}
              >
                {state === 'done' ? '✓' : position + 1}
              </span>
              {step.label}
            </span>
          );
          return (
            <li key={step.key} className="flex items-center">
              {state === 'done' ? <Link href={step.href}>{body}</Link> : body}
              {position < DISCOVERY_STEPS.length - 1 ? (
                <span aria-hidden className="px-0.5 text-[11px] text-surface-border">
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

/** One answer per row, and the row IS the link. */
export function ChoiceRows({
  choices,
}: {
  choices: readonly {
    key: string;
    href: string;
    title: string;
    detail?: string;
    meta?: string;
  }[];
}): ReactNode {
  return (
    <ul className="flex flex-col gap-2">
      {choices.map((choice) => (
        <li key={choice.key}>
          <Link
            href={choice.href}
            className="flex items-center justify-between gap-4 rounded-[4px] border border-surface-border bg-surface-card px-4 py-3.5 transition-colors hover:border-brand/50 hover:bg-brand-tint/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span className="min-w-0">
              <span className="block font-display text-[17px] font-medium text-text-primary">
                {choice.title}
              </span>
              {choice.detail === undefined ? null : (
                <span className="mt-0.5 block text-[13px] text-text-muted">{choice.detail}</span>
              )}
            </span>
            {choice.meta === undefined ? null : (
              <span className="shrink-0 text-[15px] font-semibold tabular-nums text-text-primary">
                {choice.meta}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
