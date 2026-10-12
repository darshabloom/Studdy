import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { listAccessibleStudents, listSubjectSections } from '@studdy/database';
import { Button } from '@studdy/design-system';
import { schoolYearLabel } from '@studdy/domain/students';
import {
  BookingRow,
  COMPACT,
  Initial,
  Panel,
  Quiet,
  Section,
  TextLink,
  ViewTabs,
  lessonDay,
  lessonTimeRange,
} from '@/components/parent/kit';
import { loadFamilyOverview } from '@/lib/parent/load';
import {
  formatLabel,
  isOpenRequest,
  splitBookings,
  tutorRelationships,
} from '@/lib/parent/overview';

export const metadata = { title: 'Student' };

const TABS = [
  ['overview', 'Overview'],
  ['progress', 'Progress'],
  ['homework', 'Homework'],
  ['lessons', 'Lessons'],
  ['goals', 'Goals'],
  ['resources', 'Resources'],
  ['tutors', 'Tutors'],
] as const;
type Tab = (typeof TABS)[number][0];

/**
 * One student, and everything on record for them.
 *
 * WHAT IS NOT HERE YET IS SAID, NOT DRAWN. Lesson summaries, homework, progress,
 * resources and important dates all belong to records Studdy does not keep yet.
 * Each of those places says so in a sentence, in the position it will occupy,
 * rather than showing an empty chart or a sample entry.
 */
