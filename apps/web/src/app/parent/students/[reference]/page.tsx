import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { listAccessibleStudents, listSubjectSections } from '@studdy/database';
import { Button } from '@studdy/design-system';
import { schoolYearLabel } from '@studdy/domain/students';
import {
  BookingRow,
  PageHeader,
  Panel,
  Quiet,
  Section,
  TextLink,
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

/**
 * One student, and everything on record for them: their next lesson, the
 * tutors they are booked with, the subjects they need, and their lessons.
 *
 * WHAT IS NOT HERE YET IS SAID, NOT DRAWN. Lesson notes, homework and progress
 * belong to the Lesson record, which Studdy does not have yet. That section
 * says so in a sentence rather than showing empty charts or sample entries.
 */
export default async function StudentPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const overview = await loadFamilyOverview();
  if (overview === null) redirect('/sign-in?next=%2Fparent%2Fstudents');

  // Looked up among the students this person may act for, and nowhere else: a
  // reference from another family is simply not found.
  const { students } = await listAccessibleStudents(overview.context.studdyUserId);
  const student = students.find((entry) => entry.reference === reference);
  if (student === undefined) notFound();

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <TextLink href="/parent/students">← Students</TextLink>
      </div>
      <PageHeader
        title={[student.preferredName, student.familyName].filter(Boolean).join(' ')}
        description={[
          student.schoolYearCode === null ? null : schoolYearLabel(student.schoolYearCode),
          student.schoolOrProviderName,
        ]
          .filter((part): part is string => part !== null && part !== '')
          .join(' · ')}
        action={
          <>
            {student.independenceStatusCode === 'dependent' ? (
              <Button variant="secondary" asChild>
                <Link href={`/parent/students/${student.reference}/edit`}>Edit details</Link>
              </Button>
            ) : null}
            <Button asChild>
              <Link href={`/book?child=${student.studentProfileId}`}>Book a lesson</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Panel className="flex flex-col gap-2 p-5">
          <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">
            Next lesson
          </p>
          {next === null ? (
            <p className="text-sm text-text-secondary">Nothing booked.</p>
          ) : (
            <>
              <p className="text-lg font-semibold text-text-primary">
                {lessonDay(next.scheduledStartAt, next.timeZone)}
              </p>
              <p className="text-sm text-text-secondary">
                {lessonTimeRange(next)} · {next.subjectDisplayName} with {next.tutorFirstName} ·{' '}
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
          <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">Tutors</p>
          {tutors.length === 0 ? (
            <p className="text-sm text-text-secondary">
              No tutor yet. A tutor shows here once a lesson with them is booked.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {tutors.map((tutor) => (
                <li
                  key={tutor.tutorReference}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/tutors/${tutor.tutorReference}`}
                      className="font-medium text-text-primary hover:underline"
                    >
                      {tutor.tutorFirstName}
                    </Link>
                    <p className="text-sm text-text-secondary">
                      {[...new Set(tutor.teaching.map((entry) => entry.subjectDisplayName))].join(
                        ', ',
                      )}
                    </p>
                  </div>
                  <TextLink
                    href={`/book?child=${student.studentProfileId}&tutor=${tutor.tutorReference}`}
                  >
                    Book again
                  </TextLink>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

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
                  className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-text-primary">{section.subjectDisplayName}</p>
                    <p className="text-sm text-text-secondary">
                      {section.schoolYearCode === null
                        ? 'Year level not set'
                        : schoolYearLabel(section.schoolYearCode)}
                    </p>
                    {section.goals !== null ? (
                      <p className="mt-1 max-w-2xl text-sm text-text-secondary">
                        <span className="text-text-muted">Goal: </span>
                        {section.goals}
                      </p>
                    ) : null}
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

      <Section title="Lesson notes, homework and progress">
        <Quiet>
          Not available yet. Once tutors record lessons on Studdy, the latest lesson note, any
          homework set and progress against each goal will be shown here.
        </Quiet>
      </Section>

      <Section title="Lessons">
        {own.length === 0 ? (
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
        )}
      </Section>
    </div>
  );
}
