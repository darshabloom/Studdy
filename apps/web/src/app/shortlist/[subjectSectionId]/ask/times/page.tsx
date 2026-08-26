import Link from 'next/link';
import { redirect } from 'next/navigation';
import { bookableSlotsForSubjectSection } from '@studdy/database';
import { Button, EmptyState } from '@studdy/design-system';
import { combineSlotsByStart, dayLabel, timeLabel } from '@studdy/domain/availability';
import { AskShell } from '@/components/ask/ask-shell';
import { AskTimeGrid, type AskTimeDay, type AskTimeOption } from '@/components/ask/ask-time-grid';
import { askHref, askStepIsReachable, type RawSearchParams } from '@/lib/ask/draft';
import { resolveAsk } from '@/lib/ask/resolve';
import { askRows } from '@/lib/ask/summary';
import { bookingIntervalLabel } from '@/lib/booking/time-labels';
import { availabilityWindow, PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'When would suit?' };

/**
 * The combined availability of the tutors this request will actually reach.
 *
 * DRAWN FROM THE INCLUDED TUTORS ONLY. Showing a time only an excluded tutor
 * could do would offer the family something the request cannot deliver — and
 * the exclusions are already explained, so this does not repeat them here.
 *
 * Starts are quarter-hourly because that is what is derivable; each is drawn
 * compactly and becomes a full interval once chosen, which is possible only
 * because every included tutor shares one lesson length.
 */
export default async function AskTimesPage({
  params,
  searchParams,
}: {
  params: Promise<{ subjectSectionId: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { subjectSectionId } = await params;
  const ask = await resolveAsk(subjectSectionId, await searchParams);
  if (ask === null) {
    redirect(`/sign-in?next=${encodeURIComponent(`/shortlist/${subjectSectionId}/ask/times`)}`);
  }

  if (!askStepIsReachable('times', ask.nextStep)) {
    redirect(askHref(subjectSectionId, ask.nextStep, ask.params));
  }

  const { eligibility, params: answers } = ask;
  const duration = answers.duration;
  if (duration === null || answers.format === null || eligibility === null) {
    redirect(askHref(subjectSectionId, 'length', {}));
  }

  const included = eligibility.included;
  const availability =
    included.length === 0
      ? []
      : await bookableSlotsForSubjectSection({
          subjectSectionId,
          tutorReferences: included.map((entry) => entry.tutorReference),
          ...availabilityWindow(),
        });

  const combined = combineSlotsByStart(
    availability.map((entry) => ({ tutorReference: entry.tutorReference, slots: entry.slots })),
  );
  const nameByReference = new Map(included.map((entry) => [entry.tutorReference, entry.firstName]));

  // Grouped and labelled here so the client component stays a selection
  // control: it receives strings, never Dates or tutor internals.
  const byDay = new Map<string, AskTimeOption[]>();
  for (const slot of combined) {
    const key = dayLabel(slot.startAt, PLATFORM_TIME_ZONE);
    const options = byDay.get(key) ?? [];
    options.push({
      startAtIso: slot.startAt.toISOString(),
      startLabel: timeLabel(slot.startAt, PLATFORM_TIME_ZONE),
      intervalLabel: bookingIntervalLabel(slot.startAt, duration),
      tutorNames: slot.tutorReferences.map(
        (reference) => nameByReference.get(reference) ?? 'A tutor',
      ),
    });
    byDay.set(key, options);
  }
  const days: AskTimeDay[] = [...byDay.entries()].map(([key, options]) => ({
    key,
    label: key,
    options,
  }));

  return (
    <AskShell
      step="times"
      subjectSectionId={subjectSectionId}
      params={answers}
      rows={askRows(ask)}
      title={`When would suit for ${String(duration)} minutes?`}
      description={`${
        answers.format === 'online' ? 'Online' : 'In person'
      }, shown in New Zealand time. Each tutor is asked only about the times they can do — none of them has to accept.`}
    >
      {days.length === 0 ? (
        <EmptyState
          title="No bookable times in the next two weeks"
          description="The tutors this request would reach have no open times in this period. You could change the lesson length, add another tutor, or check back later."
          action={
            <Button variant="secondary" asChild>
              <Link href={`/tutors?section=${subjectSectionId}`}>Add another tutor</Link>
            </Button>
          }
        />
      ) : (
        <AskTimeGrid
          days={days}
          askingCount={included.length}
          reviewHref={askHref(subjectSectionId, 'review', {
            duration,
            format: answers.format,
          })}
          chosen={answers.times}
        />
      )}
    </AskShell>
  );
}
