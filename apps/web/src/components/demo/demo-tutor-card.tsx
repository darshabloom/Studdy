import Link from 'next/link';
import { WeekCalendar, type CalendarBlock, type CalendarWindow } from '@studdy/design-system';
import {
  availabilityLabel,
  formatLabel,
  ratingLabel,
  verificationLabel,
  yearLevelRangeLabel,
} from '@studdy/domain/discovery';
import type { ReactNode } from 'react';
import { money, type DemoTutor } from '@/lib/demo/fixtures';
import { Chip, DemoButton, Disc } from './kit';

/**
 * A discovery card, in the demo's language.
 *
 * WHY THIS IS NOT `components/discovery/tutor-card.tsx`. The production card
 * binds `addToShortlistAction`, a server action that writes to Supabase.
 * Reusing it would mean either shipping a demo that can attempt a real write,
 * or adding an `if (demo)` branch to a production component — and the brief
 * rules out both. Everything underneath IS shared: the week calendar, the label
 * helpers and the design system primitives are all the production ones.
 *
 * ORDERED THE WAY A PARENT DECIDES: who and how much, then does the week fit,
 * then act. The calendars across a row share one vertical window, so the cards
 * can be read against each other — which is the only reason they carry
 * calendars at all.
 */
export function DemoTutorCard({
  tutor,
  blocks,
  window,
  dayLabels,
  rangeLabel,
  todayIndex,
}: {
  tutor: DemoTutor;
  blocks: readonly CalendarBlock[];
  window: CalendarWindow;
  dayLabels: readonly string[];
  rangeLabel: string;
  todayIndex: number;
}): ReactNode {
  const rating = ratingLabel(tutor.ratingHundredths);

  return (
    <article className="flex h-full flex-col gap-4 border-t-2 border-surface-border pt-5 transition-colors hover:border-brand/40">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <Disc initials={tutor.initials} />
          <div className="min-w-0">
            <h3 className="font-display text-[19px] font-medium leading-tight text-text-primary">
              <Link
                href={`/demo/parent/tutors/${tutor.slug}`}
                className="rounded-[3px] hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {tutor.firstName}
              </Link>
            </h3>
            <p className="mt-1 text-[13px] leading-snug text-text-secondary">{tutor.headline}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[17px] font-semibold tabular-nums text-text-primary">
            {money(tutor.hourlyMinor)}
          </p>
          <p className="text-[11.5px] text-text-muted">per hour</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {tutor.isNewToStuddy ? <Chip tone="ghost">New to Studdy</Chip> : null}
        <Chip tone="neutral">{availabilityLabel(tutor.availabilityLabelCode)}</Chip>
        {rating === null ? null : <Chip tone="neutral">{rating} rating</Chip>}
        {tutor.verificationLabels.slice(0, 2).map((label) => (
          <Chip key={label} tone="neutral">
            {verificationLabel(label)}
          </Chip>
        ))}
      </div>

      <dl className="grid gap-x-4 gap-y-1 text-[13px] sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="shrink-0 text-text-muted">Levels</dt>
          <dd className="text-text-primary">
            {yearLevelRangeLabel(tutor.yearLevelFrom, tutor.yearLevelTo)}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-text-muted">Format</dt>
          <dd className="text-text-primary">
            {formatLabel(tutor.offersOnline, tutor.offersInPerson)}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-text-muted">Lessons</dt>
          <dd className="tabular-nums text-text-primary">{tutor.completedLessonCount}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-text-muted">Also teaches</dt>
          <dd className="text-text-primary">
            {tutor.subjects.filter((subject) => subject !== 'Physics').join(', ') || '—'}
          </dd>
        </div>
      </dl>

      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
          Next seven days &middot; {rangeLabel}
        </p>
        <WeekCalendar
          blocks={blocks}
          window={window}
          density="mini"
          dayLabels={dayLabels}
          familySafe
          ariaLabel={`Bookable times for ${tutor.firstName}, ${rangeLabel}`}
          {...(todayIndex >= 0 ? { now: { dayIndex: todayIndex, minutes: window.dayStartMinutes } } : {})}
        />
      </div>

      <div className="mt-auto pt-1">
        <DemoButton href={`/demo/parent/tutors/${tutor.slug}`} tone="tertiary" size="sm">
          View profile
        </DemoButton>
      </div>
    </article>
  );
}
