import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { listShortlist } from '@studdy/database';
import { Alert, Button, Card, EmptyState, StatusBadge } from '@studdy/design-system';
import { SHORTLIST_MAX_TUTORS, availabilityLabel, priceLabel } from '@studdy/domain/discovery';
import { schoolYearLabel } from '@studdy/domain/students';
import { removeFromShortlistAction } from '@/lib/discovery/actions';
import { resolveDiscoveryContext } from '@/lib/discovery/context';

export const metadata = { title: 'Your shortlist' };

/**
 * Shortlist review — the saved result of discovery, shared by both booking
 * paths.
 *
 * This is explicitly NOT a sent request. No Intended Lesson Request, Tutor
 * Request, calendar hold or booking exists at this stage, and the copy says
 * so plainly.
 */
export default async function ShortlistPage({
  params,
}: {
  params: Promise<{ subjectSectionId: string }>;
}) {
  const { subjectSectionId } = await params;
  const context = await resolveDiscoveryContext();
  if (context === null)
    redirect(`/sign-in?next=${encodeURIComponent(`/shortlist/${subjectSectionId}`)}`);

  // Server-authoritative: the section must belong to this user.
  const section = context.subjectSections.find(
    (candidate) => candidate.subjectSectionId === subjectSectionId,
  );
  if (section === undefined) notFound();

  const student = context.students.find(
    (candidate) => candidate.studentProfileId === section.studentProfileId,
  );
  const entries = await listShortlist(subjectSectionId);
  const discoverHref = `/tutors?section=${subjectSectionId}`;

  return (
    <div className="min-h-screen bg-surface-page">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Button variant="quiet" size="sm" asChild>
          <Link href={context.actsForOthers ? '/parent' : '/student'}>← Back to dashboard</Link>
        </Button>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold text-brand-purple-deep">
              Your shortlist
            </h1>
            <p className="mt-1 text-text-secondary">
              {student !== undefined ? (
                <>
                  <span className="font-medium text-text-primary">{student.preferredName}</span>{' '}
                  ·{' '}
                </>
              ) : null}
              {section.subjectDisplayName}
              {section.schoolYearCode !== null
                ? ` · ${schoolYearLabel(section.schoolYearCode)}`
                : ''}
            </p>
          </div>
          <StatusBadge family={entries.length >= SHORTLIST_MAX_TUTORS ? 'complete' : 'active'}>
            {entries.length} of {SHORTLIST_MAX_TUTORS} saved
          </StatusBadge>
        </div>

        <div className="mt-6">
          <Alert tone="information" title="This is a saved shortlist, not a lesson request">
            Nothing has been sent to these tutors and no lesson is booked. Your shortlist is saved
            to this subject, so it will still be here when you come back. Sending requests opens in
            the next release.
          </Alert>
        </div>

        <div className="mt-6">
          {entries.length === 0 ? (
            <EmptyState
              title="No tutors saved yet"
              description={`Browse tutors for ${section.subjectDisplayName} and save up to ${SHORTLIST_MAX_TUTORS} to compare them side by side.`}
              action={
                <Button asChild>
                  <Link href={discoverHref}>Find tutors</Link>
                </Button>
              }
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {entries.map((entry) => (
                <li key={entry.entryId}>
                  <Card className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-lavender text-sm font-semibold text-brand-purple tabular-nums">
                        {entry.position}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-text-primary">{entry.firstName}</p>
                        {entry.headline !== null ? (
                          <p className="text-sm text-text-secondary">{entry.headline}</p>
                        ) : null}
                        <p className="mt-1 text-sm text-text-secondary tabular-nums">
                          From {priceLabel(entry.startingPriceAmountMinor, entry.currencyCode)} ·{' '}
                          {availabilityLabel(entry.availabilityLabelCode)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="secondary" size="sm" asChild>
                        <Link href={`/tutors/${entry.tutorReference}?section=${subjectSectionId}`}>
                          View profile
                        </Link>
                      </Button>
                      <form action={removeFromShortlistAction}>
                        <input type="hidden" name="subjectSectionId" value={subjectSectionId} />
                        <input type="hidden" name="entryId" value={entry.entryId} />
                        <input
                          type="hidden"
                          name="returnTo"
                          value={`/shortlist/${subjectSectionId}`}
                        />
                        <Button variant="quiet" size="sm" type="submit">
                          Remove
                        </Button>
                      </form>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>

        {entries.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="secondary" asChild>
              <Link href={discoverHref}>
                {entries.length >= SHORTLIST_MAX_TUTORS
                  ? 'Change your selection'
                  : 'Add another tutor'}
              </Link>
            </Button>
            <Button variant="quiet" asChild>
              <Link href={context.actsForOthers ? '/parent' : '/student'}>Done for now</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
