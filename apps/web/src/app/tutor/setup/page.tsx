import Link from 'next/link';
import { tutorSetupFacts } from '@studdy/database';
import { Alert, Card, RestrictedState } from '@studdy/design-system';
import { tutorSetupChecklist } from '@studdy/domain/tutors';
import { SETUP_STEP_COPY } from '@/lib/tutors/service-status';
import { requireTutor } from '@/lib/tutors/tutor-session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tutor setup' };

const STATUS: Record<'done' | 'todo' | 'waiting' | 'blocked', string> = {
  done: 'Complete',
  todo: 'Action required',
  waiting: 'With Studdy for review',
  blocked: 'Waiting on earlier steps',
};

/**
 * Read-only onboarding journey: readiness is computed from the same trusted
 * database projection and pure checklist as Tutor Home. Publication and
 * approval still happen through the existing server-authoritative commands.
 */
export default async function TutorSetupPage() {
  const actor = await requireTutor('/tutor/setup');
  const facts = await tutorSetupFacts(actor.tutorProfileId);

  if (facts === null) {
    return <RestrictedState title="Your tutor setup is not available yet" />;
  }

  const checklist = tutorSetupChecklist(facts);

  return (
    <div className="flex flex-col gap-4 text-text-primary">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-parent-navy">
            Set up your tutoring
          </h1>
          <p className="mt-1 max-w-prose text-sm text-text-secondary">
            Complete these six stages to become ready for families to book.
            Studdy reviews each service before you can publish it.
          </p>
        </div>
        <Link href="/tutor" className="text-sm font-semibold text-parent-navy underline">
          Back to Tutor Home
        </Link>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Your progress</h2>
          <p className="text-sm font-semibold tabular-nums">
            {checklist.percentComplete}% complete
          </p>
        </div>
        <p className="mt-1 text-sm text-text-secondary">
          {checklist.steps.filter((step) => step.status === 'done').length} of 6 stages complete
        </p>
      </Card>

      {checklist.bookable ? (
        <Alert tone="success" title="Your tutoring is ready">
          Your setup has passed all six checks, including payment readiness and publication.
        </Alert>
      ) : checklist.waitingOnStuddy ? (
        <Alert tone="information" title="Waiting for Studdy">
          Your remaining service is in review. You can check its status in your services.
        </Alert>
      ) : (
        <Alert tone="information" title="Setup in progress">
          Complete the actions below. The status of each stage comes from your current
          profile, services, availability and payment readiness.
        </Alert>
      )}

      <ol className="grid gap-3 sm:grid-cols-2" aria-label="Six tutor onboarding stages">
        {checklist.steps.map((step, index) => {
          const copy = SETUP_STEP_COPY[step.code];
          const isNext = checklist.nextStep === step.code;
          return (
            <li key={step.code}>
              <Card>
                <div className="flex items-start gap-3">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      step.status === 'done'
                        ? 'bg-parent-navy text-white'
                        : isNext
                          ? 'bg-studdy-orange text-white'
                          : 'bg-parent-gold-pale text-parent-navy'
                    }`}
                    aria-hidden="true"
                  >
                    {step.status === 'done' ? '✓' : index + 1}
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-semibold">{copy.title}</h2>
                    <p className="mt-0.5 text-xs font-semibold text-text-secondary">
                      {STATUS[step.status]}{isNext ? ' · Next action' : ''}
                    </p>
                    <p className="mt-2 text-sm text-text-secondary">
                      {copy.detail[step.status]}
                    </p>
                    {step.status === 'todo' ? (
                      <Link
                        href={copy.href}
                        className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-parent-navy px-3 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-studdy-orange"
                      >
                        {copy.actionLabel} →
                      </Link>
                    ) : step.status === 'waiting' ? (
                      <Link href={copy.href} className="mt-3 inline-block text-sm font-semibold text-parent-navy underline">
                        Check review status
                      </Link>
                    ) : null}
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