export default async function StudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { reference } = await params;
  const { tab: rawTab } = await searchParams;
  const overview = await loadFamilyOverview();
  if (overview === null) redirect('/sign-in?next=%2Fparent%2Fstudents');

  // Looked up among the students this person may act for, and nowhere else: a
  // reference from another family is simply not found.
  const { students } = await listAccessibleStudents(overview.context.studdyUserId);
  const student = students.find((entry) => entry.reference === reference);
  if (student === undefined) notFound();

  const tab: Tab = TABS.find(([key]) => key === rawTab)?.[0] ?? 'overview';
  const base = `/parent/students/${student.reference}`;
  const now = new Date();
  const sections = await listSubjectSections([student.studentProfileId]);
  const own = overview.bookings.filter(
    (booking) => booking.studentProfileId === student.studentProfileId,
  );
  const { upcoming, past } = splitBookings(own, now);
  const next = upcoming[0] ?? null;
  const tutors = tutorRelationships(own, now);
  const openRequests = overview.requests.filter(
    (request) => request.studentProfileId === student.studentProfileId && isOpenRequest(request),
  );

  const tutorList =
    tutors.length === 0 ? (
      <p className="text-sm text-text-secondary">
        No tutor yet. A tutor shows here once a lesson with them is booked.
      </p>
    ) : (
      <ul className="flex flex-col gap-3">
        {tutors.map((tutor) => (
          <li key={tutor.tutorReference} className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <Initial name={tutor.tutorFirstName} tone="gold" />
              <div className="min-w-0">
                <Link
                  href={`/tutors/${tutor.tutorReference}`}
                  className="font-medium text-text-primary hover:underline"
                >
                  {tutor.tutorFirstName}
                </Link>
                <p className="truncate text-sm text-text-secondary">
                  {[...new Set(tutor.teaching.map((entry) => entry.subjectDisplayName))].join(', ')}
                </p>
              </div>
            </div>
            <TextLink
              href={`/book?child=${student.studentProfileId}&tutor=${tutor.tutorReference}`}
            >
              Book lesson
            </TextLink>
          </li>
        ))}
      </ul>
    );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <TextLink href="/parent/students">← Back to Students</TextLink>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Initial name={student.preferredName} />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-brand-purple-deep">
              {[student.preferredName, student.familyName].filter(Boolean).join(' ')}
            </h1>
            <p className="text-sm text-text-secondary">
              {[
                student.schoolYearCode === null ? null : schoolYearLabel(student.schoolYearCode),
                student.schoolOrProviderName,
              ]
                .filter((part): part is string => part !== null && part !== '')
                .join(' · ')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {student.independenceStatusCode === 'dependent' ? (
            <Button variant="secondary" className={COMPACT} asChild>
              <Link href={`${base}/edit`}>Edit details</Link>
            </Button>
          ) : null}
          <Button className={COMPACT} asChild>
            <Link href={`/book?child=${student.studentProfileId}`}>Book a lesson</Link>
          </Button>
        </div>
      </div>

      <ViewTabs
        label="Student sections"
        current={tab}
        tabs={TABS.map(([key, label]) => ({
          key,
          label,
          href: key === 'overview' ? base : `${base}?tab=${key}`,
        }))}
      />

      {tab === 'overview' ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex min-w-0 flex-col gap-5">
            <Panel className="flex flex-col gap-2 border-l-4 border-l-parent-gold p-5">
              <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">
                Next lesson
              </p>
              {next === null ? (
                <p className="text-sm text-text-secondary">Nothing booked.</p>
              ) : (
                <>
                  <p className="text-lg font-semibold text-text-primary">
                    {lessonDay(next.scheduledStartAt, next.timeZone)}, {lessonTimeRange(next)}
                  </p>
                  <p className="text-sm text-text-secondary">
                    {next.subjectDisplayName} with {next.tutorFirstName} ·{' '}
                    {formatLabel(next.lessonFormatCode)}
                  </p>
                  <div>
                    <TextLink href={`/parent/bookings/${next.reference}`}>View booking</TextLink>
                  </div>
                </>
              )}
              {openRequests.length > 0 ? (
                <p className="border-t border-surface-border pt-2 text-sm text-text-secondary">
                  {openRequests.length === 1
                    ? '1 request is still open.'
                    : `${String(openRequests.length)} requests are still open.`}{' '}
                  <TextLink href="/parent/bookings?view=requests">See requests</TextLink>
                </p>
              ) : null}
            </Panel>

            <Panel className="flex flex-col gap-2 p-5">
              <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">
                Latest lesson summary
              </p>
              <p className="text-sm text-text-secondary">
                Not available yet. Once tutors record lessons on Studdy, what was covered in the
                most recent lesson will be shown here.
              </p>
            </Panel>

            <Section
              title="Subjects"
              action={<TextLink href="/parent/subjects/new">Add a subject</TextLink>}
            >
              {sections.length === 0 ? (
                <Quiet>No subjects yet. Add one to see tutors who teach it at this level.</Quiet>
              ) : (
                <Panel>
                  <ul className="divide-y divide-surface-border">
                    {sections.map((section) => (
                      <li
                        key={section.subjectSectionId}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-text-primary">
                            {section.subjectDisplayName}
                          </p>
                          <p className="text-sm text-text-secondary">
                            {section.schoolYearCode === null
                              ? 'Year level not set'
                              : schoolYearLabel(section.schoolYearCode)}
                          </p>
                        </div>
                        {section.shortlistCount > 0 ? (
                          <TextLink href={`/shortlist/${section.subjectSectionId}`}>
                            Review shortlist
                          </TextLink>
                        ) : (
                          <TextLink href={`/tutors?section=${section.subjectSectionId}`}>
                            Find tutors
                          </TextLink>
                        )}
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
            </Section>
          </div>

          <aside className="flex flex-col gap-5">
            <Panel className="flex flex-col gap-3 bg-surface-card-secondary p-4">
              <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">
                Current tutors
              </p>
              {tutorList}
            </Panel>
            <Panel className="flex flex-col gap-2 p-4">
              <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">
                Important dates
              </p>
              <p className="text-sm text-text-secondary">
                None recorded. Tests, exams and deadlines will be listed here once they can be
                added.
              </p>
            </Panel>
          </aside>
        </div>
      ) : null}

      {tab === 'progress' ? (
        <Quiet>
          Progress cannot be shown yet. It will appear here, against each goal, once tutors record
          lessons on Studdy.
        </Quiet>
      ) : null}

      {tab === 'homework' ? (
        <Quiet>
          Homework cannot be shown yet. What a tutor sets, and whether it has been done, will appear
          here.
        </Quiet>
      ) : null}

      {tab === 'lessons' ? (
        own.length === 0 ? (
          <Quiet>No lessons booked for {student.preferredName} yet.</Quiet>
        ) : (
          <Panel>
            <ul className="divide-y divide-surface-border">
              {[...upcoming, ...past].map((booking) => (
                <BookingRow
                  key={booking.reference}
                  booking={booking}
                  now={now}
                  showStudent={false}
                />
              ))}
            </ul>
          </Panel>
        )
      ) : null}

      {tab === 'goals' ? (
        sections.some((section) => section.goals !== null) ? (
          <Panel>
            <ul className="divide-y divide-surface-border">
              {sections
                .filter((section) => section.goals !== null)
                .map((section) => (
                  <li key={section.subjectSectionId} className="px-4 py-3">
                    <p className="font-medium text-text-primary">{section.subjectDisplayName}</p>
                    <p className="mt-1 max-w-2xl text-sm text-text-secondary">{section.goals}</p>
                  </li>
                ))}
            </ul>
          </Panel>
        ) : (
          <Quiet>
            No goals recorded. A goal can be written when a subject is added for{' '}
            {student.preferredName}.
          </Quiet>
        )
      ) : null}

      {tab === 'resources' ? (
        <Quiet>
          Resources cannot be shown yet. Worksheets and links a tutor shares will be collected here.
        </Quiet>
      ) : null}

      {tab === 'tutors' ? <Panel className="p-5">{tutorList}</Panel> : null}
    </div>
  );
}
