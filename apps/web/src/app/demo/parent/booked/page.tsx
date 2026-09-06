import Link from 'next/link';
import { Alert, Button, Card, StatusBadge, WeekCalendar } from '@studdy/design-system';
import { DemoAvatar } from '@/components/demo/demo-avatar';
import { DemoNote, DemoPage } from '@/components/demo/demo-page';
import {
  FamilyRequestStatus,
  formatLessonDateTime,
  formatMoney,
} from '@/components/requests/request-status';
import { profileCalendarWindow } from '@/lib/availability/calendar-projection';
import { DEMO_FAMILY } from '@/lib/demo/fixtures';
import { DEMO_PARENT_STEPS } from '@/lib/demo/steps';
import { demoStory, tutorWeekWithLesson } from '@/lib/demo/story';

export const metadata = { title: 'This lesson is booked' };

/**
 * THE END OF THE STORY, and the first screen allowed to say the lesson is
 * booked.
 *
 * In the product this state is rendered from the request's own `fulfilled`
 * status — the authoritative record that a payment succeeded — and never from
 * anything the browser observed. A parent returning from Stripe sees it only
 * once the webhook has actually fulfilled.
 *
 * The green block on the calendar is the SAME lesson the tutor's confirmed
 * calendar shows, computed once in `story.ts`. That is the point of the whole
 * demo: one lesson, two sides, and they cannot disagree.
 */
export default function DemoBookedPage() {
  const story = demoStory();
  const blocks = tutorWeekWithLesson(story);

  return (
    <DemoPage steps={DEMO_PARENT_STEPS} current="booked">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-text-muted">{story.reference}</p>
          <h1 className="font-display text-3xl font-semibold text-brand-purple-deep">
            {DEMO_FAMILY.subjectDisplayName} for {DEMO_FAMILY.studentPreferredName}
          </h1>
        </div>
        <FamilyRequestStatus statusCode="fulfilled" closeReasonCode={null} />
      </div>

      <div className="mt-6">
        <Alert tone="success" title="This lesson is booked">
          {story.tutor.firstName} has this time reserved for you on{' '}
          <strong className="font-semibold">
            {formatLessonDateTime(story.accepted.at, story.timeZone)}
          </strong>
          . Your payment went through and nothing else is needed from you.
        </Alert>
      </div>

      {/* Side by side only at xl. The week grid has a real 44rem minimum, and
          splitting a 6xl container at lg leaves it a column short — the
          furthest-out day, the one worth seeing, ends up behind a scrollbar. */}
      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] xl:items-start">
        <Card tone="progress">
          <div className="flex items-center gap-3">
            <DemoAvatar initials={story.tutor.initials} />
            <div>
              <p className="text-lg font-semibold text-text-primary">{story.tutor.firstName}</p>
              <p className="text-sm text-text-secondary">{DEMO_FAMILY.subjectDetail} Maths</p>
            </div>
          </div>

          <dl className="mt-5 space-y-2 text-sm">
            <Row label="When" value={formatLessonDateTime(story.accepted.at, story.timeZone)} />
            <Row label="Length" value={`${String(story.durationMinutes)} minutes`} />
            <Row label="Format" value={story.formatCode === 'online' ? 'Online' : 'In person'} />
            <Row label="Student" value={DEMO_FAMILY.studentPreferredName} />
            <div className="flex justify-between gap-4 border-t border-brand-green/20 pt-2 font-semibold text-text-primary">
              <dt>Paid</dt>
              <dd className="tabular-nums">
                {formatMoney(story.priceAmountMinor, story.currencyCode)}
              </dd>
            </div>
          </dl>

          <div className="mt-4">
            <StatusBadge family="complete">Confirmed</StatusBadge>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-text-primary">
            {story.tutor.firstName}&rsquo;s week
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            The confirmed lesson, in green, on the time it took out of her availability.
          </p>
          <div className="mt-3">
            <WeekCalendar
              blocks={blocks}
              window={profileCalendarWindow(blocks)}
              dayLabels={story.week.dayLabels}
              ariaLabel={`${story.tutor.firstName}'s week, ${story.week.rangeLabel}`}
              {...(story.week.todayIndex >= 0
                ? { now: { dayIndex: story.week.todayIndex, minutes: 9 * 60 } }
                : {})}
            />
          </div>
        </Card>
      </div>

      <div className="mt-8">
        <DemoNote title="That is the parent journey">
          <p>
            Nine screens, from an empty search to a paid, confirmed lesson. The same lesson looks
            like this from {story.tutor.firstName}&rsquo;s side.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link href="/demo/tutor">See it as the tutor</Link>
            </Button>
            <Button variant="quiet" asChild>
              <Link href="/demo">Start again</Link>
            </Button>
          </div>
        </DemoNote>
      </div>
    </DemoPage>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="font-medium text-text-primary">{value}</dd>
    </div>
  );
}
