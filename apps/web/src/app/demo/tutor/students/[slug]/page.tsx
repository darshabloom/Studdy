import { notFound } from 'next/navigation';
import { TutorShell } from '@/components/demo/demo-shells';
import {
  Aside,
  Chip,
  DemoButton,
  Disc,
  Fact,
  Facts,
  PageHead,
  Row,
  RowList,
  RowMain,
  RowMeta,
  SectionLine,
} from '@/components/demo/kit';
import { formatLessonDateTime } from '@/components/requests/request-status';
import { CADENCE_LABEL, money, priceFor, serviceById, studentBySlug } from '@/lib/demo/fixtures';
import { lessonsForStudent, serviceNameFor } from '@/lib/demo/schedule';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Student' };

/**
 * ONE RELATIONSHIP.
 *
 * The screen a tutor opens before a lesson: what this student is working on,
 * what the standing arrangement is, and what happened last time. The goal line
 * is the most human thing in the tutor workspace and it is deliberately near
 * the top.
 */
export default async function TutorStudentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const student = studentBySlug(slug);
  if (student === null) notFound();

  const now = new Date();
  const { upcoming, past } = lessonsForStudent(slug, now);
  const service = serviceById(student.serviceId);

  return (
    <TutorShell active="/demo/tutor/students">
      <DemoButton href="/demo/tutor/students" tone="quiet" size="sm">
        &larr; All students
      </DemoButton>

      <div className="mt-4 flex items-start gap-4">
        <Disc initials={student.initials} size="lg" />
        <div className="min-w-0 flex-1">
          <PageHead
            title={student.firstName}
            sub={`Year ${String(student.schoolYear)} · ${serviceNameFor(student)} · ${student.parentName}`}
          />
        </div>
        <Chip tone={student.cadence === 'paused' ? 'ghost' : 'current'}>
          {CADENCE_LABEL[student.cadence]}
        </Chip>
      </div>

      <div className="mt-7 border-l-2 border-brand bg-brand-tint/40 px-5 py-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-brand-strong">
          What we are working on
        </p>
        <p className="mt-1.5 max-w-[68ch] font-display text-[18px] leading-snug text-text-primary">
          {student.goal}
        </p>
      </div>

      <section className="mt-8 grid gap-x-10 sm:grid-cols-2">
        <div>
          <SectionLine title="The arrangement" />
          <div className="mt-3">
            <Facts>
              <Fact label="Cadence" value={student.standing} />
              <Fact label="Length" value={`${String(student.durationMinutes)} minutes`} />
              <Fact label="Format" value={student.format === 'online' ? 'Online' : 'In person'} />
              <Fact label="Rate" value={money(priceFor(student.durationMinutes))} />
            </Facts>
          </div>
        </div>
        <div>
          <SectionLine title="History" />
          <div className="mt-3">
            <Facts>
              <Fact label="Lessons so far" value={String(student.lessonsSoFar)} />
              <Fact label="Service" value={service?.name ?? 'Maths'} />
              <Fact label="Parent" value={student.parentName} />
            </Facts>
          </div>
        </div>
      </section>

      {upcoming.length > 0 ? (
        <section className="mt-9">
          <SectionLine title="Coming up" meta={`${upcoming.length}`} />
          <div className="mt-1">
            <RowList>
              {upcoming.map((lesson) => (
                <Row key={lesson.id}>
                  <RowMain
                    name={formatLessonDateTime(lesson.at, PLATFORM_TIME_ZONE)}
                    detail={`${String(lesson.durationMinutes)} min · ${lesson.format === 'online' ? 'Online' : 'In person'}`}
                  />
                  <Chip tone="current">Booked</Chip>
                  <RowMeta>{money(lesson.priceMinor)}</RowMeta>
                </Row>
              ))}
            </RowList>
          </div>
        </section>
      ) : (
        <section className="mt-9">
          <SectionLine title="Coming up" />
          <div className="mt-3">
            <Aside title="Nothing booked">
              {student.cadence === 'paused'
                ? student.standing
                : 'No lesson in the next fortnight.'}
            </Aside>
          </div>
        </section>
      )}

      {past.length > 0 ? (
        <section className="mt-9">
          <SectionLine title="Past lessons" meta={`${past.length}`} />
          <div className="mt-1">
            <RowList>
              {past.map((lesson) => (
                <Row key={lesson.id} href={`/demo/tutor/lessons/${lesson.id}`}>
                  <RowMain
                    name={lesson.topic ?? 'Lesson'}
                    detail={formatLessonDateTime(lesson.at, PLATFORM_TIME_ZONE)}
                  />
                  {/* Generic completion is deliberately colourless. Forest is
                      spent on the action, the committed lesson and the current
                      relationship — not on every piece of good news. */}
                  <Chip tone="neutral">Completed</Chip>
                  <RowMeta>{lesson.durationMinutes} min</RowMeta>
                </Row>
              ))}
            </RowList>
          </div>
        </section>
      ) : null}
    </TutorShell>
  );
}
