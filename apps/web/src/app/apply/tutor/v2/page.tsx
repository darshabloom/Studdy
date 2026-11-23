import Link from 'next/link';
import { Card, Button } from '@studdy/design-system';
import {
  applicationForApplicant,
  applicationV2DraftForApplicant,
  listSubjects,
} from '@studdy/database';
import { TutorApplicationV2Wizard } from '@/components/tutors/application-v2-wizard';
import { resolveIdentity } from '@/lib/identity/resolve';
import { saveV2DraftAction, startV2ApplicationAction } from '@/lib/tutors/application-v2-actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tutor Application — Six Steps' };

export default async function TutorApplicationV2Page() {
  // Personal DOB and referee records must not be collected until the dedicated
  // safeguarding/privacy workflow and immutable v2 submission are released.
  if (process.env.STUDDY_APPLICATION_V2_ENABLED !== 'true') {
    return <Card>
      <h1 className="text-xl font-semibold">Six-step application design preview</h1>
      <p className="my-4 text-sm">
        The new application is being verified. You can explore every step using
        synthetic details without affecting your existing tutor application.
      </p>
      <Link href="/apply/tutor/v2/preview" className="font-semibold text-brand-purple underline">
        Open interactive preview
      </Link>
    </Card>;
  }
  const identity = await resolveIdentity();
  if (identity === null || identity.studdyUserId === null || !identity.databaseAvailable) {
    return (
      <Card>
        <h1 className="font-semibold">Your application is unavailable</h1>
        <p className="mt-2 text-sm">Please sign in and try again.</p>
        <Link
          className="mt-3 inline-block text-brand-purple underline"
          href="/sign-in?next=%2Fapply%2Ftutor%2Fv2"
        >
          Sign in
        </Link>
      </Card>
    );
  }
  const application = await applicationForApplicant(identity.studdyUserId);
  if (application?.status === 'approved') {
    return (
      <Card>
        <h1 className="text-xl font-semibold">Your application is approved</h1>
        <p className="mt-3 text-sm">
          You can review the proposed questionnaire with synthetic details. Your existing tutor
          status and profile stay unchanged.
        </p>
        <Link
          className="mt-4 inline-block text-brand-purple underline"
          href="/apply/tutor/v2/preview"
        >
          Open interactive design preview
        </Link>
      </Card>
    );
  }
  if (application !== null && !application.editable) {
    return (
      <Card>
        <h1 className="font-semibold">
          Your application is {application.status.replaceAll('_', ' ')}
        </h1>
        <p className="mt-2 text-sm">This application can no longer be edited.</p>
        <Link className="mt-3 inline-block text-brand-purple underline" href="/apply/tutor">
          View your application status
        </Link>
      </Card>
    );
  }
  if (application === null) {
    return (
      <Card>
        <h1 className="text-xl font-semibold">Apply to tutor with Studdy</h1>
        <p className="my-4 text-sm">
          Start the approved six-step questionnaire. Your answers will save as a private draft as
          you go.
        </p>
        <form action={startV2ApplicationAction}>
          <Button type="submit">Start my application</Button>
        </form>
      </Card>
    );
  }
  const state = await applicationV2DraftForApplicant(identity.studdyUserId);
  if (state.status === 'legacy_requires_review') {
    return (
      <Card>
        <h1 className="text-xl font-semibold">Your previous application draft</h1>
        <p className="my-4 text-sm">
          Your answers in the earlier questionnaire are protected. If the draft only contains
          account prefill, Studdy can safely prepare the new form. A previously completed draft
          needs guided migration.
        </p>
        <form action={startV2ApplicationAction}>
          <Button type="submit">Prepare six-step application</Button>
        </form>
        <Link className="mt-4 inline-block text-brand-purple underline" href="/apply/tutor">
          Return to original application
        </Link>
      </Card>
    );
  }
  if (state.status !== 'ready') {
    return (
      <Card>
        <h1 className="font-semibold">Your draft cannot be edited</h1>
        <Link href="/apply/tutor" className="mt-3 inline-block underline">
          View application status
        </Link>
      </Card>
    );
  }
  const subjects = await listSubjects();
  return (
    <TutorApplicationV2Wizard
      initial={state.draft}
      initialVersion={state.recordVersion}
      subjects={subjects}
      saveAction={saveV2DraftAction}
    />
  );
}
