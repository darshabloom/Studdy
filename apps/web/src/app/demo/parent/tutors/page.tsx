import Link from 'next/link';
import { Button, StatusBadge } from '@studdy/design-system';
import { DemoPage } from '@/components/demo/demo-page';
import { DemoTutorCard } from '@/components/demo/demo-tutor-card';
import { familyCalendarWindow } from '@/lib/availability/calendar-projection';
import { availabilitySummary } from '@/lib/discovery/availability-view';
import { DEMO_FAMILY, DEMO_TUTORS } from '@/lib/demo/fixtures';
import { DEMO_PARENT_STEPS } from '@/lib/demo/steps';
import { availabilityBlocks } from '@/lib/demo/story';
import { demoWeek } from '@/lib/demo/timeline';

export const metadata = { title: 'Find a tutor' };

/**
 * DISCOVERY, ordered the way the production page orders it: who and how much,
 * then does the week fit, then act.
 *
 * The calendars all share ONE vertical window, widened across every card at
 * once by the production `familyCalendarWindow`. Fitted per card the same
 * height would mean a different hour on each, and the cards could not be read
 * against each other — which is the only reason they carry calendars at all.
 */
export default function DemoTutorsPage() {
  const week = demoWeek();
  const cards = DEMO_TUTORS.map((tutor) => ({
    tutor,
    blocks: availabilityBlocks(tutor, week.days),
  }));
  const sharedWindow = familyCalendarWindow(cards.flatMap((card) => [...card.blocks]));

  return (
    <DemoPage steps={DEMO_PARENT_STEPS} current="find">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-brand-purple-deep md:text-4xl">
            Find a tutor
          </h1>
          <p className="mt-2 text-text-secondary">
            Showing tutors for{' '}
            <span className="font-medium text-text-primary">
              {DEMO_FAMILY.studentPreferredName}
            </span>{' '}
            — {DEMO_FAMILY.subjectDisplayName}, {DEMO_FAMILY.schoolYearCode}
          </p>
        </div>
        <StatusBadge family="pending">{DEMO_FAMILY.subjectDetail}</StatusBadge>
      </div>

      {/* Filters, drawn as the production page draws them. Inert in the demo:
          four tutors is not a set worth filtering, and a control that changes
          nothing is worse than a control that is plainly a picture of one. */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-sm text-text-muted">Filters</span>
        <StatusBadge family="active">Mathematics</StatusBadge>
        <StatusBadge family="active">Year 11</StatusBadge>
        <StatusBadge family="paused">Any format</StatusBadge>
        <StatusBadge family="paused">Any price</StatusBadge>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ tutor, blocks }) => (
          <DemoTutorCard
            key={tutor.slug}
            tutor={tutor}
            blocks={blocks}
            window={sharedWindow}
            dayLabels={week.compactDayLabels}
            rangeLabel={week.rangeLabel}
            summary={availabilitySummary(week.days, blocks)}
            todayIndex={week.todayIndex}
          />
        ))}
      </div>

      <div className="mt-8 rounded-[var(--radius-medium)] border border-surface-border bg-surface-card p-5">
        <p className="text-sm text-text-secondary">
          The story follows <span className="font-medium text-text-primary">Aroha</span>.
        </p>
        <div className="mt-3">
          <Button asChild>
            <Link href="/demo/parent/tutors/aroha">Open Aroha&rsquo;s profile</Link>
          </Button>
        </div>
      </div>
    </DemoPage>
  );
}
