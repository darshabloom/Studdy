import Link from 'next/link';
import { Button, Card } from '@studdy/design-system';
import { DemoTutorResponse } from '@/components/demo/demo-tutor-response';
import { DemoTutorShell } from '@/components/demo/demo-tutor-shell';
import {
  TutorRequestStatus,
  formatDeadline,
  formatLessonDateTime,
  formatMoney,
} from '@/components/requests/request-status';
import { DEMO_FAMILY } from '@/lib/demo/fixtures';
import { demoStory } from '@/lib/demo/story';

export const metadata = { title: 'Lesson request' };

/**
 * INSPECT AND ANSWER — the one screen where a tutor does something.
 *
 * Accepting is a choice of ONE time from the ones offered. The copy is careful
 * that accepting HOLDS the time rather than books it: the family still has to
 * choose this tutor and then pay, and a tutor who thinks a lesson is confirmed
 * when it is not will keep the slot free for nothing.
 *
 * The buttons are links. There is no server action, nothing is written, and the
 * accepted state lives at its own URL — which is what makes the demo repeatable.
 */
export default function DemoTutorRequestPage() {
  const story = demoStory();

  return (
    <DemoTutorShell current="inspect">
      <Button variant="quiet" size="sm" asChild>
        <Link href="/demo/tutor/requests">← Back to requests</Link>
      </Button>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-text-muted">{story.tutorRequestReference}</p>
          <h1 className="font-display text-2xl font-semibold text-brand-purple-deep">
            {DEMO_FAMILY.subjectDisplayName} with {DEMO_FAMILY.studentPreferredName}
          </h1>
        </div>
        <TutorRequestStatus statusCode="sent" />
      </div>

      <Card className="mt-6">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Pair label="Lesson length" value={`${String(story.durationMinutes)} minutes`} />
          <Pair label="Format" value={story.formatCode === 'online' ? 'Online' : 'In person'} />
          <Pair
            label="Your price"
            value={formatMoney(story.priceAmountMinor, story.currencyCode)}
          />
          <Pair label="Reply by" value={formatDeadline(story.respondByAt, story.timeZone)} />
          <Pair label="Year" value={DEMO_FAMILY.schoolYearCode} />
        </dl>

        <div className="mt-4 border-t border-surface-border pt-4">
          <h2 className="text-sm font-semibold text-text-primary">From the family</h2>
          <p className="mt-1 text-text-secondary">{DEMO_FAMILY.notesForTutors}</p>
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="text-lg font-semibold">Can you do one of these times?</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Accepting holds the time on your calendar while the family decides. You can accept one
          time.
        </p>

        <DemoTutorResponse
          options={story.offered.map((time) => ({
            iso: time.at.toISOString(),
            label: formatLessonDateTime(time.at, story.timeZone),
          }))}
        />

        <div className="mt-5 border-t border-surface-border pt-4">
          <Button variant="quiet" size="sm" asChild>
            <Link href="/demo/tutor/requests">Decline — none of these work</Link>
          </Button>
        </div>
      </Card>
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
