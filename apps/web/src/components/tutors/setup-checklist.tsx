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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="setup-heading" className="font-display text-xl font-semibold">
            Finish setting up
          </h2>
          <p className="mt-1 text-text-secondary">
            Families cannot book you until every step is done. {done} of {checklist.steps.length}{' '}
            complete.
          </p>
        </div>
        <p className="text-2xl font-semibold tabular-nums" aria-hidden="true">
          {checklist.percentComplete}%
        </p>
      </div>

      <div
        className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-card"
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={checklist.percentComplete}
      >
        <div
          className="h-full rounded-full bg-brand-purple"
          style={{ width: `${String(checklist.percentComplete)}%` }}
        />
      </div>

      {next !== null ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link href={next.href}>Next: {next.actionLabel}</Link>
          </Button>
        </div>
      ) : checklist.waitingOnStuddy ? (
        <p className="mt-4 font-medium">
          Nothing for you to do right now. Studdy is reviewing your service.
        </p>
      ) : null}

      <ol className="mt-5 flex flex-col gap-3">
        {checklist.steps.map((step) => {
          const copy = SETUP_STEP_COPY[step.code];
          return (
            <li
              key={step.code}
              className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius-gentle)] border border-surface-border bg-surface-card p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{copy.title}</p>
                <p className="mt-0.5 text-sm text-text-secondary">{copy.detail[step.status]}</p>
              </div>
              <div className="flex items-center gap-3">
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
    </Card>
  );
}
