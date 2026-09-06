import Link from 'next/link';
import { Alert, Button, Card } from '@studdy/design-system';
import { DemoNote } from '@/components/demo/demo-page';
import { DemoTutorShell } from '@/components/demo/demo-tutor-shell';
import {
  TutorRequestStatus,
  formatDeadline,
  formatLessonDateTime,
  formatMoney,
} from '@/components/requests/request-status';
import { DEMO_FAMILY } from '@/lib/demo/fixtures';
import { acceptedTime, demoStory } from '@/lib/demo/story';

export const metadata = { title: 'You accepted this time' };

/**
 * ACCEPTED, AND HELD — which is not the same as booked.
 *
 * This is the state the product is most easily misread in, so the screen says
 * the quiet part out loud: the family still has to choose this tutor and then
 * pay, the hold has an expiry, and it is released either way when that expiry
 * passes. A tutor who believes a hold is a booking keeps a slot free for
 * nothing.
 *
 * The request's own status stays `accepted`. There is no `confirmed` status on
 * a tutor request — a confirmed booking is recorded on the reservation, which
 * is what the calendar screen reads.
 */
export default async function DemoTutorAcceptedPage({
  searchParams,
}: {
  searchParams: Promise<{ time?: string }>;
}) {
  const { time } = await searchParams;
  const story = demoStory();
  const accepted = acceptedTime(story, time);
  const forward = time === undefined ? '' : `?time=${encodeURIComponent(time)}`;

  return (
    <DemoTutorShell current="accepted">
      <Button variant="quiet" size="sm" asChild>
        <Link href="/demo/tutor/requests/aroha-maths">← Back to the request</Link>
      </Button>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-text-muted">{story.tutorRequestReference}</p>
          <h1 className="font-display text-2xl font-semibold text-brand-purple-deep">
            {DEMO_FAMILY.subjectDisplayName} with {DEMO_FAMILY.studentPreferredName}
          </h1>
        </div>
        <TutorRequestStatus statusCode="accepted" />
      </div>

      <div className="mt-6">
        <Alert tone="information" title="You accepted this time">
          <p className="font-medium tabular-nums">
            {formatLessonDateTime(accepted.at, story.timeZone)}
          </p>
          <p className="mt-1">
            It is held on your calendar until {formatDeadline(story.holdExpiresAt, story.timeZone)}.
            The family is choosing now — this may or may not become a booking, and the hold is
            released either way when it expires.
          </p>
        </Alert>
      </div>

      <Card className="mt-6">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Pair label="Lesson length" value={`${String(story.durationMinutes)} minutes`} />
          <Pair label="Format" value={story.formatCode === 'online' ? 'Online' : 'In person'} />
          <Pair label="Year" value={DEMO_FAMILY.schoolYearCode} />
          <Pair
            label="You would be paid"
            value={formatMoney(story.priceAmountMinor, story.currencyCode)}
          />
        </dl>
      </Card>

      <div className="mt-8">
        <DemoNote title="Now the family pays">
          <p>
            {DEMO_FAMILY.parentName} chooses you, pays, and Studdy confirms the booking. In the real
            product a Stripe webhook does that — the tutor is not waiting on anybody to press
            anything.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link href={`/demo/tutor/calendar${forward}`}>See the confirmed lesson</Link>
            </Button>
            <Button variant="quiet" asChild>
              <Link href="/demo/parent/pay">Watch the parent pay</Link>
            </Button>
          </div>
        </DemoNote>
      </div>
    </DemoTutorShell>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-text-secondary">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
