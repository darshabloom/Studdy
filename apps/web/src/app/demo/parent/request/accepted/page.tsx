import Link from 'next/link';
import { Alert, Button, Card } from '@studdy/design-system';
import { DemoAvatar } from '@/components/demo/demo-avatar';
import { DemoPage } from '@/components/demo/demo-page';
import {
  FamilyRequestStatus,
  formatLessonDateTime,
  formatMoney,
} from '@/components/requests/request-status';
import { DEMO_FAMILY } from '@/lib/demo/fixtures';
import { DEMO_PARENT_STEPS } from '@/lib/demo/steps';
import { demoStory } from '@/lib/demo/story';

export const metadata = { title: 'Choose your tutor' };

/**
 * CHOOSING — a tutor AND a time together, not a tutor and then a time.
 *
 * Different tutors may accept different times, so the accepted combinations are
 * the unit of choice. With one tutor asked there is one row, which is the
 * honest shape of this family's request rather than a simplification: the
 * screen is identical with three.
 */
export default function DemoChoosePage() {
  const story = demoStory();

  return (
    <DemoPage steps={DEMO_PARENT_STEPS} current="choose">
      <Button variant="quiet" size="sm" asChild>
        <Link href="/demo/parent/request">← Back to the request</Link>
      </Button>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-text-muted">{story.reference}</p>
          <h1 className="font-display text-3xl font-semibold text-brand-purple-deep">
            Choose your tutor
          </h1>
          <p className="mt-2 max-w-2xl text-text-secondary">
            {DEMO_FAMILY.subjectDisplayName} for {DEMO_FAMILY.studentPreferredName}.{' '}
            {story.tutor.firstName} accepted the time shown, so you are choosing the tutor and the
            time together.
          </p>
        </div>
        <FamilyRequestStatus statusCode="ready_for_selection" closeReasonCode={null} />
      </div>

      <div className="mt-6">
        <Alert tone="information" title="What happens when you choose">
          The tutor you choose keeps the time on their calendar, and the others are told the request
          is closed. Payment setup comes next — nothing is charged yet, and the lesson is not booked
          until that is done.
        </Alert>
      </div>

      <Card className="mt-6 border-brand-purple/40">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-4">
            <DemoAvatar initials={story.tutor.initials} />
            <div>
              <p className="text-lg font-semibold text-text-primary">{story.tutor.firstName}</p>
              <p className="mt-1 text-sm text-text-secondary">{story.tutor.headline}</p>
              <p className="mt-3 font-medium tabular-nums text-text-primary">
                {formatLessonDateTime(story.accepted.at, story.timeZone)}
              </p>
              <p className="text-sm text-text-secondary">
                {story.durationMinutes} minutes ·{' '}
                {story.formatCode === 'online' ? 'Online' : 'In person'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold tabular-nums text-text-primary">
              {formatMoney(story.priceAmountMinor, story.currencyCode)}
            </p>
            <p className="text-xs text-text-muted">for this lesson</p>
          </div>
        </div>

        <div className="mt-5 border-t border-surface-border pt-4">
          <Button size="lg" asChild>
            <Link href="/demo/parent/pay">
              Choose {story.tutor.firstName} and set up payment
            </Link>
          </Button>
        </div>
      </Card>

      <p className="mt-4 text-sm text-text-muted">
        Your other offered time —{' '}
        {story.offered[1] === undefined
          ? null
          : formatLessonDateTime(story.offered[1].at, story.timeZone)}{' '}
        — is released when you choose.
      </p>
    </DemoPage>
  );
}
