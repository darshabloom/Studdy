import Link from 'next/link';
import type { TutorSetupChecklist, TutorSetupStepStatus } from '@studdy/domain/tutors';
import { SETUP_STEP_COPY } from '@/lib/tutors/service-status';

const STEP_LABEL: Readonly<Record<TutorSetupStepStatus, string>> = {
  done: 'Complete',
  todo: 'To do',
  waiting: 'In review',
  blocked: 'Not yet',
};

const STEP_TONE: Readonly<Record<TutorSetupStepStatus, string>> = {
  done: 'border-status-success-border bg-status-success-bg',
  todo: 'border-parent-gold bg-parent-gold-pale',
  waiting: 'border-surface-border bg-parent-sky',
  blocked: 'border-surface-border bg-surface-card-secondary',
};

/**
 * A six-stage visual overview. Preserve the exact statuses calculated by the
 * domain checklist: a blocked step must never look actionable or completed.
 */
export function SetupChecklist({ checklist }: { checklist: TutorSetupChecklist }) {
  const done = checklist.steps.filter((step) => step.status === 'done').length;
  const next = checklist.nextStep === null ? null : SETUP_STEP_COPY[checklist.nextStep];

  return (
    <section
      aria-labelledby="setup-heading"
      className="rounded-xl border border-surface-border bg-parent-sky p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 id="setup-heading" className="font-display text-lg font-semibold">
          Finish setting up
        </h2>
        <p className="text-sm text-text-secondary">
          {done} of {checklist.steps.length} complete · {checklist.percentComplete}%
        </p>
      </div>

      <ol className="mt-3 grid grid-cols-3 gap-2 lg:grid-cols-6" aria-label="Tutor setup progress">
        {checklist.steps.map((step, index) => {
          const copy = SETUP_STEP_COPY[step.code];
          const actionable = step.status === 'todo';
          const content = (
            <>
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold" aria-hidden="true">
                  {step.status === 'done' ? '✓' : index + 1}
                </span>
                <span className="text-[10px] font-medium">{STEP_LABEL[step.status]}</span>
              </div>
              <span className="mt-2 block text-sm font-semibold leading-snug">{copy.title}</span>
              {actionable ? (
                <span className="mt-1 block text-xs font-medium underline underline-offset-2">
                  {copy.actionLabel} →
                </span>
              ) : null}
            </>
          );
          const className = `flex min-h-24 flex-col rounded-lg border px-3 py-2 text-left ${STEP_TONE[step.status]} ${actionable ? 'hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-parent-navy' : ''}`;

          return (
            <li key={step.code} className="min-w-0">
              {actionable ? (
                <Link
                  href={copy.href}
                  className={className}
                  aria-label={`${copy.title}: ${STEP_LABEL[step.status]}. ${copy.actionLabel}`}
                >
                  {content}
                </Link>
              ) : (
                <div className={className} aria-label={`${copy.title}: ${STEP_LABEL[step.status]}`}>
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {next === null && checklist.waitingOnStuddy ? (
        <p className="mt-2 text-xs text-text-secondary">
          Studdy is reviewing your service. No action is needed right now.
        </p>
      ) : null}
    </section>
  );
}
