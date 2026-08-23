import Link from 'next/link';
import {
  bookableSlotsForSubjectSection,
  listShortlist,
  listSubjects,
  searchPublicTutors,
} from '@studdy/database';
import { Alert, Button, EmptyState, StatusBadge, type CalendarBlock } from '@studdy/design-system';
import { schoolYearNumber } from '@studdy/domain/students';
import { SHORTLIST_MAX_TUTORS, type PublicTutorResult } from '@studdy/domain/discovery';
import { TutorCard } from '@/components/discovery/tutor-card';
import {
  bookableSlotBlocks,
  familyCalendarWindow,
  mergeContiguousBlocks,
} from '@/lib/availability/calendar-projection';
import { resolveDiscoveryContext } from '@/lib/discovery/context';
import {
  availabilitySummary,
  availabilityView,
  type AvailabilityPrompt,
} from '@/lib/discovery/availability-view';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Find a Tutor' };

interface SearchParams {
  section?: string;
  subject?: string;
  format?: string;
  maxPrice?: string;
  shortlist?: string;
}

const FORMATS = [
  { code: '', label: 'Any format' },
  { code: 'online', label: 'Online' },
  { code: 'in_person', label: 'In person' },
] as const;

const PRICE_CEILINGS = [
  { value: '', label: 'Any price' },
  { value: '4000', label: 'Up to $40' },
  { value: '5000', label: 'Up to $50' },
  { value: '6000', label: 'Up to $60' },
] as const;

/**
 * One discovery journey for everyone. Anonymous visitors browse the approved
 * public projection; signed-in users acting on a subject section additionally
 * get shortlist controls. There is no separate per-workspace discovery page.
 */
