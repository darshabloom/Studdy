import Link from 'next/link';
import {
  Button,
  Card,
  StatusBadge,
  type CalendarBlock,
  type CalendarWindow,
} from '@studdy/design-system';
import {
  availabilityLabel,
  formatLabel,
  priceLabel,
  ratingLabel,
  verificationLabel,
  yearLevelRangeLabel,
  type PublicTutorResult,
} from '@studdy/domain/discovery';
import type { ReactNode } from 'react';
import { addToShortlistAction } from '@/lib/discovery/actions';
import type { AvailabilityPrompt } from '@/lib/discovery/availability-view';
import { TutorAvailabilityMini } from './tutor-availability-mini';

export interface TutorCardProps {
  tutor: PublicTutorResult;
  /** When present, the card can add this tutor to that section's shortlist. */
  subjectSectionId?: string | undefined;
  returnTo?: string | undefined;
  alreadyShortlisted?: boolean;
  shortlistFull?: boolean;
  /**
   * Derived positive bookable slots as calendar blocks, for a signed-in family
   * acting on a subject section. Undefined for signed-out visitors, who are a
   * different audience under the access model — not a tutor with no free time.
   */
  availabilityBlocks?: readonly CalendarBlock[] | undefined;
  /** Shared by every card on the page so the calendars are comparable. */
  availabilityWindow: CalendarWindow;
  availabilityDayLabels: readonly string[];
  availabilityRangeLabel: string;
  availabilitySummary: readonly string[];
  /** Which column is today, so the heading can mark it. */
  availabilityTodayIndex: number;
  /** Shown where the calendar would be, when this visitor gets no derived times. */
  availabilityPrompt: AvailabilityPrompt;
}

/**
 * Tutor card. Every field shown comes from the approved public projection.
 * Seeded example tutors are always labelled as examples — they must never be
 * presented as real people.
 *
 * ORDERED THE WAY A PARENT DECIDES: who and how much, then does the schedule
 * fit, then book. Availability used to be a list of exact times, which answered
 * a question nobody asks at this stage; a small real week answers the one they
 * do. Booking is the primary action and shortlisting a quiet one beside it,
 * because saving a tutor is a convenience and never a step on the way to a
 * lesson.
 */
export function TutorCard({
  tutor,
  subjectSectionId,
  returnTo,
  alreadyShortlisted = false,
  shortlistFull = false,
  availabilityBlocks,
  availabilityWindow,
  availabilityDayLabels,
  availabilityRangeLabel,
  availabilitySummary,
  availabilityTodayIndex,
  availabilityPrompt,
}: TutorCardProps): ReactNode {
  const rating = ratingLabel(tutor.ratingHundredths);
  const profileHref =
    subjectSectionId === undefined
      ? `/tutors/${tutor.tutorReference}`
      : `/tutors/${tutor.tutorReference}?section=${subjectSectionId}`;

  return (
    <Card className="flex h-full flex-col gap-3 transition-colors hover:border-brand-purple/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-text-primary">
            {/* The whole heading is the way in, so the card has one obvious
                target before the buttons are even read. */}
            <Link
              href={profileHref}
              className="rounded-[var(--radius-gentle)] hover:text-brand-purple-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
            >
              {tutor.firstName}
            </Link>
          </h3>
          {tutor.headline !== null ? (
            <p className="mt-0.5 line-clamp-2 text-sm text-text-secondary">{tutor.headline}</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-semibold text-text-primary tabular-nums">
            {priceLabel(tutor.startingPriceAmountMinor, tutor.currencyCode)}
          </p>
          <p className="text-xs text-text-muted">per {tutor.startingPriceDurationMinutes} min</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge family="pending">Example profile</StatusBadge>
        {tutor.isNewToStuddy ? <StatusBadge family="active">New to Studdy</StatusBadge> : null}
        <StatusBadge family="active">{availabilityLabel(tutor.availabilityLabelCode)}</StatusBadge>
        {rating !== null ? <StatusBadge family="complete">{rating} rating</StatusBadge> : null}
        {tutor.verificationLabels.map((label) => (
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
          blocks={availabilityBlocks}
          window={availabilityWindow}
          dayLabels={availabilityDayLabels}
          rangeLabel={availabilityRangeLabel}
          summary={availabilitySummary}
          todayIndex={availabilityTodayIndex}
          prompt={availabilityPrompt}
        />
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {/* Primary, and it leads to the profile, where the full calendar is.
            It promises only what the click delivers: booking does not exist
            yet, and a button that says "book" would be writing a cheque the
            next screen cannot cash. Step 4 renames this once /book is real.
            Carrying the subject through keeps the times a family came to
            compare. */}
        <Button size="sm" asChild>
          <Link href={profileHref}>View availability</Link>
        </Button>
        {subjectSectionId !== undefined ? (
          alreadyShortlisted ? (
            <span className="text-xs text-text-muted">Saved for later</span>
          ) : (
            <form action={addToShortlistAction}>
              <input type="hidden" name="subjectSectionId" value={subjectSectionId} />
              <input type="hidden" name="tutorReference" value={tutor.tutorReference} />
              <input type="hidden" name="returnTo" value={returnTo ?? '/tutors'} />
              {/* Quiet on purpose. Saving a tutor is a convenience, not a step
                  towards a lesson, and it must not compete with booking. */}
              <Button variant="quiet" size="sm" type="submit" disabled={shortlistFull}>
                {shortlistFull ? 'Shortlist full' : 'Save for later'}
              </Button>
            </form>
          )
        ) : null}
      </div>
    </Card>
  );
}
