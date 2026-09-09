import type { ReactNode } from 'react';
import {
  availabilityLabel,
  formatLabel,
  ratingLabel,
  verificationLabel,
  yearLevelRangeLabel,
} from '@studdy/domain/discovery';
import { money, type DemoTutor } from '@/lib/demo/fixtures';
import { clock } from '@/lib/demo/timeline';
import { Chip, Disc, OpenMark, Panel, PanelBody, WeekStrip } from './kit';

/**
 * A DISCOVERY CARD — one tutor, as something you choose between.
 *
 * WHY THIS IS NOT `components/discovery/tutor-card.tsx`. The production card
 * binds `addToShortlistAction`, a server action that writes to Supabase.
 * Reusing it would mean either shipping a demo that can attempt a real write,
 * or adding an `if (demo)` branch to a production component — and the brief
 * rules out both. Everything underneath IS shared: the label helpers and the
 * design system primitives are the production ones.
 *
 * NO CALENDAR ON THE CARD, AND THAT IS THE POINT. Four embedded week grids
 * answered a question nobody asks while comparing tutors, took most of the
 * card's height, and made four people look identical. Choosing between
 * strangers is a question of SHAPE — does this person teach on the days we are
 * free, roughly when, at what price — so the card carries a seven-day strip and
 * a line of hours. The exact hour matters once one of them has been picked, and
 * the profile keeps the full calendar for precisely that moment.
 *
 * ORDERED THE WAY A PARENT DECIDES: who and how much, what they teach, does the
 * week fit, then act. The whole card opens the profile.
 */
export function DemoTutorCard({
  tutor,
  openDayIndexes,
  dayLabels,
  rangeLabel,
}: {
  tutor: DemoTutor;
  /** Which columns of the shown week have bookable time. */
  openDayIndexes: readonly number[];
  dayLabels: readonly string[];
  rangeLabel: string;
}): ReactNode {
  const rating = ratingLabel(tutor.ratingHundredths);
  const open = new Set(openDayIndexes);
  const strip = dayLabels.map((label, index) => ({
    label: label.slice(0, 1),
    open: open.has(index),
  }));

  // The hours he actually teaches, as one line. Bands in the demo share a
  // start and an end, so the range is honest rather than an average.
  const earliest = Math.min(...tutor.bands.map((band) => band.startMinutes));
  const latest = Math.max(...tutor.bands.map((band) => band.endMinutes));
  const weekdays = tutor.bands.map((band) => band.weekday).join(', ');

  return (
    <Panel href={`/demo/parent/tutors/${tutor.slug}`} className="h-full">
      <PanelBody className="flex h-full flex-col gap-4">
        {/* Who, and how much */}
        <div className="flex items-start gap-3.5">
          <Disc initials={tutor.initials} size="lg" />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-[19px] font-medium leading-tight text-text-primary">
              {tutor.firstName}
            </h3>
            <p className="mt-1 text-[13px] leading-snug text-text-secondary">{tutor.headline}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[19px] font-semibold tabular-nums text-text-primary">
              {money(tutor.hourlyMinor)}
            </p>
            <p className="text-[11.5px] text-text-muted">per hour</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {tutor.isNewToStuddy ? <Chip tone="ghost">New to Studdy</Chip> : null}
          <Chip tone="neutral">{availabilityLabel(tutor.availabilityLabelCode)}</Chip>
          {rating === null ? null : <Chip tone="neutral">{rating} rating</Chip>}
          <Chip tone="neutral">{tutor.completedLessonCount} lessons</Chip>
        </div>

        {/* What he teaches */}
        <dl className="grid gap-x-5 gap-y-1.5 border-t border-surface-border pt-3.5 text-[13px] sm:grid-cols-2">
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
          <div className="flex gap-2 sm:col-span-2">
            <dt className="shrink-0 text-text-muted">Also teaches</dt>
            <dd className="text-text-primary">
              {tutor.subjects.filter((subject) => subject !== 'Physics').join(', ') || '—'}
            </dd>
          </div>
        </dl>

        {/* Does the week fit */}
        <div className="rounded-[5px] border border-surface-border bg-surface-card-secondary px-3.5 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
              Teaches
            </p>
            <p className="text-[12px] tabular-nums text-text-secondary">{rangeLabel}</p>
          </div>
          <p className="mt-1.5 text-[13.5px] font-medium tabular-nums text-text-primary">
            {weekdays} &middot; {clock(earliest)} &ndash; {clock(latest)}
          </p>
          <div className="mt-2.5">
            <WeekStrip
              days={strip}
              ariaLabel={`Days ${tutor.firstName} has time free, ${rangeLabel}`}
            />
          </div>
        </div>

        {/*
         * NOT A BUTTON. The whole card is already the link, and an anchor
         * inside an anchor is invalid markup that browsers resolve by
         * silently dropping one of them. The chevron says the same thing and
         * moves on hover, which is the confirmation that mattered.
         */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-surface-border pt-3">
          {tutor.verificationLabels.slice(0, 2).map((label) => (
            <Chip key={label} tone="neutral">
              {verificationLabel(label)}
            </Chip>
          ))}
          <OpenMark label="View profile" />
        </div>
      </PanelBody>
    </Panel>
  );
}
