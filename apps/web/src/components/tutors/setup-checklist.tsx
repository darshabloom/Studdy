import Link from 'next/link';
import { Button, Card, StatusBadge, type StatusFamily } from '@studdy/design-system';
import type { TutorSetupChecklist, TutorSetupStepStatus } from '@studdy/domain/tutors';
import { SETUP_STEP_COPY } from '@/lib/tutors/service-status';

const STEP_LABEL: Readonly<Record<TutorSetupStepStatus, string>> = {
  done: 'Done',
  todo: 'To do',
  waiting: 'With Studdy',
  blocked: 'Not yet',
};

const STEP_FAMILY: Readonly<Record<TutorSetupStepStatus, StatusFamily>> = {
  done: 'complete',
  todo: 'awaiting_action',
  waiting: 'pending',
  blocked: 'paused',
};

/**
 * What an approved tutor has done and what is left before a family can book them.
 *
 * Shown until every step is done. It says how far along the tutor is, names the
 * one thing to do next, and marks apart what is theirs to do, what is with Studdy
 * and what cannot be started yet, so "why am I not in search?" always has an
 * answer on the screen.
 */
export function SetupChecklist({ checklist }: { checklist: TutorSetupChecklist }) {
  const next = checklist.nextStep === null ? null : SETUP_STEP_COPY[checklist.nextStep];
  const done = checklist.steps.filter((step) => step.status === 'done').length;

  return (
    <Card tone="brand" aria-labelledby="setup-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="setup-heading" className="font-display text-lg font-semibold">
            Finish setting up{' '}
            <span className="ml-2 text-sm font-normal text-text-secondary">
              {done} of {checklist.steps.length} complete
            </span>
          </h2>
          <div
            className="mt-2 h-1.5 w-full max-w-lg overflow-hidden rounded-full bg-surface-card"
            role="progressbar"
            aria-label="Setup progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={checklist.percentComplete}
          >
            <div
              className="h-full rounded-full bg-parent-gold"
              style={{ width: `${String(checklist.percentComplete)}%` }}
            />
          </div>
        </div>
        <p className="font-semibold tabular-nums" aria-hidden="true">
          {checklist.percentComplete}%
        </p>
        {next !== null ? (
          <Button asChild size="sm">
            <Link href={next.href}>Next: {next.actionLabel}</Link>
          </Button>
        ) : checklist.waitingOnStuddy ? (
          <p className="text-sm font-medium">Studdy is reviewing your service.</p>
        ) : null}
      </div>

      <details className="group mt-3 rounded-[var(--radius-gentle)] border border-surface-border bg-surface-card">
        <summary className="cursor-pointer list-item rounded-[var(--radius-gentle)] px-4 py-3 font-semibold text-text-primary hover:bg-surface-card-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple">
          View all {checklist.steps.length} setup steps
          <span className="ml-2 text-sm font-normal text-text-secondary">
            ({done} complete)
          </span>
        </summary>
        <ol className="flex flex-col gap-3 px-3 pb-3 pt-1">
          {checklist.steps.map((step) => {
            const copy = SETUP_STEP_COPY[step.code];
            return (
              <li
                key={step.code}
                // Stacked on a phone: side by side, the badge and link took the row and
                // squeezed the words into a one-word column.
                className="flex flex-col gap-3 rounded-[var(--radius-gentle)] border border-surface-border bg-surface-card p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 sm:flex-1">
                  <p className="font-semibold">{copy.title}</p>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    {copy.detail[step.status]}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge family={STEP_FAMILY[step.status]}>
                    {STEP_LABEL[step.status]}
                  </StatusBadge>
                  {step.status === 'todo' ? (
                    <Link
                      href={copy.href}
                      className="text-sm font-medium text-brand-purple hover:underline"
                    >
                      {copy.actionLabel}
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </details>
    </Card>
  );
}
