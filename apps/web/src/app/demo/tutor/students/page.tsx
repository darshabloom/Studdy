import { TutorShell } from '@/components/demo/demo-shells';
import {
  Chip,
  Disc,
  PageHead,
  Row,
  RowList,
  RowMain,
  RowMeta,
  SectionLine,
} from '@/components/demo/kit';
import { formatLessonDateTime } from '@/components/requests/request-status';
import { CADENCE_LABEL, STUDENTS } from '@/lib/demo/fixtures';
import { committedLessons, demoFortnight, serviceNameFor } from '@/lib/demo/schedule';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Students' };

/**
 * THE ROSTER — five relationships, five different shapes.
 *
 * This page is what makes Stacey read as established rather than as somebody
 * with an empty diary and a booking form. The variety is the point: a weekly
 * student, another weekly student, a one-off, a trial, and one paused for the
 * holidays. A product that only models "has lessons / does not" cannot show
 * this list.
 */
export default function TutorStudentsPage() {
  const now = new Date();
  const upcoming = committedLessons(demoFortnight(now), now);
  const active = STUDENTS.filter((student) => student.cadence !== 'paused');
  const paused = STUDENTS.filter((student) => student.cadence === 'paused');

  const rowFor = (student: (typeof STUDENTS)[number]) => {
    const next = upcoming.find((lesson) => lesson.student.slug === student.slug);
    return (
      <Row
        key={student.slug}
        href={`/demo/tutor/students/${student.slug}`}
        muted={student.cadence === 'paused'}
      >
        <Disc initials={student.initials} />
        <RowMain
          name={student.firstName}
          detail={`Year ${String(student.schoolYear)} · ${serviceNameFor(student)} · ${String(student.lessonsSoFar)} ${student.lessonsSoFar === 1 ? 'lesson' : 'lessons'}`}
        />
        <Chip
          tone={
            student.cadence === 'paused'
              ? 'ghost'
              : student.cadence === 'one_off'
                ? 'neutral'
                : 'current'
          }
        >
          {CADENCE_LABEL[student.cadence]}
        </Chip>
        <RowMeta>
          {student.cadence === 'paused'
            ? 'Resumes 12 Oct'
            : next === undefined
              ? '—'
              : formatLessonDateTime(next.at, PLATFORM_TIME_ZONE)}
        </RowMeta>
      </Row>
    );
  };

  return (
    <TutorShell active="/demo/tutor/students">
      <PageHead
        title="Students"
        sub={`${String(STUDENTS.length)} families, and the arrangement you have with each`}
      />

      <section className="mt-8">
        <SectionLine title="Active" meta={`${active.length}`} />
        <div className="mt-1">
          <RowList>{active.map(rowFor)}</RowList>
        </div>
      </section>

      {paused.length > 0 ? (
        <section className="mt-9">
          <SectionLine title="Paused" meta={`${paused.length}`} />
          <p className="mt-3 max-w-[68ch] text-[13.5px] text-text-secondary">
            A paused relationship keeps its history and its standing slot, and takes no time out of
            your availability while it lasts.
          </p>
          <div className="mt-2">
            <RowList>{paused.map(rowFor)}</RowList>
          </div>
        </section>
      ) : null}
    </TutorShell>
  );
}
