import Link from 'next/link';
import { Alert, Card } from '@studdy/design-system';
import { DemoTutorShell } from '@/components/demo/demo-tutor-shell';
import {
  TutorRequestStatus,
  formatDeadline,
  formatLessonDateTime,
  formatMoney,
} from '@/components/requests/request-status';
import { DEMO_FAMILY } from '@/lib/demo/fixtures';
import { demoStory } from '@/lib/demo/story';

export const metadata = { title: 'Lesson requests' };

/**
 * A TUTOR SEES ONLY THEIR OWN REQUESTS.
 *
 * The production projection behind this screen selects no Intended Lesson
 * Request identifier, no slot position and no close reason, so nothing here can
 * reveal whether other tutors were asked, how many, who they were or how they
 * responded. The demo data is shaped the same way — there is no field on this
 * page that could carry it — because a demo that quietly showed more than the
 * product does would misrepresent the thing it is demonstrating.
 */
export default function DemoTutorRequestsPage() {
  const story = demoStory();

  return (
    <DemoTutorShell current="request">
      <h1 className="font-display text-2xl font-semibold text-brand-purple-deep">
        Lesson requests
      </h1>
      <p className="mt-2 text-text-secondary">
        Families send you a request when they would like a lesson at a particular time.
      </p>

      <div className="mt-4">
        <Alert tone="information" title="Accepting holds the time">
          Open a request to accept one of the times you were offered, or to decline. Accepting holds
          that time on your calendar while the family decides.
        </Alert>
      </div>

      <p className="mt-6 text-sm font-medium text-text-secondary">1 awaiting your response</p>

      <ul className="mt-3 flex flex-col gap-4">
        <li>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-text-muted">{story.tutorRequestReference}</p>
                <p className="text-lg font-semibold">
                  <Link className="hover:underline" href="/demo/tutor/requests/aroha-maths">
                    {DEMO_FAMILY.subjectDisplayName} with {DEMO_FAMILY.studentPreferredName}
                  </Link>
                </p>
                {/* The times THIS tutor was offered. Never a count of the
                    family's full set — only their own subset. */}
                <ul className="mt-1 flex flex-col gap-0.5 text-sm text-text-secondary">
                  {story.offered.map((time) => (
                    <li key={time.id} className="tabular-nums">
                      {formatLessonDateTime(time.at, story.timeZone)}
                    </li>
                  ))}
                </ul>
              </div>
              <TutorRequestStatus statusCode="sent" />
            </div>

            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <Pair label="Length" value={`${String(story.durationMinutes)} minutes`} />
              <Pair
                label="Format"
                value={story.formatCode === 'online' ? 'Online' : 'In person'}
              />
              <Pair label="Year level" value={DEMO_FAMILY.schoolYearCode} />
              <Pair
                label="Your rate for this lesson"
                value={formatMoney(story.priceAmountMinor, story.currencyCode)}
              />
            </dl>

            <div className="mt-4">
              <p className="text-sm text-text-secondary">What the family told you</p>
              <p className="mt-1 text-sm">{DEMO_FAMILY.notesForTutors}</p>
            </div>

            {/* The temporary hold, labelled as temporary and always shown with
                its expiry so it never appears open-ended. */}
            <div className="mt-4 rounded-[var(--radius-medium)] border border-status-warning-border bg-status-warning-bg p-3">
              <p className="text-sm font-semibold text-status-warning">Temporary request hold</p>
              <p className="mt-1 text-sm text-text-primary">
                These times are held in your calendar until{' '}
                <strong>{formatDeadline(story.holdExpiresAt, story.timeZone)}</strong>. If the
                request is not taken up by then, the hold is released automatically and the time is
                yours again.
              </p>
            </div>

            <p className="mt-4 text-sm text-text-secondary">
              Reply due by <strong>{formatDeadline(story.respondByAt, story.timeZone)}</strong>.
            </p>
          </Card>
        </li>
      </ul>
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
