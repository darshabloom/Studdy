import { TutorShell } from '@/components/demo/demo-shells';
import {
  Chip,
  DemoNote,
  Disc,
  PageHead,
  Row,
  RowList,
  RowMain,
  RowMeta,
  SectionLine,
} from '@/components/demo/kit';
import { formatLessonDateTime } from '@/components/requests/request-status';
import { money } from '@/lib/demo/fixtures';
import {
  committedLessons,
  demoFortnight,
  pastLessons,
  serviceNameFor,
} from '@/lib/demo/schedule';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Lessons' };

/**
 * LESSONS, PAST AND UPCOMING — where Studdy stops being a booking product.
 *
 * A completed lesson carries a summary and the homework that was set, which is
 * the hint that the relationship continues between sessions. Those artefacts
 * are written by the tutor in the product; here they are sample text, and the
 * demo note says so rather than implying a recording or transcription pipeline
 * that does not exist.
 */
export default function TutorLessonsPage() {
  const now = new Date();
  const upcoming = committedLessons(demoFortnight(now), now);
  const past = pastLessons(now, 8);

  return (
    <TutorShell active="/demo/tutor/lessons">
      <PageHead
        title="Lessons"
        sub="What you have taught, and what is coming. Open a past lesson for its summary and homework."
      />

      <section className="mt-8">
        <SectionLine title="Upcoming" meta={`${upcoming.length}`} />
        <div className="mt-1">
          <RowList>
            {upcoming.slice(0, 6).map((lesson) => (
              <Row key={lesson.id} href={`/demo/tutor/students/${lesson.student.slug}`}>
                <Disc initials={lesson.student.initials} size="sm" />
                <RowMain
                  name={lesson.student.firstName}
                  detail={`${formatLessonDateTime(lesson.at, PLATFORM_TIME_ZONE)} · ${serviceNameFor(lesson.student)}`}
                />
                <Chip tone="current">Booked</Chip>
                <RowMeta>
                  {lesson.durationMinutes} min
                  <span className="mt-0.5 block text-text-muted">{money(lesson.priceMinor)}</span>
                </RowMeta>
              </Row>
            ))}
          </RowList>
        </div>
      </section>

      <section className="mt-10">
        <SectionLine title="Taught" meta={`${past.length} most recent`} />
        <div className="mt-1">
          <RowList>
            {past.map((lesson) => (
              <Row key={lesson.id} href={`/demo/tutor/lessons/${lesson.id}`}>
                <Disc initials={lesson.student.initials} size="sm" />
                <RowMain
                  name={lesson.topic ?? 'Lesson'}
                  detail={`${lesson.student.firstName} · ${formatLessonDateTime(lesson.at, PLATFORM_TIME_ZONE)}`}
                />
                {/* Colourless on purpose. A finished lesson is history, not a
                    call to action, and forest is reserved for the three things
                    that are. */}
                <Chip tone="neutral">Completed</Chip>
                <RowMeta>{lesson.durationMinutes} min</RowMeta>
              </Row>
            ))}
          </RowList>
        </div>
      </section>

      <div className="mt-9">
        <DemoNote title="Summaries and homework are written by the tutor">
          Studdy does not record or transcribe lessons. After a lesson the tutor writes a short
          summary and sets homework, and the family sees both. The examples in this demo are sample
          text.
        </DemoNote>
      </div>
    </TutorShell>
  );
}
