import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  bookableSlotsForSubjectSection,
  findPublicTutorByReference,
  listShortlist,
} from '@studdy/database';
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
import { TutorAvailabilityWeek } from '@/components/discovery/tutor-availability-week';
import {
  bookableSlotBlocks,
  mergeContiguousBlocks,
  profileCalendarWindow,
} from '@/lib/availability/calendar-projection';
import { addToShortlistAction } from '@/lib/discovery/actions';
import { resolveDiscoveryContext } from '@/lib/discovery/context';
import {
  availabilitySummary,
  availabilityView,
  type AvailabilityPrompt,
} from '@/lib/discovery/availability-view';
import { AVAILABILITY_WINDOW_DAYS, PLATFORM_TIME_ZONE } from '@/lib/time';

interface PageProps {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ section?: string; week?: string }>;
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
  const { section, week } = await searchParams;
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

  // The same seven days a discovery card showed, so arriving here reads as
  // stepping closer rather than as a different week. `availabilityView` clamps
  // the page into the published horizon, so a hand-edited `?week=` cannot walk
  // off the end into days nobody has published.
  const view = availabilityView(Number(week ?? '1'), new Date(), PLATFORM_TIME_ZONE);

  // This tutor's own bookable times, at the lesson length they publish for the
  // section's subject. Signed-out visitors get the coarse label only.
  const availability =
    activeSection === null
      ? null
      : ((
          await bookableSlotsForSubjectSection({
            subjectSectionId: activeSection.subjectSectionId,
            tutorReferences: [reference],
            from: view.from,
            to: view.to,
          })
        )[0] ?? { slots: [], durationMinutes: tutor.startingPriceDurationMinutes });

  // Undefined and empty mean different things and are kept apart all the way to
  // the component: undefined is "not shown to this visitor", empty is "derived,
  // and there is nothing in these seven days".
  // Merged into runs while this view is read-only. Step 4 renders the
  // individual slots instead, because that is when the difference between a
  // 4:00 and a 4:30 start becomes the thing being chosen.
  const availabilityBlocks =
    availability === null
      ? undefined
      : mergeContiguousBlocks(
          bookableSlotBlocks(availability.slots, view.days, PLATFORM_TIME_ZONE),
        );

  const availabilityPrompt: AvailabilityPrompt =
    context === null
      ? {
          linkLabel: 'Sign in',
          message: "to view this tutor's live availability.",
          href: `/sign-in?next=${encodeURIComponent(`/tutors/${reference}`)}`,
        }
      : context.subjectSections.length === 0
        ? {
            linkLabel: 'Add a subject',
            message: "to view this tutor's live availability.",
            href: '/parent/subjects/new',
          }
        : {
            linkLabel: 'Choose a subject',
            message: "to view this tutor's live availability.",
            href: '/tutors',
          };

  const weekHref = (page: number): string =>
    activeSection === null
      ? `/tutors/${reference}?week=${String(page)}`
      : `/tutors/${reference}?section=${activeSection.subjectSectionId}&week=${String(page)}`;

  return (
    // Wide enough for a seven-column week to sit on screen whole. At the old
    // width the last day fell off the right-hand edge behind a scrollbar, so
    // the one column a parent most wants — the furthest away they can book —
    // was the one they had to go looking for.
    <section className="mx-auto max-w-5xl px-4 py-10">
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

        {/* The decision surface, so it sits above the prose rather than under
            it: a parent has already read the headline by now and is asking
            whether the week works. */}
        <div className="border-t border-surface-border pt-5">
          <TutorAvailabilityWeek
            tutorName={tutor.firstName}
            blocks={availabilityBlocks}
            // Fitted to THIS tutor, unlike the shared window discovery uses:
            // a profile shows one tutor a parent has already picked out, so
            // hours nobody teaches cost legibility and buy no comparison.
            window={profileCalendarWindow(availabilityBlocks ?? [])}
            dayLabels={view.dayLabels}
            rangeLabel={view.rangeLabel}
            summary={availabilitySummary(view.days, availabilityBlocks ?? [])}
            durationMinutes={availability?.durationMinutes}
            timeZoneLabel="New Zealand time"
            previousHref={view.hasPrevious ? weekHref(view.page - 1) : null}
            nextHref={view.hasNext ? weekHref(view.page + 1) : null}
            horizonDays={AVAILABILITY_WINDOW_DAYS}
            prompt={availabilityPrompt}
          />

          {/*
           * A note, not a button.
           *
           * A greyed-out primary still reads as an action — it says "you may
           * do this, just not yet, and probably because of something you have
           * not done". Nothing about the parent is incomplete here; the
           * journey behind it simply does not exist yet. Saying that plainly
           * is honest, and it stops the strongest-looking control on the page
           * being the one thing that cannot be used.
           */}
          <Alert tone="information" title="Booking a lesson here opens shortly" className="mt-5">
            Requesting a lesson straight from a tutor&rsquo;s profile is being built. For now you
            can save {tutor.firstName} for later, or ask the tutors on your shortlist together.
          </Alert>
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
                <StatusBadge family="complete">Saved for later</StatusBadge>
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
                {/* Secondary: booking is the primary action on this page and
                    saving a tutor must not read as the way to get a lesson. */}
                <Button variant="secondary" type="submit" disabled={shortlistFull}>
                  {shortlistFull ? 'Shortlist full' : 'Save for later'}
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
