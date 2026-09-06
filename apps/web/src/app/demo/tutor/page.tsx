import Link from 'next/link';
import { Button, Card, EmptyState } from '@studdy/design-system';
import { DemoTutorShell } from '@/components/demo/demo-tutor-shell';
import { formatDeadline, formatLessonDateTime } from '@/components/requests/request-status';
import { DEMO_FAMILY } from '@/lib/demo/fixtures';
import { demoStory } from '@/lib/demo/story';
import { bookableStarts } from '@/lib/demo/timeline';

export const metadata = { title: 'Tutor workspace' };

/**
 * THE TUTOR DASHBOARD — what needs answering today, and nothing else.
 *
 * The unbuilt sidebar sections keep their "soon" markers. Hiding them would
 * show a more finished product than Studdy is, and a portfolio is a bad place
 * to start being imprecise about that.
 */
export default function DemoTutorDashboardPage() {
  const story = demoStory();
  const slots = bookableStarts(story.tutor.bands, story.week.days, story.durationMinutes);

  return (
    <DemoTutorShell current="dashboard">
      <h1 className="font-display text-2xl font-semibold text-brand-purple-deep">
        Your tutoring at a glance
      </h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-text-secondary">Awaiting your response</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">1</p>
          <p className="mt-1 text-sm text-text-secondary">
            Soonest reply due {formatDeadline(story.respondByAt, story.timeZone)}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-text-secondary">Bookable slots, next 7 days</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{slots.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-secondary">One-off changes ahead</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">0</p>
        </Card>
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Requests needing a response</h2>
          <Button asChild variant="secondary" size="sm">
            <Link href="/demo/tutor/requests">View all requests</Link>
          </Button>
        </div>
        <ul className="mt-3 flex flex-col gap-3">
          <li>
            <Card className="transition-colors hover:border-brand-purple/40">
              <p className="font-semibold">
                <Link href="/demo/tutor/requests/aroha-maths" className="hover:underline">
                  {DEMO_FAMILY.subjectDisplayName} with {DEMO_FAMILY.studentPreferredName}
                </Link>
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                {DEMO_FAMILY.schoolYearCode} · {story.durationMinutes} minutes ·{' '}
                {story.formatCode === 'online' ? 'Online' : 'In person'}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Reply due {formatDeadline(story.respondByAt, story.timeZone)}
              </p>
            </Card>
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">Time currently held in your calendar</h2>
        <div className="mt-3">
          <EmptyState
            title="No time held right now"
            description="When a request is holding a slot for you, it shows here with the time it is held until."
          />
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Your availability</h2>
          <Button asChild size="sm">
            <Link href="/demo/tutor/calendar">Manage availability</Link>
          </Button>
        </div>
        <p className="mt-1 text-text-secondary">
          {story.tutor.bands.length} regular weekly blocks in {story.timeZone}. Next bookable slot{' '}
          {slots[0] === undefined
            ? 'none in this window'
            : formatLessonDateTime(slots[0].at, story.timeZone)}
          .
        </p>
      </section>
    </DemoTutorShell>
  );
}
