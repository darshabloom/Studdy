import Link from 'next/link';
import { Alert, Button, Card, StatusBadge, WeekCalendar } from '@studdy/design-system';
import { DemoNote } from '@/components/demo/demo-page';
import { DemoTutorShell } from '@/components/demo/demo-tutor-shell';
import { formatLessonDateTime, formatMoney } from '@/components/requests/request-status';
import { profileCalendarWindow } from '@/lib/availability/calendar-projection';
import { DEMO_FAMILY } from '@/lib/demo/fixtures';
import { acceptedTime, demoStory, tutorWeekWithLesson } from '@/lib/demo/story';

export const metadata = { title: 'Your week' };

/**
 * THE CONFIRMED LESSON, ON THE CALENDAR.
 *
 * A CONFIRMED BOOKING IS NOT A HOLD, and the difference is carried by the
 * reservation rather than by the request's status — the same row the
 * availability calendar labels a lesson, so the two screens cannot disagree.
 *
 * This is the same `WeekCalendar` the parent saw on the tutor's profile and on
 * their own confirmation, with the same green `lesson` role. The green block
 * here and the green block there are one lesson, computed once.
 */
export default async function DemoTutorCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ time?: string }>;
}) {
  const { time } = await searchParams;
  const story = demoStory();
  const accepted = acceptedTime(story, time);
  const blocks = tutorWeekWithLesson(story, accepted);

  return (
    <DemoTutorShell current="calendar">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-brand-purple-deep">Your week</h1>
          <p className="mt-1 text-text-secondary">{story.week.rangeLabel}</p>
        </div>
        <StatusBadge family="complete">1 confirmed lesson</StatusBadge>
      </div>

      <div className="mt-6">
        <Alert tone="success" title="This lesson is booked">
          <p className="font-medium tabular-nums">
            {formatLessonDateTime(accepted.at, story.timeZone)} ·{' '}
            {DEMO_FAMILY.subjectDisplayName} with {DEMO_FAMILY.studentPreferredName}
          </p>
          <p className="mt-1">
            The family has paid and this time is confirmed on your calendar. It no longer expires.
          </p>
        </Alert>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-text-primary">
              Availability and confirmed lessons
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
              <Key className="border-brand-purple/30 bg-brand-lavender/70">Bookable</Key>
              <Key className="border-status-success-border bg-status-success-bg">
                Confirmed lesson
              </Key>
            </div>
          </div>
          <div className="mt-3">
            <WeekCalendar
              blocks={blocks}
              window={profileCalendarWindow(blocks)}
              dayLabels={story.week.dayLabels}
              ariaLabel={`Your week, ${story.week.rangeLabel}`}
              {...(story.week.todayIndex >= 0
                ? { now: { dayIndex: story.week.todayIndex, minutes: 9 * 60 } }
                : {})}
            />
          </div>
        </Card>

        <Card tone="progress">
          <h2 className="text-sm font-semibold text-text-primary">This lesson</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Pair label="Student" value={DEMO_FAMILY.studentPreferredName} />
            <Pair label="Year" value={DEMO_FAMILY.schoolYearCode} />
            <Pair label="Subject" value={DEMO_FAMILY.subjectDetail} />
            <Pair label="Length" value={`${String(story.durationMinutes)} minutes`} />
            <Pair label="Format" value={story.formatCode === 'online' ? 'Online' : 'In person'} />
            <div className="flex justify-between gap-4 border-t border-brand-green/20 pt-2 font-semibold text-text-primary">
              <dt>You earn</dt>
              <dd className="tabular-nums">
                {formatMoney(story.priceAmountMinor, story.currencyCode)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-text-muted">
            Studdy&rsquo;s commission comes out of your listed price, so the family paid exactly the
            price they were shown.
          </p>
        </Card>
      </div>

      <div className="mt-8">
        <DemoNote title="That is the tutor journey">
          <p>
            A request arrived, you inspected it, accepted one time, and it became a confirmed lesson
            once the family paid. Same lesson, both sides.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link href="/demo/parent/tutors">See it as the parent</Link>
            </Button>
            <Button variant="quiet" asChild>
              <Link href="/demo">Start again</Link>
            </Button>
          </div>
        </DemoNote>
      </div>
    </DemoTutorShell>
  );
}

function Key({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={`h-3 w-3 rounded-[3px] border ${className}`} />
      {children}
    </span>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="font-medium text-text-primary">{value}</dd>
    </div>
  );
}
