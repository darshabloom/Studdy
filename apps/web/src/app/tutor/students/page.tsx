import Link from 'next/link';
import { Button } from '@studdy/design-system';
import { schoolYearLabel } from '@studdy/domain/students';
import {
  COMPACT,
  Fact,
  Initial,
  PageHeader,
  Quiet,
  lessonDay,
  lessonTime,
} from '@/components/parent/kit';
import { TutorUnavailable } from '@/components/tutor/kit';
import { loadTutorWorkspace } from '@/lib/tutor/load';
import { tutorStudents } from '@/lib/tutor/overview';

export const metadata = { title: 'Students' };

/**
 * The students this tutor teaches — which is to say, the students they have a
 * booked lesson with. Nobody appears here from a request alone.
 */
export default async function TutorStudentsPage() {
  const workspace = await loadTutorWorkspace();
  if (workspace === null) return <TutorUnavailable />;

  const students = tutorStudents(workspace.bookings, new Date());

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Students" />

      {students.length === 0 ? (
        <Quiet>
          No students yet. A student is listed here once a lesson with them is booked and paid for.
        </Quiet>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {students.map((student) => (
            <li
              key={student.studentReference}
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
                  <Link href={`/tutor/students/${student.studentReference}`}>View student</Link>
                </Button>
              </div>
              <div className="grid gap-3 border-t border-surface-border pt-4 sm:grid-cols-3">
                <Fact label="Subjects">{student.subjects.join(', ')}</Fact>
                <Fact label="Next lesson">
                  {student.nextLesson === null
                    ? 'Nothing booked'
                    : `${lessonDay(
                        student.nextLesson.scheduledStartAt,
                        student.nextLesson.timeZone,
                      )}, ${lessonTime(
                        student.nextLesson.scheduledStartAt,
                        student.nextLesson.timeZone,
                      )}`}
                </Fact>
                <Fact label="Lessons booked">{student.lessonCount}</Fact>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
