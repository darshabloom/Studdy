import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Button, Card, EmptyState } from '@studdy/design-system';
import { AskShell } from '@/components/ask/ask-shell';
import { AskReviewForm } from '@/components/ask/ask-review-form';
import { TutorInclusion } from '@/components/ask/tutor-inclusion';
import { JourneySummary } from '@/components/journey/journey-summary';
import { askHref, askStepIsReachable, type RawSearchParams } from '@/lib/ask/draft';
import { resolveAsk } from '@/lib/ask/resolve';
import { askSections } from '@/lib/ask/sections';
import { askRows } from '@/lib/ask/summary';

export const metadata = { title: 'Review your request' };

/**
 * Check it over before sending — the one composer for this journey.
 *
 * This replaced `/requests/new`, which asked for times without ever
 * establishing what lesson was being requested and defaulted the format to
 * online without asking. Two composers with two sets of rules is how a family
 * ends up being told different things depending which path they took.
 */
export default async function AskReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ subjectSectionId: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { subjectSectionId } = await params;
  const ask = await resolveAsk(subjectSectionId, await searchParams);
  if (ask === null) {
    redirect(`/sign-in?next=${encodeURIComponent(`/shortlist/${subjectSectionId}/ask/review`)}`);
  }

  if (!askStepIsReachable('review', ask.nextStep)) {
    redirect(askHref(subjectSectionId, ask.nextStep, ask.params));
  }

  const { eligibility, params: answers, section, times } = ask;
  if (answers.duration === null || answers.format === null || eligibility === null) {
    redirect(askHref(subjectSectionId, 'length', {}));
  }

  const rows = askRows(ask);
  const sections = askSections(rows, null, subjectSectionId, answers);
  const included = eligibility.included;

  return (
    <AskShell
      step="review"
      subjectSectionId={subjectSectionId}
      params={answers}
      rows={rows}
      title="Check this over before you send"
      description={
        included.length === 0
          ? 'Nothing can be sent yet.'
          : `Nothing is booked yet. ${
              included.length === 1 ? 'This tutor' : 'These tutors'
            } will be asked, and can accept one of your times or decline.`
      }
    >
      <div className="flex flex-col gap-4">
        {/*
         * The same summary the family has watched grow, now finished — not a
         * new presentation invented for the last screen. A different-looking
         * summary at the moment of committing invites the question "is this the
         * same request?", which is exactly what a review screen exists to
         * answer.
         */}
        <Card>
          <h2 className="mb-1 text-sm font-semibold text-text-primary">Your request</h2>
          <JourneySummary sections={sections} title="Your request" caption="" bare />
        </Card>

        <Card>
          <TutorInclusion
            eligibility={eligibility}
            durationMinutes={answers.duration}
            format={answers.format}
            subjectDisplayName={section.subjectDisplayName}
          />
        </Card>

        {included.length === 0 ? (
          <EmptyState
            title="No tutor can take this request"
            description="Change the lesson length or the format, or add a tutor who offers it."
            action={
              <Button variant="secondary" asChild>
                <Link href={askHref(subjectSectionId, 'length', {})}>Change the length</Link>
              </Button>
            }
          />
        ) : times.length === 0 ? (
          <EmptyState
            title="No times chosen yet"
            description="Choose one or more times that work for you."
            action={
              <Button asChild>
                <Link
                  href={askHref(subjectSectionId, 'times', {
                    duration: answers.duration,
                    format: answers.format,
                  })}
                >
                  Choose times
                </Link>
              </Button>
            }
          />
        ) : (
          <>
            <Alert tone="information" title="Nothing is held until a tutor accepts">
              Sending this asks {included.length === 1 ? 'this tutor' : 'these tutors'} about your
              times. A time is only held once one of them accepts it.
            </Alert>

            <AskReviewForm
              subjectSectionId={subjectSectionId}
              duration={answers.duration}
              format={answers.format}
              times={answers.times}
              tutorCount={included.length}
            />
          </>
        )}
      </div>
    </AskShell>
  );
}
