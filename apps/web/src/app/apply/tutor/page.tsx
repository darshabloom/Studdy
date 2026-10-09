import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Button, Card, StatusBadge } from '@studdy/design-system';
import { applicationForApplicant, listSubjects } from '@studdy/database';
import { ApplicationForm } from '@/components/tutors/application-form';
import { resolveIdentity } from '@/lib/identity/resolve';
import {
  APPLICATION_STATUS_FAMILY,
  APPLICATION_STATUS_LABEL,
} from '@/lib/tutors/application-status';
import {
  saveApplicationAction,
  startApplicationAction,
  submitApplicationAction,
  withdrawApplicationAction,
} from '@/lib/tutors/application-actions';

export const dynamic = 'force-dynamic';

function SubmitButton({ action, label }: { action: () => Promise<void>; label: string }) {
  return (
    <form action={action}>
      <Button type="submit">{label}</Button>
    </form>
  );
}

/**
 * The applicant's own application, in whatever state it is in.
 *
 * Loads only the SIGNED-IN user's application — the repository scopes by user id,
 * and there is no reference in the URL to change — and shows the applicant what
 * Studdy chose to tell them, never a reviewer's own notes.
 */
export default async function TutorApplicationPage() {
  const identity = await resolveIdentity();
  if (identity === null) redirect('/sign-in?next=%2Fapply%2Ftutor');
  if (!identity.databaseAvailable || identity.studdyUserId === null) {
    return (
      <Alert tone="warning" title="We can’t load your application right now">
        Please try again in a few minutes.
      </Alert>
    );
  }

  const application = await applicationForApplicant(identity.studdyUserId);

  if (application === null || application.status === 'withdrawn') {
    return (
      <Card>
        <h1 className="text-2xl font-semibold">Teach with Studdy</h1>
        <p className="mt-2 text-text-secondary">
          Tell us about yourself and what you teach. A person at Studdy reads every application,
          talks to your referees and speaks with you before anyone is approved.
        </p>
        {application?.status === 'withdrawn' ? (
          <p className="mt-2 text-sm text-text-secondary">
            You withdrew your last application. You can start a new one whenever you like.
          </p>
        ) : null}
        <ul className="mt-4 list-disc pl-5 text-sm text-text-secondary">
          <li>It takes about fifteen minutes, and you can save a draft and come back.</li>
          <li>You will need two or three referees.</li>
          <li>You are never asked to upload an identity document.</li>
        </ul>
        <div className="mt-6">
          <SubmitButton action={startApplicationAction} label="Start my application" />
        </div>
      </Card>
    );
  }

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-2xl font-semibold">Your tutor application</h1>
      <StatusBadge family={APPLICATION_STATUS_FAMILY[application.status]}>
        {APPLICATION_STATUS_LABEL[application.status]}
      </StatusBadge>
    </div>
  );

  if (application.editable) {
    const subjects = await listSubjects();
    const changesRequested = application.status === 'changes_requested';
    return (
      <div className="flex flex-col gap-6">
        <div>{header}</div>
        {changesRequested ? (
          <Alert tone="warning" title="Studdy has asked for some changes">
            {application.applicantMessage ?? 'Please review your application and resubmit it.'}
          </Alert>
        ) : (
          <p className="text-text-secondary">
            Fill in what you can and save a draft at any time. Nothing is sent to a reviewer until
            you submit.
          </p>
        )}
        <Card>
          <ApplicationForm
            initial={application.form}
            subjects={subjects}
            saveAction={saveApplicationAction}
            submitAction={submitApplicationAction}
            resubmitting={changesRequested}
          />
        </Card>
        <form action={withdrawApplicationAction}>
          <Button type="submit" variant="quiet" size="sm">
            Withdraw my application
          </Button>
        </form>
      </div>
    );
  }

  if (application.status === 'submitted' || application.status === 'under_review') {
    return (
      <div className="flex flex-col gap-6">
        <div>{header}</div>
        <Card>
          <h2 className="text-lg font-semibold">We have your application</h2>
          <p className="mt-2 text-text-secondary">
            A person at Studdy is reviewing it. We will contact your referees and arrange a
            conversation with you. You will hear from us by email, and you can check back here at
            any time.
          </p>
          <p className="mt-3 text-sm text-text-muted">Reference {application.reference}</p>
        </Card>
        <form action={withdrawApplicationAction}>
          <Button type="submit" variant="quiet" size="sm">
            Withdraw my application
          </Button>
        </form>
      </div>
    );
  }

  if (application.status === 'approved') {
    return (
      <div className="flex flex-col gap-6">
        <div>{header}</div>
        <Card>
          <h2 className="text-lg font-semibold">Welcome to Studdy</h2>
          <p className="mt-2 text-text-secondary">
            You are approved. Your tutor workspace is ready — set up your availability and payout
            details there.
          </p>
          <div className="mt-6">
            <Button asChild>
              <Link href="/tutor">Go to my tutor workspace</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // rejected
  return (
    <div className="flex flex-col gap-6">
      <div>{header}</div>
      <Card>
        <h2 className="text-lg font-semibold">We are not able to approve your application</h2>
        <p className="mt-2 text-text-secondary">
          {application.applicantMessage ?? 'Thank you for applying to teach with Studdy.'}
        </p>
        <div className="mt-6">
          <Button variant="secondary" asChild>
            <Link href="/">Back to Studdy</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
