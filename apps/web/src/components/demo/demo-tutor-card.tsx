import Link from 'next/link';
import { Button, Card, StatusBadge, type CalendarBlock, type CalendarWindow } from '@studdy/design-system';
import {
  availabilityLabel,
  formatLabel,
  priceLabel,
  ratingLabel,
  verificationLabel,
  yearLevelRangeLabel,
} from '@studdy/domain/discovery';
import type { ReactNode } from 'react';
import { TutorAvailabilityMini } from '@/components/discovery/tutor-availability-mini';
import type { DemoTutor } from '@/lib/demo/fixtures';
import { DemoAvatar } from './demo-avatar';

/**
 * The discovery card, for the demo.
 *
 * A near-copy of `components/discovery/tutor-card.tsx` — same field order, same
 * badges, same mini calendar, same "book is primary" hierarchy — with the
 * shortlist control removed and an avatar added.
 *
 * WHY A COPY RATHER THAN A PROP. The production card binds
 * `addToShortlistAction`, a server action that writes to Supabase. Reusing it
 * would mean either shipping a demo that can attempt a real write, or adding an
 * `if (demo)` branch to a production component — and the brief rules both out.
 * Everything BELOW the card is genuinely shared: the mini calendar, the label
 * helpers and every design system primitive are the production ones.
 */
export function DemoTutorCard({
  tutor,
  blocks,
  window,
  dayLabels,
  rangeLabel,
  summary,
  todayIndex,
}: {
  tutor: DemoTutor;
  blocks: readonly CalendarBlock[];
  window: CalendarWindow;
  dayLabels: readonly string[];
  rangeLabel: string;
  summary: readonly string[];
  todayIndex: number;
}): ReactNode {
  const rating = ratingLabel(tutor.ratingHundredths);
  const profileHref = `/demo/parent/tutors/${tutor.slug}`;

  return (
    <Card className="flex h-full flex-col gap-3 transition-colors hover:border-brand-purple/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <DemoAvatar initials={tutor.initials} />
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-text-primary">
              <Link
                href={profileHref}
                className="rounded-[var(--radius-gentle)] hover:text-brand-purple-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
              >
                {tutor.firstName}
              </Link>
            </h3>
            <p className="mt-0.5 line-clamp-2 text-sm text-text-secondary">{tutor.headline}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-semibold text-text-primary tabular-nums">
            {priceLabel(tutor.startingPriceAmountMinor, 'NZD')}
          </p>
          <p className="text-xs text-text-muted">per {tutor.startingPriceDurationMinutes} min</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {tutor.isNewToStuddy ? <StatusBadge family="active">New to Studdy</StatusBadge> : null}
        <StatusBadge family="active">{availabilityLabel(tutor.availabilityLabelCode)}</StatusBadge>
        {rating !== null ? <StatusBadge family="complete">{rating} rating</StatusBadge> : null}
        {tutor.verificationLabels.slice(0, 2).map((label) => (
          <StatusBadge key={label} family="complete">
            {verificationLabel(label)}
          </StatusBadge>
        ))}
      </div>

      <dl className="grid gap-x-3 gap-y-1 text-sm text-text-secondary sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="shrink-0 text-text-muted">Subject</dt>
          <dd className="font-medium text-text-primary">{tutor.subjectDisplayName}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-text-muted">Levels</dt>
          <dd>{yearLevelRangeLabel(tutor.yearLevelFrom, tutor.yearLevelTo)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-text-muted">Format</dt>
          <dd>{formatLabel(tutor.offersOnline, tutor.offersInPerson)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-text-muted">Lessons</dt>
          <dd className="tabular-nums">{tutor.completedLessonCount}</dd>
        </div>
      </dl>

      <div className="border-t border-surface-border pt-3">
        <TutorAvailabilityMini
          tutorName={tutor.firstName}
          blocks={blocks}
          window={window}
          dayLabels={dayLabels}
          rangeLabel={rangeLabel}
          summary={summary}
          todayIndex={todayIndex}
          // Never rendered: the demo always supplies blocks. Required by the
          // production component, which needs somewhere to send a visitor who
          // is not entitled to derived availability.
          prompt={{ linkLabel: 'Sign in', message: 'to see available times.', href: '/demo' }}
        />
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <Button size="sm" asChild>
          <Link href={profileHref}>View profile</Link>
        </Button>
      </div>
    </Card>
  );
}
