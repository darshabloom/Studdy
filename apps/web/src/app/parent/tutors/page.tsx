import Link from 'next/link';
import { redirect } from 'next/navigation';
import { searchPublicTutors, type PublicTutorRow } from '@studdy/database';
import { Button } from '@studdy/design-system';
import {
  availabilityLabel,
  formatLabel,
  priceLabel,
  ratingLabel,
  verificationLabel,
  yearLevelRangeLabel,
} from '@studdy/domain/discovery';
import {
  COMPACT,
  Fact,
  Initial,
  PageHeader,
  Quiet,
  TextLink,
  ViewTabs,
  lessonDay,
  lessonTime,
} from '@/components/parent/kit';
import { loadFamilyOverview } from '@/lib/parent/load';
import { tutorRelationships } from '@/lib/parent/overview';

export const metadata = { title: 'Tutors' };

const VIEWS = ['find', 'mine'] as const;
type View = (typeof VIEWS)[number];

interface TutorCardModel {
  readonly tutor: PublicTutorRow;
  readonly subjects: readonly string[];
  readonly lowest: PublicTutorRow;
}

/**
 * The public search returns one row per tutor and subject. A card is one
 * tutor, so the rows are folded: every subject they teach, and the lowest
 * price among them, which is the only "typical rate" the data can honestly
 * support — it is labelled "from", with the lesson length it buys.
 */
function foldTutors(rows: readonly PublicTutorRow[]): readonly TutorCardModel[] {
  const byTutor = new Map<string, PublicTutorRow[]>();
  for (const row of rows) {
    byTutor.set(row.tutorReference, [...(byTutor.get(row.tutorReference) ?? []), row]);
  }
  return [...byTutor.values()].map((list) => ({
    tutor: list[0]!,
    subjects: [...new Set(list.map((row) => row.subjectDisplayName))],
    lowest: list.reduce((least, row) =>
      row.startingPriceAmountMinor < least.startingPriceAmountMinor ? row : least,
    ),
  }));
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-[var(--radius-pill)] bg-parent-sky px-2 py-px text-xs font-medium text-parent-navy">
      {children}
    </span>
  );
}

