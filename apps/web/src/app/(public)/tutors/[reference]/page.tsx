import Link from 'next/link';
import { notFound } from 'next/navigation';
import { findPublicTutorByReference, listShortlist } from '@studdy/database';
import { Alert, Button, Card, StatusBadge } from '@studdy/design-system';
import {
  SHORTLIST_MAX_TUTORS,
  availabilityLabel,
  formatLabel,
  priceLabel,
  ratingLabel,
  verificationLabel,
  yearLevelRangeLabel,
} from '@studdy/domain/discovery';
import { addToShortlistAction } from '@/lib/discovery/actions';
import { resolveDiscoveryContext } from '@/lib/discovery/context';

interface PageProps {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ section?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { reference } = await params;
  const rows = await findPublicTutorByReference(reference);
  const tutor = rows[0];
  return { title: tutor === undefined ? 'Tutor' : `${tutor.firstName} — Tutor profile` };
}

/**
 * Public tutor profile. Every field comes from the approved public
 * projection; nothing here reads the tutor tables directly.
 */
export default async function TutorProfilePage({ params, searchParams }: PageProps) {
  const { reference } = await params;
  const { section } = await searchParams;
  const rows = await findPublicTutorByReference(reference);
  const tutor = rows[0];
  if (tutor === undefined) notFound();

  const context = await resolveDiscoveryContext();
  const activeSection =
    section !== undefined
      ? (context?.subjectSections.find((candidate) => candidate.subjectSectionId === section) ??
        null)
      : null;
  const shortlist =
    activeSection !== null ? await listShortlist(activeSection.subjectSectionId) : [];
  const alreadyShortlisted = shortlist.some((entry) => entry.tutorReference === reference);
  const shortlistFull = shortlist.length >= SHORTLIST_MAX_TUTORS;
  const rating = ratingLabel(tutor.ratingHundredths);

  return (
    <section className="mx-auto max-w-3xl px-4 py-10">
      <Button variant="quiet" size="sm" asChild>
        <Link href={activeSection === null ? '/tutors' : `/tutors?section=${section ?? ''}`}>
          ← Back to tutors
        </Link>
      </Button>

      <Card className="mt-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl font-semibold text-brand-purple-deep">
                {tutor.firstName}
              </h1>
              <StatusBadge family="pending">Example profile</StatusBadge>
              {tutor.isNewToStuddy ? (
                <StatusBadge family="active">New to Studdy</StatusBadge>
              ) : null}
            </div>
            {tutor.headline !== null ? (
              <p className="mt-1 text-text-secondary">{tutor.headline}</p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold text-text-primary tabular-nums">
              {priceLabel(tutor.startingPriceAmountMinor, tutor.currencyCode)}
            </p>
            <p className="text-xs text-text-muted">
              from, per {tutor.startingPriceDurationMinutes} min
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusBadge family="active">
            {availabilityLabel(tutor.availabilityLabelCode)}
          </StatusBadge>
          {rating !== null ? <StatusBadge family="complete">{rating} rating</StatusBadge> : null}
          <StatusBadge family="complete">{tutor.completedLessonCount} lessons</StatusBadge>
        </div>

        {tutor.teachingApproach !== null ? (
          <div>
            <h2 className="text-sm font-semibold text-text-primary">What a lesson is like</h2>
            <p className="mt-1 text-text-secondary">{tutor.teachingApproach}</p>
          </div>
        ) : null}

        <dl className="grid gap-2 border-t border-surface-border pt-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-text-muted">Subjects</dt>
            <dd className="font-medium text-text-primary">
              {rows.map((row) => row.subjectDisplayName).join(', ')}
            </dd>
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
              {tutor.verificationLabels.length === 0 ? (
                <span className="text-text-secondary">Not yet verified</span>
              ) : (
                tutor.verificationLabels.map((label) => (
                  <StatusBadge key={label} family="complete">
                    {verificationLabel(label)}
                  </StatusBadge>
                ))
              )}
            </dd>
          </div>
        </dl>

        <div className="border-t border-surface-border pt-4">
          {activeSection !== null ? (
            alreadyShortlisted ? (
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge family="complete">On your shortlist</StatusBadge>
                <Button variant="secondary" asChild>
                  <Link href={`/shortlist/${activeSection.subjectSectionId}`}>
                    Review shortlist
                  </Link>
                </Button>
              </div>
            ) : (
              <form action={addToShortlistAction} className="flex flex-wrap items-center gap-3">
                <input
                  type="hidden"
                  name="subjectSectionId"
                  value={activeSection.subjectSectionId}
                />
                <input type="hidden" name="tutorReference" value={tutor.tutorReference} />
                <input
                  type="hidden"
                  name="returnTo"
                  value={`/tutors/${tutor.tutorReference}?section=${activeSection.subjectSectionId}`}
                />
                <Button type="submit" disabled={shortlistFull}>
                  {shortlistFull ? 'Shortlist full' : 'Add to shortlist'}
                </Button>
                <span className="text-sm text-text-secondary">
                  {shortlist.length} of {SHORTLIST_MAX_TUTORS} shortlisted for{' '}
                  {activeSection.subjectDisplayName}
                </span>
              </form>
            )
          ) : (
            <Alert tone="information" title="Want to save this tutor?">
              Sign in, add the subject you need help with, then shortlist up to{' '}
              {SHORTLIST_MAX_TUTORS} tutors to compare.
            </Alert>
          )}
        </div>
      </Card>
    </section>
  );
}
