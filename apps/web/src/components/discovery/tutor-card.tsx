import Link from 'next/link';
import { Button, Card, StatusBadge } from '@studdy/design-system';
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

export interface TutorCardProps {
  tutor: PublicTutorResult;
  /** When present, the card can add this tutor to that section's shortlist. */
  subjectSectionId?: string | undefined;
  returnTo?: string | undefined;
  alreadyShortlisted?: boolean;
  shortlistFull?: boolean;
}

/**
 * Tutor card. Every field shown comes from the approved public projection.
 * Seeded example tutors are always labelled as examples — they must never be
 * presented as real people.
 */
export function TutorCard({
  tutor,
  subjectSectionId,
  returnTo,
  alreadyShortlisted = false,
  shortlistFull = false,
}: TutorCardProps): ReactNode {
  const rating = ratingLabel(tutor.ratingHundredths);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-text-primary">{tutor.firstName}</h3>
            <StatusBadge family="pending">Example profile</StatusBadge>
            {tutor.isNewToStuddy ? <StatusBadge family="active">New to Studdy</StatusBadge> : null}
          </div>
          {tutor.headline !== null ? (
            <p className="mt-1 text-sm text-text-secondary">{tutor.headline}</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-semibold text-text-primary tabular-nums">
            {priceLabel(tutor.startingPriceAmountMinor, tutor.currencyCode)}
          </p>
          <p className="text-xs text-text-muted">per {tutor.startingPriceDurationMinutes} min</p>
        </div>
      </div>

      <dl className="grid gap-1 text-sm text-text-secondary sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="text-text-muted">Subject</dt>
          <dd className="font-medium text-text-primary">{tutor.subjectDisplayName}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-text-muted">Levels</dt>
          <dd>{yearLevelRangeLabel(tutor.yearLevelFrom, tutor.yearLevelTo)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-text-muted">Format</dt>
          <dd>{formatLabel(tutor.offersOnline, tutor.offersInPerson)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-text-muted">Lessons</dt>
          <dd className="tabular-nums">{tutor.completedLessonCount}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <StatusBadge family="active">{availabilityLabel(tutor.availabilityLabelCode)}</StatusBadge>
        {rating !== null ? <StatusBadge family="complete">{rating} rating</StatusBadge> : null}
        {tutor.verificationLabels.map((label) => (
          <StatusBadge key={label} family="complete">
            {verificationLabel(label)}
          </StatusBadge>
        ))}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <Button variant="secondary" size="sm" asChild>
          <Link href={`/tutors/${tutor.tutorReference}`}>View profile</Link>
        </Button>
        {subjectSectionId !== undefined ? (
          alreadyShortlisted ? (
            <StatusBadge family="complete">On your shortlist</StatusBadge>
          ) : (
            <form action={addToShortlistAction}>
              <input type="hidden" name="subjectSectionId" value={subjectSectionId} />
              <input type="hidden" name="tutorReference" value={tutor.tutorReference} />
              <input type="hidden" name="returnTo" value={returnTo ?? '/tutors'} />
              <Button size="sm" type="submit" disabled={shortlistFull}>
                {shortlistFull ? 'Shortlist full' : 'Add to shortlist'}
              </Button>
            </form>
          )
        ) : null}
      </div>
    </Card>
  );
}