export default async function TutorsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const overview = await loadFamilyOverview();
  if (overview === null) redirect('/sign-in?next=%2Fparent%2Ftutors');

  const view: View = (VIEWS as readonly string[]).includes(params.view ?? '')
    ? (params.view as View)
    : 'find';
  const now = new Date();
  const relationships = tutorRelationships(overview.bookings, now);
  const { students, subjectSections } = overview.context;
  const cards = view === 'find' ? foldTutors(await searchPublicTutors()) : [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Tutors" />

      <ViewTabs
        label="Tutor views"
        current={view}
        tabs={[
          { key: 'find', label: 'Find a tutor', href: '/parent/tutors' },
          {
            key: 'mine',
            label: 'My tutors',
            href: '/parent/tutors?view=mine',
            count: relationships.length,
          },
        ]}
      />

      {view === 'find' ? (
        <>
          {subjectSections.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-medium)] bg-parent-cream px-4 py-3 text-sm">
              <span className="text-text-secondary">Match tutors to:</span>
              {subjectSections.map((section) => {
                const student = students.find(
                  (entry) => entry.studentProfileId === section.studentProfileId,
                );
                return (
                  <Link
                    key={section.subjectSectionId}
                    href={`/tutors?section=${section.subjectSectionId}`}
                    className="rounded-[var(--radius-pill)] border border-surface-border bg-surface-card px-3 py-1 font-medium text-brand-purple hover:border-brand-purple"
                  >
                    {section.subjectDisplayName} for {student?.preferredName ?? 'student'}
                  </Link>
                );
              })}
              <span className="ml-auto">
                <TextLink href="/tutors">Search with filters</TextLink>
              </span>
            </div>
          ) : (
            <div className="rounded-[var(--radius-medium)] bg-parent-cream px-4 py-3 text-sm text-text-secondary">
              Add a subject for a student and tutors can be matched to their year level.{' '}
              <TextLink
                href={students.length === 0 ? '/parent/students/new' : '/parent/subjects/new'}
              >
                {students.length === 0 ? 'Add a student' : 'Add a subject'}
              </TextLink>
            </div>
          )}

          {cards.length === 0 ? (
            <Quiet>No tutors are listed at the moment.</Quiet>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {cards.map(({ tutor, subjects, lowest }) => {
                const rating = ratingLabel(tutor.ratingHundredths);
                return (
                  <li
                    key={tutor.tutorReference}
                    className="flex flex-col gap-3 rounded-[var(--radius-medium)] border border-surface-border bg-surface-card p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Initial name={tutor.firstName} tone="gold" />
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-text-primary">
                          {tutor.firstName}
                        </p>
                        <p className="text-sm text-text-secondary">
                          From{' '}
                          <span className="font-semibold text-text-primary tabular-nums">
                            {priceLabel(lowest.startingPriceAmountMinor, lowest.currencyCode)}
                          </span>{' '}
                          for {lowest.startingPriceDurationMinutes} minutes
                        </p>
                      </div>
                    </div>
                    {tutor.headline !== null ? (
                      <p className="text-sm text-text-secondary">{tutor.headline}</p>
                    ) : null}
                    <p className="text-sm text-text-primary">
                      {subjects.join(', ')} ·{' '}
                      {yearLevelRangeLabel(tutor.yearLevelFrom, tutor.yearLevelTo)}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <Badge>{formatLabel(tutor.offersOnline, tutor.offersInPerson)}</Badge>
                      <Badge>{availabilityLabel(tutor.availabilityLabelCode)}</Badge>
                      {rating !== null ? <Badge>{rating} rating</Badge> : null}
                      {tutor.isNewToStuddy ? <Badge>New to Studdy</Badge> : null}
                      {tutor.verificationLabels.map((code) => (
                        <Badge key={code}>{verificationLabel(code)}</Badge>
                      ))}
                      {tutor.isExampleProfile ? <Badge>Example profile</Badge> : null}
                    </div>
                    <div className="mt-auto flex flex-wrap gap-2 pt-1">
                      <Button className={COMPACT} asChild>
                        <Link href={`/book?tutor=${tutor.tutorReference}`}>Request a lesson</Link>
                      </Button>
                      <Button variant="secondary" className={COMPACT} asChild>
                        <Link href={`/tutors/${tutor.tutorReference}`}>View profile</Link>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : null}

      {view === 'mine' ? (
        relationships.length === 0 ? (
          <Quiet>
            No tutors yet. A tutor is listed here once you have a booked lesson with them.{' '}
            <TextLink href="/parent/tutors">Find a tutor</TextLink>
          </Quiet>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {relationships.map((tutor) => (
              <li
                key={tutor.tutorReference}
                className="flex flex-col gap-4 rounded-[var(--radius-medium)] border border-surface-border bg-surface-card p-5"
              >
                <div className="flex items-center gap-3">
                  <Initial name={tutor.tutorFirstName} tone="gold" />
                  <p className="text-base font-semibold text-text-primary">
                    {tutor.tutorFirstName}
                  </p>
                </div>
                <div className="grid gap-3 border-t border-surface-border pt-4 sm:grid-cols-3">
                  <Fact label={tutor.teaching.length === 1 ? 'Student' : 'Students'}>
                    {[...new Set(tutor.teaching.map((entry) => entry.studentPreferredName))].join(
                      ', ',
                    )}
                  </Fact>
                  <Fact label="Subjects">
                    {[...new Set(tutor.teaching.map((entry) => entry.subjectDisplayName))].join(
                      ', ',
                    )}
                  </Fact>
                  <Fact label="Next lesson">
                    {tutor.nextLesson === null
                      ? 'Nothing booked'
                      : `${lessonDay(
                          tutor.nextLesson.scheduledStartAt,
                          tutor.nextLesson.timeZone,
                        )}, ${lessonTime(
                          tutor.nextLesson.scheduledStartAt,
                          tutor.nextLesson.timeZone,
                        )}`}
                  </Fact>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button className={COMPACT} asChild>
                    <Link href={`/book?tutor=${tutor.tutorReference}`}>Book lesson</Link>
                  </Button>
                  <Button variant="secondary" className={COMPACT} asChild>
                    <Link href={`/tutors/${tutor.tutorReference}`}>View profile</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
