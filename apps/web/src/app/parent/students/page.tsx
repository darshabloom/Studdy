import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button, EmptyState } from '@studdy/design-system';
import { schoolYearLabel } from '@studdy/domain/students';
import { PageHeader, Panel, lessonDay, lessonTime } from '@/components/parent/kit';
import { loadFamilyOverview } from '@/lib/parent/load';
import { splitBookings, tutorRelationships } from '@/lib/parent/overview';

export const metadata = { title: 'Students' };

export default async function StudentsPage() {
  const overview = await loadFamilyOverview();
  if (overview === null) redirect('/sign-in?next=%2Fparent%2Fstudents');

  const { context, bookings } = overview;
  const now = new Date();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Students"
        description="Everyone you arrange tutoring for."
        action={
          <Button asChild>
            <Link href="/parent/students/new">Add a student</Link>
          </Button>
        }
      />

      {context.students.length === 0 ? (
        <EmptyState
          title="No students yet"
          description="Add the person the tutoring is for, then tell us what they need help with."
        />
      ) : (
        <Panel>
          <ul className="divide-y divide-surface-border">
            {context.students.map((student) => {
              const own = bookings.filter(
                (booking) => booking.studentProfileId === student.studentProfileId,
              );
              const next = splitBookings(own, now).upcoming[0] ?? null;
              const tutors = tutorRelationships(own, now);
              const subjects = context.subjectSections.filter(
                (section) => section.studentProfileId === student.studentProfileId,
              );
              return (
                <li
                  key={student.studentProfileId}
                  className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/parent/students/${student.reference}`}
                      className="text-base font-semibold text-text-primary hover:underline"
                    >
                      {student.preferredName}
                    </Link>
                    <p className="text-sm text-text-secondary">
                      {student.schoolYearCode === null
                        ? 'Year level not set'
                        : schoolYearLabel(student.schoolYearCode)}
                    </p>
                  </div>
                  <div className="min-w-0 text-sm">
                    <p className="text-text-muted">Subjects</p>
                    <p className="text-text-primary">
                      {subjects.length === 0
                        ? 'None yet'
                        : subjects.map((section) => section.subjectDisplayName).join(', ')}
                    </p>
                  </div>
                  <div className="min-w-0 text-sm">
                    <p className="text-text-muted">Next lesson</p>
                    <p className="text-text-primary">
                      {next === null
                        ? 'Nothing booked'
                        : `${lessonDay(next.scheduledStartAt, next.timeZone)}, ${lessonTime(
                            next.scheduledStartAt,
                            next.timeZone,
                          )} with ${next.tutorFirstName}`}
                    </p>
                    {tutors.length > 0 ? (
                      <p className="text-text-secondary">
                        {tutors.length === 1 ? 'Tutor' : 'Tutors'}:{' '}
                        {tutors.map((tutor) => tutor.tutorFirstName).join(', ')}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <Button variant="secondary" size="sm" asChild>
                      <Link href={`/parent/students/${student.reference}`}>Open</Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </div>
  );
}
