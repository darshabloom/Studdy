import { ParentShell } from '@/components/demo/demo-shells';
import {
  CardsHead,
  Chip,
  DemoButton,
  DemoNote,
  Disc,
  NotePanel,
  OpenMark,
  Panel,
  PanelBody,
  PanelHead,
  PayChip,
  Stat,
  TaskList,
} from '@/components/demo/kit';
import { JACOB, STACEY, money } from '@/lib/demo/fixtures';
import { lessonRecord } from '@/lib/demo/lesson-records';
import { isPaid, lessonsForStudent, spanLabel, withPaid } from '@/lib/demo/schedule';
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
 * THE LESSON WORKSPACE — not a page of notes.
 *
 * What the family gets between lessons is the clearest signal that Studdy is
 * about the tutoring rather than the transaction: a booking product ends at the
 * payment screen, and this is what comes after it. But a reviewer only reads
 * that argument if the page looks like somewhere records are kept.
 *
 * So there are three weights on it. The most recent lesson is a large card,
 * because "what happened on Tuesday, and what is he supposed to be doing before
 * next week" is the actual question. What is coming sits beside it, carrying
 * its payment state. Everything earlier is a grid of cards, each of which
 * opens — a lesson history you can click into is a record; one you cannot is a
 * list of dates.
 */
export default async function ParentLessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string }>;
}) {
  const { paid: paidParam } = await searchParams;
  const paid = isPaid(paidParam);
  const now = new Date();
  const { upcoming, past } = lessonsForStudent(JACOB.slug, now, { family: true, paid });
  const latest = past[0] ?? null;
  const record = lessonRecord(latest?.topic ?? null);
  const earlier = past.slice(1);
  const link = (href: string) => withPaid(href, paid);
  const taughtMinutes = past.reduce((total, lesson) => total + lesson.durationMinutes, 0);

  return (
    <ParentShell active="/demo/parent/lessons" paid={paid}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
            {JACOB.firstName} &middot; with {STACEY.firstName}
          </p>
          <h1 className="mt-1.5 font-display text-[30px] font-semibold leading-tight tracking-[-0.018em] text-text-primary">
            Lessons
          </h1>
        </div>
        <DemoButton href={link('/demo/parent/rebook')}>Book another lesson</DemoButton>
      </header>

      {/* ── The record a parent actually opens this page for ───────────── */}
      {latest !== null && record !== null ? (
        <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
          <Panel tone="hero" href={link(`/demo/parent/lessons/${latest.id}`)}>
            <PanelHead
              title="Latest lesson"
              meta={DAY.format(latest.at)}
              action={<OpenMark label="Full record" />}
            />
            <PanelBody className="py-5">
              <h2 className="font-display text-[24px] font-semibold leading-tight text-text-primary">
                {latest.topic}
              </h2>
              <p className="mt-1 text-[12.5px] text-text-muted">
                {latest.durationMinutes} minutes &middot;{' '}
                {latest.format === 'online' ? 'Online' : 'In person'} &middot; {STACEY.firstName}
              </p>

              <div className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                <NotePanel label="What we covered">{record.covered}</NotePanel>
                <NotePanel label="Understood well" tone="good">
                  {record.understood}
                </NotePanel>
                <NotePanel label="Struggled with" tone="watch">
                  {record.struggled}
                </NotePanel>
                <NotePanel label="Next focus">{record.next}</NotePanel>
              </div>

              <div className="mt-6 rounded-[5px] border border-brand/20 bg-surface-card px-4 py-3.5">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
                  Homework set &middot; {record.homework.length}
                </p>
                <div className="mt-2">
                  <TaskList tasks={record.homework} />
                </div>
              </div>
            </PanelBody>
          </Panel>

          <div className="flex flex-col gap-5">
            {/* Coming up, with the money question answered by the chip. */}
            <Panel
              tone={upcoming.some((lesson) => lesson.payment === 'due') ? 'attention' : 'default'}
            >
              <PanelHead title="Coming up" meta={`${String(upcoming.length)}`} />
              <PanelBody className="flex flex-col gap-3.5">
                {upcoming.length === 0 ? (
                  <p className="text-[13.5px] text-text-secondary">Nothing booked yet.</p>
                ) : (
                  upcoming.map((lesson) => (
                    <div
                      key={lesson.id}
                      className="flex flex-col gap-2 border-b border-surface-border pb-3.5 last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-start gap-3">
                        <Disc initials={STACEY.initials} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-semibold tabular-nums text-text-primary">
                            {spanLabel(lesson.at, lesson.durationMinutes)}
                          </p>
                          <p className="mt-0.5 text-[12px] text-text-muted">
                            {lesson.topic ?? 'Maths'} &middot; {money(lesson.priceMinor)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <PayChip payment={lesson.payment} />
                        {lesson.payment === 'due' ? (
                          <DemoButton href="/demo/parent/rebook/pay" size="sm">
                            Pay now
                          </DemoButton>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </PanelBody>
            </Panel>

            <Panel tone="quiet">
              <PanelHead title="So far" />
              <PanelBody className="flex flex-wrap gap-x-8 gap-y-4">
                <Stat label="Lessons" value={String(JACOB.lessonsSoFar)} detail="since March" />
                <Stat
                  label="Hours"
                  value={(taughtMinutes / 60).toFixed(1)}
                  detail="recorded here"
                />
              </PanelBody>
            </Panel>
          </div>
        </div>
      ) : null}

      {/* ── Every earlier lesson, as something you can open ───────────── */}
      {earlier.length > 0 ? (
        <section className="mt-6 sm:mt-9">
          <CardsHead title="Earlier lessons" meta={`${String(earlier.length)}`} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {earlier.map((lesson) => {
              const entry = lessonRecord(lesson.topic);
              return (
                <Panel key={lesson.id} href={link(`/demo/parent/lessons/${lesson.id}`)}>
                  <PanelBody className="flex h-full flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-display text-[17px] font-medium leading-tight text-text-primary">
                          {lesson.topic ?? 'Lesson'}
                        </h3>
                        <p className="mt-1 text-[12px] tabular-nums text-text-muted">
                          {SHORT.format(lesson.at)} &middot; {lesson.durationMinutes} min &middot;{' '}
                          {STACEY.firstName}
                        </p>
                      </div>
                      <OpenMark label="" />
                    </div>

                    {entry === null ? null : (
                      <p className="text-[13px] leading-relaxed text-text-secondary">
                        {entry.covered}
                      </p>
                    )}

                    <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                      <Chip tone="neutral">Completed</Chip>
                      {entry === null ? null : (
                        <Chip tone="ghost">
                          {entry.homework.length} homework{' '}
                          {entry.homework.length === 1 ? 'task' : 'tasks'}
                        </Chip>
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
        <DemoNote title="Written by the tutor, not by a machine">
          Studdy does not record or transcribe lessons. {STACEY.firstName} writes the summary and
          sets the homework after each session, and you see both. These are sample notes.
        </DemoNote>
      </div>
    </ParentShell>
  );
}
