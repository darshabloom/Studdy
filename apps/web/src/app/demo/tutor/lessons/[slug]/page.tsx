import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { TutorShell } from '@/components/demo/demo-shells';
import {
  Chip,
  DemoButton,
  DemoNote,
  Disc,
  EditAffordance,
  Fact,
  Facts,
  Panel,
  PanelBody,
  PanelHead,
} from '@/components/demo/kit';
import { formatLessonDateTime } from '@/components/requests/request-status';
import { money } from '@/lib/demo/fixtures';
import { lessonRecord } from '@/lib/demo/lesson-records';
import { lessonById, serviceNameFor } from '@/lib/demo/schedule';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Lesson' };

/**
 * ONE TAUGHT LESSON — the record it leaves behind.
 *
 * Five labelled parts rather than a paragraph, because the value of keeping a
 * lesson record only becomes obvious when you can see it answering the
 * questions a parent actually has: what did they do, did he get it, where is he
 * stuck, and what happens next. A paragraph hides all four.
 *
 * Written by the tutor. Studdy does not record or transcribe lessons, and the
 * page says so rather than letting anyone assume otherwise.
 */
export default async function TutorLessonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const now = new Date();
  const lesson = lessonById(slug, now);
  if (lesson === null) notFound();

  const record = lessonRecord(lesson.topic);

  return (
    <TutorShell active="/demo/tutor/lessons">
      <DemoButton href="/demo/tutor/lessons" tone="quiet" size="sm">
        &larr; All lessons
      </DemoButton>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <Disc initials={lesson.student.initials} size="lg" />
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
              {lesson.student.firstName} &middot; {formatLessonDateTime(lesson.at, PLATFORM_TIME_ZONE)}
            </p>
            <h1 className="mt-1.5 font-display text-[28px] font-semibold leading-tight tracking-[-0.018em] text-text-primary text-balance">
              {lesson.topic ?? 'Lesson'}
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={lesson.status === 'completed' ? 'neutral' : 'current'}>
            {lesson.status === 'completed' ? 'Completed' : 'Booked'}
          </Chip>
          <EditAffordance label="Edit notes">
            <p>
              In the product you write the summary and set the homework here, and the family sees
              both as soon as you save.
            </p>
          </EditAffordance>
        </div>
      </header>

      {record === null ? null : (
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
          <div className="flex flex-col gap-5">
            <Panel>
              <PanelHead title="Lesson record" meta="Written after the lesson" />
              <PanelBody className="flex flex-col gap-5">
                <Part label="What we covered">{record.covered}</Part>
                <Part label="Understood well" tone="good">
                  {record.understood}
                </Part>
                <Part label="Struggled with" tone="watch">
                  {record.struggled}
                </Part>
                <Part label="What changed in the lesson">{record.changed}</Part>
                <Part label="Next focus">{record.next}</Part>
              </PanelBody>
            </Panel>

            <Panel tone="hero">
              <PanelHead title="Homework set" meta={`${String(record.homework.length)} tasks`} />
              <PanelBody>
                <ul className="flex flex-col gap-2.5">
                  {record.homework.map((task) => (
                    <li key={task} className="flex gap-3 text-[14.5px] leading-relaxed text-text-primary">
                      <span
                        aria-hidden
                        className="mt-[3px] flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-[3px] border border-brand/40 bg-surface-card text-[10px] text-brand"
                      >
                        ✓
                      </span>
                      {task}
                    </li>
                  ))}
                </ul>
              </PanelBody>
            </Panel>
          </div>

          <div className="flex flex-col gap-5">
            <Panel>
              <PanelHead title="The lesson" />
              <PanelBody>
                <Facts>
                  <Fact label="Student" value={lesson.student.firstName} />
                  <Fact label="Service" value={serviceNameFor(lesson.student)} />
                  <Fact label="Length" value={`${String(lesson.durationMinutes)} minutes`} />
                  <Fact
                    label="Format"
                    value={lesson.format === 'online' ? 'Online' : 'In person'}
                  />
                  <Fact label="Paid" value={money(lesson.priceMinor)} strong />
                </Facts>
                <div className="mt-4">
                  <DemoButton
                    href={`/demo/tutor/students/${lesson.student.slug}`}
                    tone="tertiary"
                    size="sm"
                  >
                    Open {lesson.student.firstName}
                  </DemoButton>
                </div>
              </PanelBody>
            </Panel>

            <DemoNote title="The family sees this too">
              {lesson.student.parentName} gets the summary and the homework as soon as you save
              them. Written by you &mdash; Studdy does not record or transcribe lessons.
            </DemoNote>
          </div>
        </div>
      )}
    </TutorShell>
  );
}

/**
 * One labelled part of the record.
 *
 * `good` and `watch` are the only two that carry any colour, and they are a
 * left rule rather than a fill: what a parent scans for is where their child is
 * strong and where they are stuck, and those two lines should be findable
 * without reading the other three.
 */
function Part({
  label,
  tone = 'plain',
  children,
}: {
  label: string;
  tone?: 'plain' | 'good' | 'watch';
  children: ReactNode;
}): ReactNode {
  const rule =
    tone === 'good'
      ? 'border-l-2 border-brand pl-4'
      : tone === 'watch'
        ? 'border-l-2 border-status-warning pl-4'
        : 'pl-0';
  return (
    <div className={rule}>
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">{label}</p>
      <p className="mt-1.5 max-w-[66ch] text-[14.5px] leading-relaxed text-text-secondary">
        {children}
      </p>
    </div>
  );
}