export default async function TutorsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const context = await resolveDiscoveryContext();

  const activeSection =
    params.section !== undefined
      ? (context?.subjectSections.find((section) => section.subjectSectionId === params.section) ??
        null)
      : null;

  const subjectCode = params.subject ?? activeSection?.subjectCode ?? null;
  const formatCode = params.format ?? activeSection?.formatPreferenceCode ?? null;
  const schoolYear =
    activeSection?.schoolYearCode != null ? schoolYearNumber(activeSection.schoolYearCode) : null;

  const [subjects, tutors] = await Promise.all([
    listSubjects(),
    searchPublicTutors({
      subjectCode,
      schoolYearNumber: schoolYear,
      formatCode: formatCode === 'either' ? null : formatCode,
      maxPriceAmountMinor:
        params.maxPrice !== undefined && params.maxPrice !== '' ? BigInt(params.maxPrice) : null,
    }),
  ]);

  // Real bookable times, but only for a signed-in family acting on a real
  // student/subject context (§7). A signed-out visitor sees the coarse label
  // and nothing derived, so discovery is not an open calendar endpoint.
  //
  // The cards all show the SAME seven days, and the profile a family clicks
  // through to opens on those same seven — the calendar is a comparison, and a
  // comparison needs one set of axes.
  const view = availabilityView(1, new Date(), PLATFORM_TIME_ZONE);
  const blocksByTutorReference = new Map<string, readonly CalendarBlock[]>();
  if (activeSection !== null && tutors.length > 0) {
    const availability = await bookableSlotsForSubjectSection({
      subjectSectionId: activeSection.subjectSectionId,
      tutorReferences: tutors.map((tutor) => tutor.tutorReference),
      from: view.from,
      to: view.to,
    });
    for (const entry of availability) {
      // The privacy boundary, crossed exactly once and in one direction: two
      // instants in, positive `available` blocks out, nothing else available
      // to leak on the way through.
      // Merged into runs: this card is read-only, and five overlapping
      // hour-long start times drawn as five blocks read as stripes rather than
      // as "free from four until seven".
      blocksByTutorReference.set(
        entry.tutorReference,
        mergeContiguousBlocks(bookableSlotBlocks(entry.slots, view.days, PLATFORM_TIME_ZONE)),
      );
    }
  }

  // Widened across every card at once. Fitted per card, the same height would
  // mean a different hour on each one and the cards could not be read against
  // each other — which is the only reason they carry calendars.
  const sharedWindow = familyCalendarWindow([...blocksByTutorReference.values()].flat());

  const shortlist =
    activeSection !== null ? await listShortlist(activeSection.subjectSectionId) : [];
  const shortlistedReferences = new Set(shortlist.map((entry) => entry.tutorReference));
  const shortlistFull = shortlist.length >= SHORTLIST_MAX_TUTORS;

  const student =
    activeSection !== null
      ? (context?.students.find(
          (candidate) => candidate.studentProfileId === activeSection.studentProfileId,
        ) ?? null)
      : null;

  const baseQuery = (overrides: Record<string, string>): string => {
    const query = new URLSearchParams();
    if (params.section !== undefined) query.set('section', params.section);
    if (subjectCode !== null && activeSection === null) query.set('subject', subjectCode);
    if (params.format !== undefined) query.set('format', params.format);
    if (params.maxPrice !== undefined) query.set('maxPrice', params.maxPrice);
    for (const [key, value] of Object.entries(overrides)) {
      if (value === '') query.delete(key);
      else query.set(key, value);
    }
    const stringified = query.toString();
    return stringified === '' ? '/tutors' : `/tutors?${stringified}`;
  };

  /**
   * Why this visitor is not seeing times, and the shortest way to change it.
   *
   * Three different situations reach the same blank space, and the difference
   * matters: none of them means the tutor is busy, so none may be drawn as an
   * empty week. Rendered only when `availabilityBlocks` is undefined.
   */
  const availabilityPrompt: AvailabilityPrompt =
    context === null
      ? {
          linkLabel: 'Sign in',
          message: 'to see available times.',
          href: `/sign-in?next=${encodeURIComponent(baseQuery({}))}`,
        }
      : context.subjectSections.length === 0
        ? {
            linkLabel: 'Add a subject',
            message: 'to see available times.',
            href: '/parent/subjects/new',
          }
        : {
            linkLabel: 'Choose a subject above',
            message: 'to see available times.',
            href: `/tutors?section=${context.subjectSections[0]?.subjectSectionId ?? ''}`,
          };

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-brand-purple-deep md:text-4xl">
            Find a tutor
          </h1>
          {activeSection !== null && student !== null ? (
            <p className="mt-2 text-text-secondary">
              Showing tutors for{' '}
              <span className="font-medium text-text-primary">{student.preferredName}</span> —{' '}
              {activeSection.subjectDisplayName}
            </p>
          ) : context !== null ? (
            <p className="mt-2 text-text-secondary">
              Browsing all tutors. Choose a subject from your dashboard to save a shortlist for a
              particular student.
            </p>
          ) : (
            <p className="mt-2 text-text-secondary">
              Browse tutors on Studdy. Sign in and add a subject to save a shortlist.
            </p>
          )}
        </div>
        {activeSection !== null ? (
          <div className="flex items-center gap-2">
            <StatusBadge family={shortlistFull ? 'complete' : 'active'}>
              {shortlist.length} of {SHORTLIST_MAX_TUTORS} shortlisted
            </StatusBadge>
            {shortlist.length > 0 ? (
              <Button size="sm" asChild>
                <Link href={`/shortlist/${activeSection.subjectSectionId}`}>Review shortlist</Link>
              </Button>
            ) : null}
          </div>
        ) : context !== null && context.subjectSections.length > 0 ? (
          // Signed in with subjects but browsing unscoped: offer the context.
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-text-secondary">Shortlist for:</span>
            {context.subjectSections.slice(0, 3).map((candidate) => {
              const owner = context.students.find(
                (person) => person.studentProfileId === candidate.studentProfileId,
              );
              return (
                <Button key={candidate.subjectSectionId} variant="secondary" size="sm" asChild>
                  <Link href={`/tutors?section=${candidate.subjectSectionId}`}>
                    {owner === undefined
                      ? candidate.subjectDisplayName
                      : `${owner.preferredName} · ${candidate.subjectDisplayName}`}
                  </Link>
                </Button>
              );
            })}
          </div>
        ) : null}
      </div>

      {params.shortlist === 'full' ? (
        <div className="mt-4">
          <Alert tone="warning" title="Shortlist is full">
            You can shortlist up to {SHORTLIST_MAX_TUTORS} tutors for each subject. Remove one to
            add another.
          </Alert>
        </div>
      ) : null}

      <p className="mt-6 text-sm font-medium text-text-muted">
        These are example profiles for development — not real tutors.
      </p>

      {/* Filters. Links rather than a client form: shareable, and works without JS. */}
      <div className="mt-3 flex flex-wrap gap-2">
        {activeSection === null ? (
          <>
            <Button variant={subjectCode === null ? 'primary' : 'tertiary'} size="sm" asChild>
              <Link href={baseQuery({ subject: '' })}>All subjects</Link>
            </Button>
            {subjects.map((subject) => (
              <Button
                key={subject.subjectId}
                variant={subjectCode === subject.code ? 'primary' : 'tertiary'}
                size="sm"
                asChild
              >
                <Link href={baseQuery({ subject: subject.code })}>{subject.displayName}</Link>
              </Button>
            ))}
          </>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {FORMATS.map((format) => (
          <Button
            key={format.code}
            variant={(params.format ?? '') === format.code ? 'secondary' : 'quiet'}
            size="sm"
            asChild
          >
            <Link href={baseQuery({ format: format.code })}>{format.label}</Link>
          </Button>
        ))}
        {PRICE_CEILINGS.map((price) => (
          <Button
            key={price.value}
            variant={(params.maxPrice ?? '') === price.value ? 'secondary' : 'quiet'}
            size="sm"
            asChild
          >
            <Link href={baseQuery({ maxPrice: price.value })}>{price.label}</Link>
          </Button>
        ))}
      </div>

      <div className="mt-6">
        {tutors.length === 0 ? (
          <EmptyState
            title="No tutors match those filters yet"
            description="Try a different subject, format or price. More tutors join Studdy every week."
            action={
              <Button variant="secondary" asChild>
                <Link
                  href={
                    activeSection === null
                      ? '/tutors'
                      : `/tutors?section=${activeSection.subjectSectionId}`
                  }
                >
                  Clear filters
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tutors.map((tutor) => (
              <TutorCard
                key={`${tutor.tutorReference}-${tutor.subjectCode}`}
                tutor={tutor as PublicTutorResult}
                subjectSectionId={activeSection?.subjectSectionId}
                returnTo={
                  activeSection === null
                    ? '/tutors'
                    : `/tutors?section=${activeSection.subjectSectionId}`
                }
                alreadyShortlisted={shortlistedReferences.has(tutor.tutorReference)}
                shortlistFull={shortlistFull}
                availabilityBlocks={
                  activeSection === null
                    ? undefined
                    : (blocksByTutorReference.get(tutor.tutorReference) ?? [])
                }
                availabilityWindow={sharedWindow}
                availabilityDayLabels={view.compactDayLabels}
                availabilityRangeLabel={view.rangeLabel}
                availabilitySummary={availabilitySummary(
                  view.days,
                  blocksByTutorReference.get(tutor.tutorReference) ?? [],
                )}
                availabilityTodayIndex={view.todayIndex}
                availabilityPrompt={availabilityPrompt}
                bookHref={
                  activeSection === null
                    ? undefined
                    : `/book?child=${activeSection.studentProfileId}&subject=${activeSection.subjectId}&tutor=${tutor.tutorReference}`
                }
              />
            ))}
          </div>
        )}
      </div>

      {context === null ? (
        <div className="mt-8">
          <Alert tone="information" title="Save a shortlist">
            <span className="flex flex-wrap items-center gap-2">
              Sign in and add a subject to save up to {SHORTLIST_MAX_TUTORS} tutors for later.
              <Button size="sm" variant="secondary" asChild>
                <Link href="/sign-in?next=%2Ftutors">Log in</Link>
              </Button>
            </span>
          </Alert>
        </div>
      ) : null}
    </section>
  );
}
