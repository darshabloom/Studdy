import { notFound } from 'next/navigation';
import { schoolYearLabel } from '@studdy/domain/students';
import { Initial, Panel, Quiet, Section, TextLink, lessonDay } from '@/components/parent/kit';
import { LessonRow, TutorUnavailable, timeRange } from '@/components/tutor/kit';
import { loadTutorWorkspace } from '@/lib/tutor/load';
import { formatLabel, splitLessons, tutorStudents } from '@/lib/tutor/overview';

export const metadata = { title: 'Student' };

/**
 * One student, as their tutor may see them.
 *
 * FOUND AMONG THIS TUTOR'S OWN BOOKINGS OR NOT AT ALL. The reference in the URL
 * is only ever matched against students this tutor already teaches, so a
 * reference belonging to any other student — real or not — is simply not found.
 *
 * What is shown is what a request already told the tutor: a first name, a
 * school year, the subject. The family is described only as far as "a parent or
 * guardian arranges these lessons"; who they are and how to reach them is not
 * the tutor's to see here.
 */
export default async function TutorStudentPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const workspace = await loadTutorWorkspace();
  if (workspace === null) return <TutorUnavailable />;

  const now = new Date();
  const student = tutorStudents(workspace.bookings, now).find(
    (entry) => entry.studentReference === reference,
  );
  if (student === undefined) notFound();

  const lessons = workspace.bookings.filter((booking) => booking.studentReference === reference);
  const { upcoming, past } = splitLessons(lessons, now);
  const next = student.nextLesson;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <TextLink href="/tutor/students">← Back to Students</TextLink>
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <Initial name={student.preferredName} />
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-brand-purple-deep">{student.preferredName}</h1>
          <p className="text-sm text-text-secondary">
            {[
              student.schoolYearCode === null ? null : schoolYearLabel(student.schoolYearCode),
              student.subjects.join(', '),
            ]
              .filter((part): part is string => part !== null && part !== '')
              .join(' · ')}
          </p>
        </div>
      </div>

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
                  {lessonDay(next.scheduledStartAt, next.timeZone)}, {timeRange(next)}
                </p>
                <p className="text-sm text-text-secondary">
                  {next.subjectDisplayName} · {formatLabel(next.lessonFormatCode)}
                </p>
                <div>
                  <TextLink href={`/tutor/lessons/${next.reference}`}>View lesson</TextLink>
                </div>
              </>
            )}
          </Panel>

          <Section title="Lessons">
            <Panel>
              <ul className="divide-y divide-surface-border">
                {[...upcoming, ...past].map((booking) => (
                  <LessonRow
                    key={booking.reference}
                    booking={booking}
                    now={now}
                    showStudent={false}
                  />
                ))}
              </ul>
            </Panel>
          </Section>

          <Section title="Notes, homework and progress">
            <Quiet>
              Not available yet. Once lessons can be recorded on Studdy, your notes for{' '}
              {student.preferredName}, the homework you set and their progress will be kept here.
            </Quiet>
          </Section>
        </div>

        <aside className="flex flex-col gap-5">
          <Panel className="flex flex-col gap-2 bg-surface-card-secondary p-4">
            <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">
              Who arranges lessons
            </p>
            <p className="text-sm text-text-secondary">
              {student.bookedByGuardian
                ? `A parent or guardian books and pays for ${student.preferredName}’s lessons.`
                : `${student.preferredName} books and pays for their own lessons.`}
            </p>
            <p className="text-sm text-text-secondary">
              Contact details are not shown here. Messaging is not available on Studdy yet.
            </p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
