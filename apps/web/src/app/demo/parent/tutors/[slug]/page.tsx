import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, Button, Card, StatusBadge } from '@studdy/design-system';
import {
  availabilityLabel,
  formatLabel,
  priceLabel,
  ratingLabel,
  verificationLabel,
  yearLevelRangeLabel,
} from '@studdy/domain/discovery';
import { DemoAvatar } from '@/components/demo/demo-avatar';
import { DemoPage } from '@/components/demo/demo-page';
import { TutorAvailabilityWeek } from '@/components/discovery/tutor-availability-week';
import { profileCalendarWindow } from '@/lib/availability/calendar-projection';
import { availabilitySummary } from '@/lib/discovery/availability-view';
import { AVAILABILITY_WINDOW_DAYS } from '@/lib/time';
import { demoTutor } from '@/lib/demo/fixtures';
import { DEMO_PARENT_STEPS } from '@/lib/demo/steps';
import { availabilityBlocks } from '@/lib/demo/story';
import { demoWeek } from '@/lib/demo/timeline';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tutor = demoTutor(slug);
  return { title: tutor === null ? 'Tutor' : `${tutor.firstName} — Tutor profile` };
}

/**
 * The tutor profile, with the decision surface above the prose.
 *
 * A parent reaching here has already read the headline on the card; what they
 * are asking now is whether the week works. So the calendar sits directly under
 * the header and the teaching approach comes after it — the same ordering, and
 * the same production `TutorAvailabilityWeek`, as the real profile.
 */
export default async function DemoTutorProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tutor = demoTutor(slug);
  if (tutor === null) notFound();

  const week = demoWeek();
  const blocks = availabilityBlocks(tutor, week.days);
  const rating = ratingLabel(tutor.ratingHundredths);
  const isStoryTutor = tutor.slug === 'aroha';

  return (
    <DemoPage steps={DEMO_PARENT_STEPS} current="profile">
      <Button variant="quiet" size="sm" asChild>
        <Link href="/demo/parent/tutors">← Back to tutors</Link>
      </Button>

      <Card className="mt-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-4">
            <DemoAvatar initials={tutor.initials} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-3xl font-semibold text-brand-purple-deep">
                  {tutor.firstName}
                </h1>
                {tutor.isNewToStuddy ? (
                  <StatusBadge family="active">New to Studdy</StatusBadge>
                ) : null}
              </div>
              <p className="mt-1 max-w-xl text-text-secondary">{tutor.headline}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold text-text-primary tabular-nums">
              {priceLabel(tutor.startingPriceAmountMinor, 'NZD')}
            </p>
            <p className="text-xs text-text-muted">
              from, per {tutor.startingPriceDurationMinutes} min
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusBadge family="active">{availabilityLabel(tutor.availabilityLabelCode)}</StatusBadge>
          {rating !== null ? <StatusBadge family="complete">{rating} rating</StatusBadge> : null}
          <StatusBadge family="complete">{tutor.completedLessonCount} lessons</StatusBadge>
        </div>

        <div className="border-t border-surface-border pt-5">
          <TutorAvailabilityWeek
            tutorName={tutor.firstName}
            blocks={blocks}
            // Fitted to THIS tutor, unlike the shared window discovery uses: a
            // profile shows one tutor the parent has already picked out, so
            // hours nobody teaches cost legibility and buy no comparison.
            window={profileCalendarWindow(blocks)}
            dayLabels={week.dayLabels}
            rangeLabel={week.rangeLabel}
            summary={availabilitySummary(week.days, blocks)}
            durationMinutes={tutor.startingPriceDurationMinutes}
            timeZoneLabel="New Zealand time"
            previousHref={null}
            nextHref={null}
            horizonDays={AVAILABILITY_WINDOW_DAYS}
            prompt={{ linkLabel: 'Sign in', message: 'to see available times.', href: '/demo' }}
          />

          {isStoryTutor ? (
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-[var(--radius-medium)] border border-brand-purple/20 bg-brand-lavender/40 px-4 py-4">
              <Button size="lg" asChild>
                <Link href="/demo/parent/book/format">Book a lesson</Link>
              </Button>
              <p className="text-sm text-text-secondary">
                {tutor.firstName} still has to accept &mdash; you are sending a request, not
                confirming a booking.
              </p>
            </div>
          ) : (
            <Alert tone="information" title="The demo story follows Aroha" className="mt-5">
              <span className="flex flex-wrap items-center gap-2">
                {tutor.firstName}&rsquo;s profile is here to show what a card leads to.
                <Button size="sm" variant="secondary" asChild>
                  <Link href="/demo/parent/tutors/aroha">Open Aroha&rsquo;s profile</Link>
                </Button>
              </span>
            </Alert>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold text-text-primary">What a lesson is like</h2>
          <p className="mt-1 text-text-secondary">{tutor.teachingApproach}</p>
        </div>

        <dl className="grid gap-2 border-t border-surface-border pt-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-text-muted">Subjects</dt>
            <dd className="font-medium text-text-primary">{tutor.subjects.join(', ')}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Year levels</dt>
            <dd>{yearLevelRangeLabel(tutor.yearLevelFrom, tutor.yearLevelTo)}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Format</dt>
            <dd>{formatLabel(tutor.offersOnline, tutor.offersInPerson)}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Verification</dt>
            <dd className="flex flex-wrap gap-1">
              {tutor.verificationLabels.map((label) => (
                <StatusBadge key={label} family="complete">
                  {verificationLabel(label)}
                </StatusBadge>
              ))}
            </dd>
          </div>
        </dl>
      </Card>
    </DemoPage>
  );
}
