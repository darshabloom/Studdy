import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listArchivedStudentsForFamily } from '@studdy/database';
import { Button } from '@studdy/design-system';
import { schoolYearLabel } from '@studdy/domain/students';
import { COMPACT, Fact, Initial, PageHeader, lessonDay, lessonTime } from '@/components/parent/kit';
import { loadFamilyOverview } from '@/lib/parent/load';
import { splitBookings, tutorRelationships } from '@/lib/parent/overview';

export const metadata = { title: 'Students' };

export default async function StudentsPage() {
  const overview = await loadFamilyOverview();
  if (overview === null) redirect('/sign-in?next=%2Fparent%2Fstudents');

  const { context, bookings } = overview;
  const now = new Date();
  const archived =
    context.familyAccountId === null
      ? []
      : await listArchivedStudentsForFamily(context.familyAccountId);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Students"
        action={
          <Button asChild>
            <Link href="/parent/students/new">Add student</Link>
          </Button>
        }
      />

      <ul className="grid gap-4 md:grid-cols-2">
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
              className="flex flex-col gap-4 rounded-[var(--radius-medium)] border border-surface-border bg-surface-card p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Initial name={student.preferredName} />
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-text-primary">
                      {student.preferredName}
                    </p>
                    <p className="text-sm text-text-secondary">
                      {student.schoolYearCode === null
                        ? 'Year level not set'
                        : schoolYearLabel(student.schoolYearCode)}
                    </p>
                  </div>
                </div>
                <Button variant="secondary" className={COMPACT} asChild>
                  <Link href={`/parent/students/${student.reference}`}>View student</Link>
                </Button>
              </div>
              <div className="grid gap-3 border-t border-surface-border pt-4 sm:grid-cols-3">
                <Fact label="Subjects">
                  {subjects.length === 0
                    ? 'None yet'
                    : subjects.map((section) => section.subjectDisplayName).join(', ')}
                </Fact>
                <Fact label="Tutors">
                  {tutors.length === 0
                    ? 'None yet'
                    : tutors.map((tutor) => tutor.tutorFirstName).join(', ')}
                </Fact>
                <Fact label="Next lesson">
                  {next === null
                    ? 'Nothing booked'
                    : `${lessonDay(next.scheduledStartAt, next.timeZone)}, ${lessonTime(
                        next.scheduledStartAt,
                        next.timeZone,
                      )}`}
                </Fact>
              </div>
            </li>
          );
        })}
        <li>
          <Link
            href="/parent/students/new"
            className="flex h-full min-h-[120px] items-center justify-center rounded-[var(--radius-medium)] border border-dashed border-text-muted/50 p-5 text-sm font-medium text-brand-purple hover:border-brand-purple hover:bg-surface-card-secondary"
          >
            + Add a student
          </Link>
        </li>
      </ul>

      <details className="rounded-[var(--radius-medium)] border border-surface-border bg-surface-card">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-text-secondary">
          Archived students ({archived.length})
        </summary>
        <div className="border-t border-surface-border px-4 py-3 text-sm text-text-secondary">
          {archived.length === 0 ? (
            'No archived students.'
          ) : (
            <ul className="flex flex-col gap-1">
              {archived.map((student) => (
                <li key={student.reference}>
                  {student.preferredName}
                  {student.schoolYearCode === null
                    ? ''
                    : ` · ${schoolYearLabel(student.schoolYearCode)}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </div>
  );
}
