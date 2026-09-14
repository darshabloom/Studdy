import { TutorShell } from '@/components/demo/demo-shells';
import {
  CardsHead,
  Chip,
  DemoNote,
  Disc,
  NotePanel,
  OpenMark,
  Panel,
  PanelBody,
  PanelHead,
  TaskList,
} from '@/components/demo/kit';
import { netMoney } from '@/lib/demo/fixtures';
import { lessonRecord } from '@/lib/demo/lesson-records';
import {
  committedLessons,
  demoFortnight,
  pastLessons,
  serviceNameFor,
  spanLabel,
} from '@/lib/demo/schedule';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Lessons' };

const DAY = new Intl.DateTimeFormat('en-NZ', {
  timeZone: PLATFORM_TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const SHORT = new Intl.DateTimeFormat('en-NZ', {
  timeZone: PLATFORM_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/**
 * LESSONS, PAST AND UPCOMING — where Studdy stops being a booking product.
 *
 * A completed lesson carries a summary and the homework that was set, which is
 * the hint that the relationship continues between sessions. Those artefacts
 * are written by the tutor in the product; here they are sample text, and the
 * demo note says so rather than implying a recording or transcription pipeline
 * that does not exist.
 *
 * The most recent record leads at full size, because the thing a tutor does on
 * this page is reread what she wrote last time before writing the next one.
 * Everything else is a card that opens.
 */
export default function TutorLessonsPage() {
  const now = new Date();
  const upcoming = committedLessons(demoFortnight(now), now);
  const past = pastLessons(now, 8);
  const latest = past[0] ?? null;
  const record = lessonRecord(latest?.topic ?? null);
  const earlier = past.slice(1);

  return (
    <TutorShell active="/demo/tutor/lessons">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
            {past.length} records &middot; {upcoming.length} booked
          </p>
          <h1 className="mt-1.5 font-display text-[30px] font-semibold leading-tight tracking-[-0.018em] text-text-primary">
            Lessons
          </h1>
          <p className="mt-1.5 max-w-[62ch] text-[13.5px] text-text-muted">
            What you have taught, and what is coming. Open a lesson for its summary and homework.
          </p>
        </div>
      </header>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        {/* ── The last record she wrote ──────────────────────────────── */}
        {latest !== null && record !== null ? (
          <Panel tone="hero" href={`/demo/tutor/lessons/${latest.id}`}>
            <PanelHead
              title="Most recent"
              meta={DAY.format(latest.at)}
              action={<OpenMark label="Full record" />}
            />
            <PanelBody className="py-5">
              <div className="flex items-start gap-3.5">
                <Disc initials={latest.student.initials} />
                <div className="min-w-0">
                  <h2 className="font-display text-[22px] font-semibold leading-tight text-text-primary">
                    {latest.topic}
                  </h2>
                  <p className="mt-1 text-[12.5px] text-text-muted">
                    {latest.student.firstName} &middot; {serviceNameFor(latest.student)} &middot;{' '}
                    {latest.durationMinutes} min
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                <NotePanel label="Understood well" tone="good">
                  {record.understood}
                </NotePanel>
                <NotePanel label="Struggled with" tone="watch">
                  {record.struggled}
                </NotePanel>
              </div>

              <div className="mt-5 rounded-[5px] border border-brand/20 bg-surface-card px-4 py-3.5">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
                  Homework set
                </p>
                <div className="mt-2">
                  <TaskList tasks={record.homework} />
                </div>
              </div>
            </PanelBody>
          </Panel>
        ) : null}

        {/* ── What is booked, so the next record has somewhere to go ──── */}
        <Panel>
          <PanelHead title="Upcoming" meta={`${String(upcoming.length)}`} />
          <PanelBody className="flex flex-col gap-3">
            {upcoming.slice(0, 6).map((lesson) => (
              <div
                key={lesson.id}
                className="flex items-start gap-3 border-b border-surface-border pb-3 last:border-b-0 last:pb-0"
              >
                <Disc initials={lesson.student.initials} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[15px] font-medium leading-tight text-text-primary">
                    {lesson.student.firstName}
                  </p>
                  <p className="mt-0.5 text-[12px] tabular-nums text-text-muted">
                    {spanLabel(lesson.at, lesson.durationMinutes)}
                  </p>
                </div>
                <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-text-secondary">
                  {netMoney(lesson.priceMinor)}
                </span>
              </div>
            ))}
          </PanelBody>
        </Panel>
      </div>

      {/* ── The rest of the record shelf ──────────────────────────────── */}
      {earlier.length > 0 ? (
        <section className="mt-6 sm:mt-8">
          <CardsHead title="Taught" meta={`${String(earlier.length)} more`} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {earlier.map((lesson) => {
              const entry = lessonRecord(lesson.topic);
              return (
                <Panel key={lesson.id} href={`/demo/tutor/lessons/${lesson.id}`}>
                  <PanelBody className="flex h-full flex-col gap-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="min-w-0 font-display text-[16px] font-medium leading-tight text-text-primary">
                        {lesson.topic ?? 'Lesson'}
                      </h3>
                      <OpenMark label="" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Disc initials={lesson.student.initials} size="sm" />
                      <p className="min-w-0 text-[12px] tabular-nums text-text-muted">
                        {lesson.student.firstName} &middot; {SHORT.format(lesson.at)}
                      </p>
                    </div>
                    {entry === null ? null : (
                      <p className="text-[12.5px] leading-relaxed text-text-secondary">
                        {entry.next}
                      </p>
                    )}
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                      {/* Colourless on purpose. A finished lesson is history,
                          not a call to action, and forest is reserved for the
                          three things that are. */}
                      <Chip tone="neutral">Completed</Chip>
                      {entry === null ? null : (
                        <Chip tone="ghost">{entry.homework.length} homework</Chip>
                      )}
                    </div>
                  </PanelBody>
                </Panel>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="mt-6 sm:mt-8">
        <DemoNote title="Summaries and homework are written by the tutor">
          Studdy does not record or transcribe lessons. After a lesson the tutor writes a short
          summary and sets homework, and the family sees both. The examples in this demo are sample
          text.
        </DemoNote>
      </div>
    </TutorShell>
  );
}
