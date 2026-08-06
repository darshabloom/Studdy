import Link from 'next/link';
import { listShortlist, listSubjects, searchPublicTutors } from '@studdy/database';
import { Alert, Button, EmptyState, StatusBadge } from '@studdy/design-system';
import { schoolYearNumber } from '@studdy/domain/students';
import { SHORTLIST_MAX_TUTORS, type PublicTutorResult } from '@studdy/domain/discovery';
import { TutorCard } from '@/components/discovery/tutor-card';
import { resolveDiscoveryContext } from '@/lib/discovery/context';

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
