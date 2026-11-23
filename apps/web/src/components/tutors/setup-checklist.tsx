import Link from 'next/link';
import type { TutorSetupChecklist, TutorSetupStepStatus } from '@studdy/domain/tutors';
import { SETUP_STEP_COPY } from '@/lib/tutors/service-status';

const STATUS_TEXT: Readonly<Record<TutorSetupStepStatus, string>> = {
  done: 'Complete',
  todo: 'To do',
  waiting: 'In review',
  blocked: 'Locked',
};

/**
 * Compact six-stage setup tracker. Only actionable steps are linked; blocked
 * steps remain clearly distinguished from completed and reviewed stages.
 */
export function SetupChecklist({ checklist }: { checklist: TutorSetupChecklist }) {
  const done = checklist.steps.filter((step) => step.status === 'done').length;
  const next = checklist.nextStep === null ? null : SETUP_STEP_COPY[checklist.nextStep];

  return (
    <section
      aria-labelledby="setup-heading"
      className="rounded-xl border border-surface-border bg-white px-4 py-3 sm:px-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h2 id="setup-heading" className="font-display text-lg font-semibold">
            Finish setting up
          </h2>
          <p className="text-xs font-medium text-text-secondary">
            {done} of {checklist.steps.length} complete
          </p>
        </div>
        {next !== null ? (
          <Link
            href={next.href}
            className="text-sm font-semibold text-brand-purple underline decoration-parent-gold decoration-2 underline-offset-4 hover:text-studdy-orange"
          >
            Next: {next.actionLabel} →
          </Link>
        ) : checklist.waitingOnStuddy ? (
          <span className="text-xs text-text-secondary">With Studdy for review</span>
        ) : null}
      </div>

      <ol
        className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3 lg:grid-cols-6"
        aria-label="Tutor setup steps"
      >
        {checklist.steps.map((step, index) => {
          const copy = SETUP_STEP_COPY[step.code];
          const actionable = step.status === 'todo';
          const current = step.code === checklist.nextStep;
          const lineClass =
            step.status === 'done'
              ? 'border-parent-gold'
              : current
                ? 'border-studdy-orange'
                : 'border-surface-border';
          const numberClass =
            step.status === 'done'
              ? 'bg-parent-navy text-white'
              : current
                ? 'bg-studdy-orange text-white'
                : 'border border-surface-border bg-white text-text-secondary';
          const details = (
            <>
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${numberClass}`}
                aria-hidden="true"
              >
                {step.status === 'done' ? '✓' : index + 1}
              </span>
              <span className="mt-2 block min-h-9 text-xs font-semibold leading-snug text-text-primary sm:text-sm">
                {copy.title}
              </span>
              <span className="mt-1 block text-[11px] text-text-secondary">
                {STATUS_TEXT[step.status]}
                {current ? ' · Next' : ''}
              </span>
            </>
          );
          const className = `flex h-full flex-col border-t-[3px] px-1 pt-3 ${lineClass} ${actionable ? 'rounded-sm hover:bg-parent-gold-pale focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-studdy-orange' : ''}`;

          return (
            <li key={step.code} className="min-w-0">
              {actionable ? (
                <Link
                  href={copy.href}
                  className={className}
                  aria-label={`${copy.title}: ${STATUS_TEXT[step.status]}. ${copy.actionLabel}`}
                >
                  {details}
                </Link>
              ) : (
                <div className={className} aria-label={`${copy.title}: ${STATUS_TEXT[step.status]}`}>
                  {details}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
