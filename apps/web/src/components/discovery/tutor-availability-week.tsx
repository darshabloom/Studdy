import Link from 'next/link';
import {
  Button,
  WeekCalendar,
  type CalendarBlock,
  type CalendarWindow,
} from '@studdy/design-system';
import type { ReactNode } from 'react';
import type { AvailabilityPrompt } from '@/lib/discovery/availability-view';

export interface TutorAvailabilityWeekProps {
  readonly tutorName: string;
  /**
   * Derived positive bookable slots ONLY. Undefined means this visitor is not
   * entitled to derived availability — not that the tutor has none.
   */
  readonly blocks: readonly CalendarBlock[] | undefined;
  readonly window: CalendarWindow;
  readonly dayLabels: readonly string[];
  readonly rangeLabel: string;
  readonly summary: readonly string[];
  /** Lesson length these slots were derived at, for the caption. */
  readonly durationMinutes: number | undefined;
  readonly timeZoneLabel: string;
  /** Page navigation. Null where there is nowhere to go. */
  readonly previousHref: string | null;
  readonly nextHref: string | null;
  /** How far ahead availability is published, for the honest horizon note. */
  readonly horizonDays: number;
  /** Shown INSTEAD of a calendar when `blocks` is undefined. */
  readonly prompt: AvailabilityPrompt;
}

/**
 * A tutor's bookable time, full size, on their profile.
 *
 * Read-only for now. The profile is where a parent decides whether this tutor
 * fits, so the calendar is big enough to read hour by hour with a real time
 * axis, and the days on screen are the SAME seven a discovery card showed —
 * arriving here should feel like stepping closer, not like a different week.
 *
 * Navigation is bounded by how far ahead availability is actually published.
 * A "next" control that walked past the horizon into empty weeks would invent
 * an absence of availability out of an absence of data.
 */
export function TutorAvailabilityWeek({
  tutorName,
  blocks,
  window,
  dayLabels,
  rangeLabel,
  summary,
  durationMinutes,
  timeZoneLabel,
  previousHref,
  nextHref,
  horizonDays,
  prompt,
}: TutorAvailabilityWeekProps): ReactNode {
  if (blocks === undefined) {
    return (
      <section aria-labelledby="availability-heading" className="flex flex-col gap-3">
        <h2 id="availability-heading" className="text-lg font-semibold text-text-primary">
          Availability
        </h2>
        {/* No skeleton calendar behind this. An empty grid, even greyed out,
            asserts a shape for a week we are not showing. */}
        <div className="rounded-[var(--radius-medium)] border border-dashed border-surface-border bg-surface-card-secondary px-5 py-8 text-center">
          <p className="text-text-secondary">
            {prompt.linkLabel} {prompt.message}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-text-muted">
            Times are worked out for your student and subject, at the lesson length this tutor
            teaches.
          </p>
          <Button className="mt-4" asChild>
            <Link href={prompt.href}>{prompt.linkLabel}</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="availability-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="availability-heading" className="text-lg font-semibold text-text-primary">
            Availability
          </h2>
          <p className="mt-0.5 text-sm text-text-muted">
            {durationMinutes === undefined
              ? `Bookable times, shown in ${timeZoneLabel}.`
              : `${durationMinutes}-minute lessons, shown in ${timeZoneLabel}.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <NavButton href={previousHref} label="← Earlier" description="earlier" />
          <p className="min-w-[11rem] text-center text-sm font-medium tabular-nums text-text-primary">
            {rangeLabel}
          </p>
          <NavButton href={nextHref} label="Later →" description="later" />
        </div>
      </div>

      <WeekCalendar
        blocks={blocks}
        window={window}
        mode="read"
        dayLabels={dayLabels}
        familySafe
        ariaLabel={`Bookable times for ${tutorName}, ${rangeLabel}`}
      />

      {/* Seven columns cannot fit a phone, so the week scrolls sideways. Said
          out loud only where it is true, because on a laptop there is nothing
          off screen to go looking for. */}
      <p className="text-xs text-text-muted md:hidden">Scroll sideways to see the whole week.</p>

      <p className="sr-only">
        {summary.length === 0
          ? `No bookable times for ${tutorName} between ${rangeLabel}.`
          : `Bookable times for ${tutorName}: ${summary.join('. ')}.`}
      </p>

      {blocks.length === 0 ? (
        <p className="text-sm text-text-muted">
          No bookable times between {rangeLabel}.{' '}
          {nextHref === null ? 'Try the earlier days, or check back later.' : 'Try the later days.'}
        </p>
      ) : null}

      {/* Says why navigation stops, so a parent does not read the end of the
          horizon as the end of this tutor's availability. */}
      <p className="text-xs text-text-muted">
        Tutors publish their availability {horizonDays} days ahead.
      </p>
    </section>
  );
}

/**
 * One end of the navigation, present whether or not it leads anywhere.
 *
 * The edges of the horizon keep their controls rather than dropping them, so
 * the row does not reflow as a parent pages through — but a dead end is a real
 * disabled button, not an anchor with nowhere to go.
 */
function NavButton({
  href,
  label,
  description,
}: {
  href: string | null;
  label: string;
  description: string;
}): ReactNode {
  if (href === null) {
    return (
      <Button variant="secondary" size="sm" disabled>
        {label}
      </Button>
    );
  }
  return (
    <Button variant="secondary" size="sm" asChild>
      <Link href={href} aria-label={`Show the ${description} seven days`}>
        {label}
      </Link>
    </Button>
  );
}
