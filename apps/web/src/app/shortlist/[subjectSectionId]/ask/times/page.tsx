import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button, EmptyState } from '@studdy/design-system';
import { AskShell } from '@/components/ask/ask-shell';
import { AskTimePicker } from '@/components/ask/ask-time-picker';
import { askAvailability, tutorNameList } from '@/lib/ask/availability';
import { askHref, askStepIsReachable, type RawSearchParams } from '@/lib/ask/draft';
import { resolveAsk } from '@/lib/ask/resolve';
import { askRows } from '@/lib/ask/summary';
import { bookingIntervalLabel } from '@/lib/booking/time-labels';
import { AVAILABILITY_WINDOW_DAYS } from '@/lib/time';

export const metadata = { title: 'When would suit?' };

/**
 * When would suit, drawn as a week rather than listed as a fortnight.
 *
 * THE SAME CALENDAR THE SINGLE-TUTOR JOURNEY USES. This screen was a
 * chronological list of every quarter-hour start across the whole horizon —
 * about a hundred and eighty checkboxes, seven thousand pixels tall — and a
 * family who had just chosen a time had to hunt for the way on. It is now the
 * step 4 interaction: one week at a time, starts as markers on `WeekCalendar`,
 * paged with Earlier and Later, and the selection carried across a page change.
 *
 * DRAWN FROM THE INCLUDED TUTORS ONLY, at the shared duration and format the
 * family has already chosen. A start is offered when at least one included
 * tutor can do it; where fewer than all of them can, the marker says so.
 *
 * Starts stay quarter-hourly because that is what is derivable. Each is drawn
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
  const availability = await askAvailability(ask);

  const title = `When would suit for ${String(duration)} minutes?`;
  const description = `${
    answers.format === 'online' ? 'Online' : 'In person'
  }, shown in New Zealand time. Each tutor is asked only about the times they can do — none of them has to accept.`;

  if (availability === null) {
    return (
      <AskShell
        step="times"
        subjectSectionId={subjectSectionId}
        params={answers}
        rows={askRows(ask)}
        title={title}
        description={description}
      >
        <EmptyState
          title="Those times could not be worked out"
          description="Go back a step and try again."
          action={
            <Button variant="secondary" asChild>
              <Link href={askHref(subjectSectionId, 'length', {})}>Change the length</Link>
            </Button>
          }
        />
      </AskShell>
    );
  }

  const base = { duration, format: answers.format };

  /*
   * The chip a chosen time becomes carries the whole INTERVAL, not the start,
   * and names which of the family's own included tutors can do it.
   *
   * On the grid a marker reads `4:15 pm` because the heading has just said how
   * long the lesson is and who is being asked. A chip sits below in its own box
   * and gets read on its own, so it says the thing actually being asked for.
   * The tutor's minimum gap is deliberately not in it.
   */
  const labelFor: Record<string, string> = {};
  const detailFor: Record<string, string> = {};
  for (const [iso, names] of Object.entries(availability.namesByStart)) {
    labelFor[iso] = bookingIntervalLabel(new Date(iso), duration);
    // Named rather than counted. A chip has left the grid's context, the list
    // is never longer than a shortlist, and a name is what the family saved.
    detailFor[iso] = `${tutorNameList(names)} can do this`;
  }

  return (
    <AskShell
      step="times"
      subjectSectionId={subjectSectionId}
      params={answers}
      rows={askRows(ask)}
      title={title}
      description={description}
    >
      <AskTimePicker
        blocks={availability.blocks}
        window={availability.window}
        dayLabels={availability.dayLabels}
        rangeLabel={availability.rangeLabel}
        summary={availability.summary}
        todayIndex={availability.todayIndex}
        previousHref={
          availability.hasPrevious
            ? askHref(subjectSectionId, 'times', { ...base, week: availability.page - 1 })
            : null
        }
        nextHref={
          availability.hasNext
            ? askHref(subjectSectionId, 'times', { ...base, week: availability.page + 1 })
            : null
        }
        horizonDays={AVAILABILITY_WINDOW_DAYS}
        lessonLengthLabel={`Lessons are ${String(duration)} minutes long.`}
        chosen={answers.times}
        labelFor={labelFor}
        detailFor={detailFor}
        askingCount={included.length}
        addTutorHref={`/tutors?section=${subjectSectionId}`}
        reviewHref={askHref(subjectSectionId, 'review', base)}
      />
    </AskShell>
  );
}
