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

  const currentStep = DISCOVERY_STEPS[index];

  return (
    <nav aria-label="Progress" className="border-b border-surface-border pb-3">
      {/* Eight pills wrap to three rows on a phone and push the question below
          the fold. Below `sm` the same fact is one line and a bar. */}
      <div className="sm:hidden">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[13px] font-semibold text-text-primary">
            Step {index + 1} of {DISCOVERY_STEPS.length} &middot; {currentStep?.label}
          </p>
          {index > 0 ? (
            <Link
              href={DISCOVERY_STEPS[index - 1]?.href ?? '/demo/parent/tutors'}
              className="text-[13px] font-medium text-brand"
            >
              &lsaquo; {DISCOVERY_STEPS[index - 1]?.label}
            </Link>
          ) : null}
        </div>
        <div className="mt-2 flex gap-1" aria-hidden>
          {DISCOVERY_STEPS.map((step, position) => (
            <span
              key={step.key}
              className={`h-[4px] flex-1 rounded-full ${
                position <= index ? 'bg-brand' : 'bg-surface-border'
              }`}
            />
          ))}
        </div>
      </div>
      <ol className="hidden flex-wrap items-center gap-x-1 gap-y-1 sm:flex">
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

/**
 * ONE ANSWER PER CARD, and the card IS the link.
 *
 * A question with two answers is a choice, not a form, so each answer gets a
 * surface of its own with room for the thing that actually decides it — the
 * price, or what the format means in practice. They lift and grow a chevron on
 * hover for the same reason every other clickable card in the demo does: a
 * surface you can press must not look like a surface you cannot.
 */
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
    <ul className="grid gap-4 sm:grid-cols-2">
      {choices.map((choice) => (
        <li key={choice.key} className="flex">
          <Link
            href={choice.href}
            className="group/card flex w-full flex-col gap-2 rounded-[6px] border border-surface-border bg-surface-card px-5 py-4 transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-brand/45 hover:shadow-[0_2px_10px_rgb(20_51_42/0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="font-display text-[19px] font-medium leading-tight text-text-primary">
                {choice.title}
              </span>
              {choice.meta === undefined ? null : (
                <span className="shrink-0 text-[19px] font-semibold tabular-nums text-text-primary">
                  {choice.meta}
                </span>
              )}
            </span>
            {choice.detail === undefined ? null : (
              <span className="block text-[13px] leading-relaxed text-text-muted">
                {choice.detail}
              </span>
            )}
            <span className="mt-auto flex items-center gap-1.5 pt-2 text-[12.5px] font-medium text-brand">
              Choose this
              <span
                aria-hidden
                className="transition-transform duration-150 group-hover/card:translate-x-0.5"
              >
                &rarr;
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
