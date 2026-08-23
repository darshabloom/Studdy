import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  BOOKING_STEPS,
  bookingHref,
  paramsUpTo,
  type BookingParams,
  type BookingStep,
} from '@/lib/booking/draft';

const STEP_LABELS: Record<BookingStep, string> = {
  child: 'Who for',
  subject: 'Subject',
  tutor: 'Tutor',
  length: 'Lesson length',
  format: 'Online or in person',
  times: 'Times',
  review: 'Review',
};

export interface BookingShellProps {
  readonly step: BookingStep;
  /** The furthest step answered so far, for what may be jumped back to. */
  readonly nextStep: BookingStep;
  readonly params: BookingParams;
  /** Steps not on screen for this journey, e.g. format with one option. */
  readonly skipped?: readonly BookingStep[];
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
}

/**
 * The frame every booking step sits in.
 *
 * The progress rail is made of LINKS BACK, not decoration. A parent halfway
 * through is still deciding, and the commonest thing they want is to change
 * their mind about the tutor or the length — so every answered step is a way
 * back to it, and going back drops the answers that depended on it rather than
 * carrying a stale price forward.
 *
 * Steps ahead are inert text: they are the shape of what is coming, which is
 * worth showing, but they cannot be reached before they can be answered.
 */
export function BookingShell({
  step,
  nextStep,
  params,
  skipped = [],
  title,
  description,
  children,
}: BookingShellProps): ReactNode {
  const visible = BOOKING_STEPS.filter((candidate) => !skipped.includes(candidate));
  const currentIndex = BOOKING_STEPS.indexOf(step);
  const frontier = BOOKING_STEPS.indexOf(nextStep);

  return (
    <section className="mx-auto max-w-3xl px-4 py-8 md:py-10">
      <nav aria-label="Booking steps" className="mb-6">
        <ol className="flex flex-wrap items-center gap-x-1 gap-y-1.5 text-xs">
          {visible.map((candidate, index) => {
            const candidateIndex = BOOKING_STEPS.indexOf(candidate);
            const isCurrent = candidate === step;
            const answered = candidateIndex < frontier;
            const label = STEP_LABELS[candidate];
            return (
              <li key={candidate} className="flex items-center gap-1">
                {index > 0 ? (
                  <span aria-hidden className="px-0.5 text-text-muted">
                    ›
                  </span>
                ) : null}
                {answered && !isCurrent ? (
                  <Link
                    href={bookingHref(candidate, paramsUpTo(candidate, params))}
                    className="rounded-[var(--radius-gentle)] px-1.5 py-0.5 font-medium text-brand-purple underline underline-offset-2 hover:bg-brand-lavender focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-purple"
                  >
                    {label}
                  </Link>
                ) : (
                  <span
                    aria-current={isCurrent ? 'step' : undefined}
                    className={
                      isCurrent
                        ? 'rounded-[var(--radius-gentle)] bg-brand-purple px-1.5 py-0.5 font-semibold text-white'
                        : 'px-1.5 py-0.5 text-text-muted'
                    }
                  >
                    {label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <header className="mb-5">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
          Step {visible.indexOf(step) + 1} of {visible.length}
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-brand-purple-deep md:text-3xl">
          {title}
        </h1>
        {description !== undefined ? (
          <p className="mt-2 text-text-secondary">{description}</p>
        ) : null}
      </header>

      {children}

      {currentIndex > 0 ? (
        <div className="mt-6 border-t border-surface-border pt-4">
          <Link
            href={bookingHref(
              BOOKING_STEPS[
                // Skip back over any step this journey never showed, so "Back"
                // lands where the parent actually came from.
                (() => {
                  let index = currentIndex - 1;
                  while (index > 0 && skipped.includes(BOOKING_STEPS[index]!)) index -= 1;
                  return index;
                })()
              ]!,
              paramsUpTo(BOOKING_STEPS[currentIndex - 1]!, params),
            )}
            className="text-sm text-brand-purple hover:underline"
          >
            ← Back
          </Link>
        </div>
      ) : null}
    </section>
  );
}
