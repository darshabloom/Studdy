import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentRequestRules, listShortlist } from '@studdy/database';
import { Alert, Button, Card, EmptyState } from '@studdy/design-system';
import { resolveDiscoveryContext } from '@/lib/discovery/context';
import { RequestComposer } from './request-composer';

export const metadata = { title: 'Send a lesson request' };

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section: sectionId } = await searchParams;
  const context = await resolveDiscoveryContext();
  if (context === null) redirect('/sign-in?next=%2Frequests%2Fnew');

  const section = context.subjectSections.find(
    (candidate) => candidate.subjectSectionId === sectionId,
  );
  if (section === undefined) {
    return (
      <EmptyState
        title="Choose a subject first"
        description="Pick the student and subject this lesson is for, then shortlist the tutors you would like to ask."
        action={
          <Button asChild>
            <Link href="/tutors">Find a tutor</Link>
          </Button>
        }
      />
    );
  }

  const student = context.students.find(
    (candidate) => candidate.studentProfileId === section.studentProfileId,
  );
  const shortlist = await listShortlist(section.subjectSectionId);
  const rules = await currentRequestRules();

  if (shortlist.length === 0) {
    return (
      <EmptyState
        title="Shortlist a tutor first"
        description={`Add up to ${rules.fanOutCap} tutors to your shortlist for ${section.subjectDisplayName}, then send them all one request.`}
        action={
          <Button asChild>
            <Link href={`/tutors?section=${section.subjectSectionId}`}>Browse tutors</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <p className="text-sm text-text-muted">
        {student?.preferredName ?? 'Student'} · {section.subjectDisplayName}
      </p>
      <h1 className="font-display text-3xl font-semibold text-brand-purple-deep">
        Send your lesson request
      </h1>
      <p className="mt-2 text-text-secondary">
        Every tutor you choose receives the same request and replies separately. No tutor can see
        who else you asked.
      </p>

      <div className="mt-6">
        {/*
          Honest payment copy: no payment method exists yet, so we must not
          claim "your card will not be charged". This states what is true —
          nothing is charged now, and payment setup comes after selection.
        */}
        <Alert tone="information" title="Payment">
          You will not be charged when requests are sent. Payment setup and confirmation happen
          after you choose an accepted tutor.
        </Alert>
      </div>

      <Card className="mt-6">
        <RequestComposer
          subjectSectionId={section.subjectSectionId}
          subjectDisplayName={section.subjectDisplayName}
          studentName={student?.preferredName ?? 'your student'}
          fanOutCap={rules.fanOutCap}
          minimumNoticeHours={rules.minimumNoticeHours}
          shortlist={shortlist.map((entry) => ({
            tutorProfileId: entry.tutorProfileId,
            tutorFirstName: entry.firstName,
            priceAmountMinor: entry.startingPriceAmountMinor.toString(),
            currencyCode: entry.currencyCode,
          }))}
        />
      </Card>
    </>
  );
}
