import Link from 'next/link';
import { Alert, Button, Card, StatusBadge } from '@studdy/design-system';
import { DemoAvatar } from '@/components/demo/demo-avatar';
import { DemoNote, DemoPage } from '@/components/demo/demo-page';
import {
  FamilyRequestStatus,
  FamilyTutorRequestStatus,
  formatDeadline,
  formatLessonDateTime,
  formatMoney,
} from '@/components/requests/request-status';
import { DEMO_FAMILY } from '@/lib/demo/fixtures';
import { DEMO_PARENT_STEPS } from '@/lib/demo/steps';
import { demoStory } from '@/lib/demo/story';

export const metadata = { title: 'Your request' };

/**
 * THE REQUEST, SENT AND WAITING.
 *
 * Rendered with the production `FamilyRequestStatus` and
 * `FamilyTutorRequestStatus` badges, so the vocabulary a reviewer reads here is
 * the product's own — "Awaiting response", not a label written for the demo.
 *
 * The one thing the demo has to fake is TIME. In reality a tutor replies over
 * the following hours; here that is a button, and the note beside it says so
 * plainly rather than letting a reviewer think the product works that way.
 */
export default function DemoRequestSentPage() {
  const story = demoStory();

  return (
    <DemoPage steps={DEMO_PARENT_STEPS} current="request">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-text-muted">{story.reference}</p>
          <h1 className="font-display text-3xl font-semibold text-brand-purple-deep">
            {DEMO_FAMILY.subjectDisplayName} for {DEMO_FAMILY.studentPreferredName}
          </h1>
        </div>
        <FamilyRequestStatus statusCode="awaiting_responses" closeReasonCode={null} />
      </div>

      <Card className="mt-6">
        <h2 className="text-lg font-semibold">The lesson you asked for</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-text-secondary">Times you offered</dt>
            <dd className="font-medium">
              <ul className="flex flex-col gap-1">
                {story.offered.map((time) => (
                  <li key={time.id} className="tabular-nums">
                    {formatLessonDateTime(time.at, story.timeZone)}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
          <div>
            <dt className="text-text-secondary">Length</dt>
            <dd className="font-medium">{story.durationMinutes} minutes</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Format</dt>
            <dd className="font-medium">
              {story.formatCode === 'online' ? 'Online' : 'In person'}
            </dd>
          </div>
          <div>
            <dt className="text-text-secondary">Choose a tutor by</dt>
            <dd className="font-medium">
              {formatDeadline(story.decisionDeadlineAt, story.timeZone)}
            </dd>
          </div>
        </dl>
        <div className="mt-4">
          <p className="text-sm text-text-secondary">What you told the tutors</p>
          <p className="mt-1 text-sm">{DEMO_FAMILY.notesForTutors}</p>
        </div>
      </Card>

      <div className="mt-6">
        <Alert tone="information" title="What happens next">
          Each tutor replies separately, and no tutor can see who else you asked. When one accepts a
          time you offered, you will be able to choose them here. Nothing is held or charged until
          then.
        </Alert>
      </div>

      <h2 className="mt-8 text-lg font-semibold">Tutors you asked (1)</h2>
      <ul className="mt-3 flex flex-col gap-3">
        <li>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex gap-3">
                <DemoAvatar initials={story.tutor.initials} size="sm" />
                <div>
                  <p className="font-semibold">{story.tutor.firstName}</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {formatMoney(story.priceAmountMinor, story.currencyCode)} for this lesson
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Reply due by {formatDeadline(story.respondByAt, story.timeZone)}
                  </p>
                </div>
              </div>
              <FamilyTutorRequestStatus statusCode="sent" closeReasonCode={null} />
            </div>
          </Card>
        </li>
      </ul>

      <div className="mt-8">
        <DemoNote title="In the real product you would wait here">
          <p>
            {story.tutor.firstName} gets the request in her workspace and has until{' '}
            {formatDeadline(story.respondByAt, story.timeZone)} to reply. The family is emailed the
            moment she does.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link href="/demo/parent/request/accepted">
                Skip the wait — {story.tutor.firstName} accepts
              </Link>
            </Button>
            <Button variant="quiet" asChild>
              <Link href="/demo/tutor/requests/aroha-maths">
                Watch her do it <StatusBadge family="pending">Tutor view</StatusBadge>
              </Link>
            </Button>
          </div>
        </DemoNote>
      </div>
    </DemoPage>
  );
}
