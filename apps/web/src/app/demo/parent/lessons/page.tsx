import { ParentShell } from '@/components/demo/demo-shells';
import {
  Chip,
  DemoNote,
  DemoButton,
  PageHead,
  Row,
  RowList,
  RowMain,
  RowMeta,
  SectionLine,
} from '@/components/demo/kit';
import { formatLessonDateTime } from '@/components/requests/request-status';
import { JACOB, STACEY } from '@/lib/demo/fixtures';
import { lessonRecord } from '@/lib/demo/lesson-records';
import { lessonsForStudent } from '@/lib/demo/schedule';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Lessons' };

/**
 * WHAT THE FAMILY GETS BETWEEN LESSONS.
 *
 * The summary and the homework are the clearest signal that Studdy is about the
 * tutoring rather than about the transaction — a booking product ends at the
 * payment screen, and this page is what comes after it.
 *
 * The most recent lesson is expanded, because that is the one a parent actually
 * wants when they open this: what happened on Tuesday, and what he is supposed
 * to be doing before next week.
 */

function Detail({
  label,
  tone = 'plain',
  children,
}: {
  label: string;
  tone?: 'plain' | 'good' | 'watch';
  children: React.ReactNode;
}) {
  const rule =
    tone === 'good'
      ? 'border-l-2 border-brand pl-3.5'
      : tone === 'watch'
        ? 'border-l-2 border-status-warning pl-3.5'
        : 'pl-0';
  return (
    <div className={rule}>
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-[13.5px] leading-relaxed text-text-secondary">{children}</dd>
    </div>
  );
}

export default function ParentLessonsPage() {
  const now = new Date();
  const { upcoming, past } = lessonsForStudent(JACOB.slug, now);
  const latest = past[0] ?? null;
  const record = lessonRecord(latest?.topic ?? null);

  return (
    <ParentShell active="/demo/parent/lessons">
      <PageHead
        title="Lessons"
        sub={`${JACOB.firstName}'s sessions with ${STACEY.firstName}, and what was set afterwards.`}
      />

      {latest !== null && record !== null ? (
        <section className="mt-8">
          <SectionLine
            title="Most recent"
            meta={formatLessonDateTime(latest.at, PLATFORM_TIME_ZONE)}
          />
          <h3 className="mt-4 font-display text-[22px] font-medium text-text-primary">
            {latest.topic}
          </h3>
          <dl className="mt-4 grid max-w-[76ch] gap-x-9 gap-y-5 sm:grid-cols-2">
            <Detail label="What we covered">{record.covered}</Detail>
            <Detail label="Understood well" tone="good">
              {record.understood}
            </Detail>
            <Detail label="Struggled with" tone="watch">
              {record.struggled}
            </Detail>
            <Detail label="Next focus">{record.next}</Detail>
          </dl>

          <p className="mt-7 text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
            Homework set
          </p>
          <ul className="mt-2 flex max-w-[68ch] flex-col">
            {record.homework.map((task) => (
              <li
                key={task}
                className="flex gap-3 border-b border-surface-border py-2.5 text-[14.5px] text-text-secondary last:border-b-0"
              >
                <span aria-hidden className="text-brand">
                  &middot;
                </span>
                {task}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10">
        <SectionLine title="Coming up" meta={`${upcoming.length}`} />
        <div className="mt-1">
          <RowList>
            {upcoming.map((lesson) => (
              <Row key={lesson.id}>
                <RowMain
                  name={formatLessonDateTime(lesson.at, PLATFORM_TIME_ZONE)}
                  detail={`With ${STACEY.firstName} · ${String(lesson.durationMinutes)} min`}
                />
                <Chip tone="current">Booked</Chip>
              </Row>
            ))}
          </RowList>
        </div>
      </section>

      <section className="mt-10">
        <SectionLine title="Earlier" meta={`${past.length}`} />
        <div className="mt-1">
          <RowList>
            {past.map((lesson) => (
              <Row key={lesson.id}>
                <RowMain
                  name={lesson.topic ?? 'Lesson'}
                  detail={formatLessonDateTime(lesson.at, PLATFORM_TIME_ZONE)}
                />
                <Chip tone="neutral">Completed</Chip>
                <RowMeta>{lesson.durationMinutes} min</RowMeta>
              </Row>
            ))}
          </RowList>
        </div>
      </section>

      <div className="mt-9">
        <DemoNote title="Written by the tutor, not by a machine">
          Studdy does not record or transcribe lessons. {STACEY.firstName} writes the summary and
          sets the homework after each session, and you see both. These are sample notes.
        </DemoNote>
      </div>

      <div className="mt-6">
        <DemoButton href="/demo/parent/rebook" tone="tertiary" size="sm">
          Book another lesson
        </DemoButton>
      </div>
    </ParentShell>
  );
}
