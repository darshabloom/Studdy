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
        <span className="text-xs font-semibold text-text-secondary">
          {checklist.percentComplete}% ready to publish
        </span>
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
              <span className="mt-2 block text-xs font-semibold leading-snug text-text-primary sm:text-sm">
                {copy.title}
              </span>
              <span className="mt-1 block text-[11px] text-text-secondary">
                {STATUS_TEXT[step.status]}
                {current ? ' · Next action' : ''}
              </span>
            </>
          );
          const className = `flex flex-col border-t-[3px] px-1 pt-2.5 ${lineClass} ${actionable ? 'rounded-sm hover:bg-parent-gold-pale focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-studdy-orange' : ''}`;

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
                <div
                  className={className}
                  aria-label={`${copy.title}: ${STATUS_TEXT[step.status]}`}
                >
                  {details}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {next !== null ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-parent-gold-pale px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-studdy-orange">
              Your next action
            </p>
            <p className="text-sm font-semibold text-parent-navy">{next.title}</p>
          </div>
          <Link
            href={next.href}
            className="inline-flex shrink-0 items-center rounded-lg bg-studdy-orange px-3 py-2 text-sm font-semibold text-white hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-studdy-orange"
          >
            {next.actionLabel} →
          </Link>
        </div>
      ) : checklist.waitingOnStuddy ? (
        <p className="mt-3 rounded-lg bg-parent-gold-pale p-2 text-sm text-parent-navy">
          Your service is with Studdy for review. We will update its status here.
        </p>
      ) : null}
    </section>
  );
}
