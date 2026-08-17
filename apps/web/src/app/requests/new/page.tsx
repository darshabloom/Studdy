import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  bookableSlotsForSubjectSection,
  currentRequestRules,
  listShortlist,
} from '@studdy/database';
import { Alert, Button, Card, EmptyState } from '@studdy/design-system';
import { dayLabel, timeLabel } from '@studdy/domain/availability';
import { resolveDiscoveryContext } from '@/lib/discovery/context';
import { availabilityWindow, PLATFORM_TIME_ZONE } from '@/lib/time';
import { RequestComposer } from './request-composer';

export const metadata = { title: 'Send a lesson request' };

interface SearchParams {
  section?: string;
  /** Repeated: one per time chosen on the availability grid. */
  time?: string | string[];
}

/**
 * Review before sending (design §3.1 step 7).
 *
 * The family sees each invited tutor with **the subset of their chosen times
 * that tutor can actually do**. A tutor who can do none is called out here,
 * before anything is sent, with the choice to drop them or go back and add a
 * time they can do — never a silent omission discovered later.
 */
export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const context = await resolveDiscoveryContext();
  if (context === null) redirect('/sign-in?next=%2Frequests%2Fnew');

  const section = context.subjectSections.find(
    (candidate) => candidate.subjectSectionId === params.section,
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

  const chosenTimes = (typeof params.time === 'string' ? [params.time] : (params.time ?? []))
    .map((raw) => new Date(raw))
    .filter((at) => !Number.isNaN(at.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  const timesHref = `/shortlist/${section.subjectSectionId}/times`;
  if (chosenTimes.length === 0) {
    return (
      <EmptyState
        title="Choose some times first"
        description="Pick the times that would suit, and we will ask each tutor only about the ones they can do."
        action={
          <Button asChild>
            <Link href={timesHref}>Choose times</Link>
          </Button>
        }
      />
    );
  }

  // Which of the chosen times each shortlisted tutor can actually do. Derived
  // here so the family sees it before sending rather than discovering after.
  const availability = await bookableSlotsForSubjectSection({
    subjectSectionId: section.subjectSectionId,
    tutorReferences: shortlist.map((entry) => entry.tutorReference),
    ...availabilityWindow(),
  });
  const bookableByReference = new Map(
    availability.map((entry) => [
      entry.tutorReference,
      new Set(entry.slots.map((slot) => slot.startAt.getTime())),
    ]),
  );

  const composerTutors = shortlist.map((entry) => {
    const bookable = bookableByReference.get(entry.tutorReference) ?? new Set<number>();
    const canDo = chosenTimes.filter((at) => bookable.has(at.getTime()));
    return {
      tutorProfileId: entry.tutorProfileId,
      tutorFirstName: entry.firstName,
      priceAmountMinor: entry.startingPriceAmountMinor.toString(),
      currencyCode: entry.currencyCode,
      canDoLabels: canDo.map(
        (at) => `${dayLabel(at, PLATFORM_TIME_ZONE)}, ${timeLabel(at, PLATFORM_TIME_ZONE)}`,
      ),
    };
  });

  return (
    <>
      <p className="text-sm text-text-muted">
        {student?.preferredName ?? 'Student'} · {section.subjectDisplayName}
      </p>
      <h1 className="font-display text-3xl font-semibold text-brand-purple-deep">
        Send your lesson request
      </h1>
      <p className="mt-2 text-text-secondary">
        Every tutor you choose is asked about the times they can do, and replies separately. No
        tutor can see who else you asked.
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
          timesHref={timesHref}
          chosenTimes={chosenTimes.map((at) => ({
            iso: at.toISOString(),
            label: `${dayLabel(at, PLATFORM_TIME_ZONE)}, ${timeLabel(at, PLATFORM_TIME_ZONE)}`,
          }))}
          shortlist={composerTutors}
        />
      </Card>
    </>
  );
}
