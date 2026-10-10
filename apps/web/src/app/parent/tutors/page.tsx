import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@studdy/design-system';
import { schoolYearLabel } from '@studdy/domain/students';
import {
  PageHeader,
  Panel,
  Quiet,
  Section,
  TextLink,
  ViewTabs,
  lessonDay,
  lessonTime,
} from '@/components/parent/kit';
import { loadFamilyOverview } from '@/lib/parent/load';
import { tutorRelationships } from '@/lib/parent/overview';

export const metadata = { title: 'Tutors' };

const VIEWS = ['mine', 'find'] as const;
type View = (typeof VIEWS)[number];

export default async function TutorsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const overview = await loadFamilyOverview();
  if (overview === null) redirect('/sign-in?next=%2Fparent%2Ftutors');

  const now = new Date();
  const tutors = tutorRelationships(overview.bookings, now);
  const { students, subjectSections } = overview.context;
  // With no tutors yet, finding one is the useful place to land.
  const fallback: View = tutors.length === 0 ? 'find' : 'mine';
  const view: View = (VIEWS as readonly string[]).includes(params.view ?? '')
    ? (params.view as View)
    : fallback;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Tutors"
        description="The tutors you have booked, and the way to find a new one."
      />

      <ViewTabs
        label="Tutor views"
        current={view}
        tabs={[
          {
            key: 'mine',
            label: 'My Tutors',
            href: '/parent/tutors?view=mine',
            count: tutors.length,
          },
          { key: 'find', label: 'Find a Tutor', href: '/parent/tutors?view=find' },
        ]}
      />

      {view === 'mine' ? (
        tutors.length === 0 ? (
          <Quiet>
            No tutors yet. A tutor is listed here once you have a booked lesson with them.{' '}
            <TextLink href="/parent/tutors?view=find">Find a tutor</TextLink>
          </Quiet>
        ) : (
          <Panel>
            <ul className="divide-y divide-surface-border">
              {tutors.map((tutor) => (
                <li
                  key={tutor.tutorReference}
                  className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/tutors/${tutor.tutorReference}`}
                      className="text-base font-semibold text-text-primary hover:underline"
                    >
                      {tutor.tutorFirstName}
                    </Link>
                    <p className="text-sm text-text-secondary">
                      {tutor.teaching
                        .map(
                          (entry) =>
                            `${entry.subjectDisplayName} for ${entry.studentPreferredName}`,
                        )
                        .join(', ')}
                    </p>
                  </div>
                  <div className="min-w-0 text-sm">
                    <p className="text-text-muted">Next lesson</p>
                    <p className="text-text-primary">
                      {tutor.nextLesson === null
                        ? 'Nothing booked'
                        : `${lessonDay(tutor.nextLesson.scheduledStartAt, tutor.nextLesson.timeZone)}, ${lessonTime(
                            tutor.nextLesson.scheduledStartAt,
                            tutor.nextLesson.timeZone,
                          )}`}
                    </p>
                    <p className="text-text-secondary">
                      {tutor.lessonCount === 1
                        ? '1 lesson booked in total'
                        : `${String(tutor.lessonCount)} lessons booked in total`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" asChild>
                      <Link href={`/book?tutor=${tutor.tutorReference}`}>Book a lesson</Link>
                    </Button>
                    <Button variant="secondary" size="sm" asChild>
                      <Link href={`/tutors/${tutor.tutorReference}`}>View profile</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        )
      ) : null}

      {view === 'find' ? (
        <>
          {students.length === 0 ? (
            <Quiet>
              Add a student first, so tutors can be matched to their year level.{' '}
              <TextLink href="/parent/students/new">Add a student</TextLink>
            </Quiet>
          ) : (
            <Section
              title="Find tutors for a subject"
              action={<TextLink href="/parent/subjects/new">Add a subject</TextLink>}
            >
              {subjectSections.length === 0 ? (
                <Quiet>
                  Tell us what a student needs help with and we will show tutors who teach it at
                  their level.
                </Quiet>
              ) : (
                <Panel>
                  <ul className="divide-y divide-surface-border">
                    {subjectSections.map((section) => {
                      const student = students.find(
                        (entry) => entry.studentProfileId === section.studentProfileId,
                      );
                      return (
                        <li
                          key={section.subjectSectionId}
                          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-text-primary">
                              {section.subjectDisplayName} for {student?.preferredName ?? 'student'}
                            </p>
                            <p className="text-sm text-text-secondary">
                              {section.schoolYearCode === null
                                ? 'Year level not set'
                                : schoolYearLabel(section.schoolYearCode)}
                              {section.shortlistCount > 0
                                ? ` · ${String(section.shortlistCount)} shortlisted`
                                : ''}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {section.shortlistCount > 0 ? (
                              <Button variant="secondary" size="sm" asChild>
                                <Link href={`/shortlist/${section.subjectSectionId}`}>
                                  Review shortlist
                                </Link>
                              </Button>
                            ) : null}
                            <Button size="sm" asChild>
                              <Link href={`/tutors?section=${section.subjectSectionId}`}>
                                Find tutors
                              </Link>
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </Panel>
              )}
            </Section>
          )}
          <div>
            <TextLink href="/tutors">Browse all tutors</TextLink>
          </div>
        </>
      ) : null}
    </div>
  );
}
