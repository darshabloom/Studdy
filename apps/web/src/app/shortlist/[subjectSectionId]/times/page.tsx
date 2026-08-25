import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { bookableSlotsForSubjectSection, listShortlist } from '@studdy/database';
import { Alert, Button, EmptyState } from '@studdy/design-system';
import {
  REQUEST_TIME_OPTIONS_MAX,
  REQUEST_TIME_OPTIONS_MIN,
  combineSlotsByStart,
  dayLabel,
  timeLabel,
  TIME_OPTIONS_GUIDANCE,
} from '@studdy/domain/availability';
import { schoolYearLabel } from '@studdy/domain/students';
import { TimeGrid } from '@/components/discovery/time-grid';
import { resolveDiscoveryContext } from '@/lib/discovery/context';
import { availabilityWindow, PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Choose times' };

/**
 * The combined availability grid (design §3.1 step 6).
 *
 * The family sees when their shortlisted tutors are free, all on one grid, and
 * picks a small set of times that suit the student. Each time says how many of
 * *their own* shortlist can do it — never anything about the platform, and
 * never why a tutor is absent from one.
 */
export default async function ChooseTimesPage({
  params,
}: {
  params: Promise<{ subjectSectionId: string }>;
}) {
  const { subjectSectionId } = await params;
  const context = await resolveDiscoveryContext();
  if (context === null)
    redirect(`/sign-in?next=${encodeURIComponent(`/shortlist/${subjectSectionId}/times`)}`);

  // Server-authoritative: the section must belong to this user.
  const section = context.subjectSections.find(
    (candidate) => candidate.subjectSectionId === subjectSectionId,
  );
  if (section === undefined) notFound();

  const student = context.students.find(
    (candidate) => candidate.studentProfileId === section.studentProfileId,
  );
  const entries = await listShortlist(subjectSectionId);

  const availability =
    entries.length === 0
      ? []
      : await bookableSlotsForSubjectSection({
          subjectSectionId,
          tutorReferences: entries.map((entry) => entry.tutorReference),
          ...availabilityWindow(),
        });

  const combined = combineSlotsByStart(
    availability.map((entry) => ({
      tutorReference: entry.tutorReference,
      slots: entry.slots,
    })),
  );

  const nameByReference = new Map(entries.map((entry) => [entry.tutorReference, entry.firstName]));

  // Grouped and labelled here so the client component stays a selection
  // control: it receives strings, never Dates or tutor internals.
  const days: {
    key: string;
    label: string;
    options: { startAtIso: string; label: string; tutorNames: string[] }[];
  }[] = [];
  for (const slot of combined) {
    const key = dayLabel(slot.startAt, PLATFORM_TIME_ZONE);
    const option = {
      startAtIso: slot.startAt.toISOString(),
      label: timeLabel(slot.startAt, PLATFORM_TIME_ZONE),
      tutorNames: slot.tutorReferences.map(
        (reference) => nameByReference.get(reference) ?? 'A tutor',
      ),
    };
    const existing = days.find((day) => day.key === key);
    if (existing === undefined) days.push({ key, label: key, options: [option] });
    else existing.options.push(option);
  }

  return (
    <div className="min-h-screen bg-surface-page">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Button variant="quiet" size="sm" asChild>
          <Link href={`/shortlist/${subjectSectionId}`}>← Back to shortlist</Link>
        </Button>

        <div className="mt-4">
          <h1 className="font-display text-3xl font-semibold text-brand-purple-deep">
            Choose times that suit
          </h1>
          <p className="mt-1 text-text-secondary">
            {student !== undefined ? (
              <>
                <span className="font-medium text-text-primary">{student.preferredName}</span>{' '}
                ·{' '}
              </>
            ) : null}
            {section.subjectDisplayName}
            {section.schoolYearCode !== null ? ` · ${schoolYearLabel(section.schoolYearCode)}` : ''}
          </p>
          {/* The approved wording, shared with the single-tutor journey: it
              recommends flexibility rather than demanding it. */}
          <p className="mt-2 max-w-xl text-sm text-text-secondary">{TIME_OPTIONS_GUIDANCE}</p>
        </div>

        {entries.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="No tutors saved yet"
              description="Shortlist a tutor first, and their available times will appear here."
              action={
                <Button asChild>
                  <Link href={`/tutors?section=${subjectSectionId}`}>Find tutors</Link>
                </Button>
              }
            />
          </div>
        ) : combined.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="No bookable times in the next two weeks"
              description="Your shortlisted tutors have no open times in this period. You could add another tutor, or check back later."
              action={
                <Button variant="secondary" asChild>
                  <Link href={`/tutors?section=${subjectSectionId}`}>Add another tutor</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <div className="mt-6">
              <Alert tone="information" title="Nothing is held until a tutor accepts">
                Choosing times here does not book or reserve anything. You will pick{' '}
                {REQUEST_TIME_OPTIONS_MIN}–{REQUEST_TIME_OPTIONS_MAX} times, and each tutor is asked
                only about the ones they can do.
              </Alert>
            </div>

            <TimeGrid
              subjectSectionId={subjectSectionId}
              days={days}
              shortlistSize={entries.length}
            />
          </>
        )}
      </div>
    </div>
  );
}
