import { notFound } from 'next/navigation';
import { TutorShell } from '@/components/demo/demo-shells';
import {
  Aside,
  CardsHead,
  Chip,
  DemoButton,
  Disc,
  EarningsSplit,
  Fact,
  Facts,
  OpenMark,
  Panel,
  PanelBody,
  PanelHead,
  Stat,
} from '@/components/demo/kit';
import { CADENCE_LABEL, priceFor, serviceById, studentBySlug } from '@/lib/demo/fixtures';
import { lessonRecord } from '@/lib/demo/lesson-records';
import { lessonsForStudent, serviceNameFor, spanLabel } from '@/lib/demo/schedule';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Student' };

const SHORT = new Intl.DateTimeFormat('en-NZ', {
  timeZone: PLATFORM_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/**
 * ONE RELATIONSHIP.
 *
 * The screen a tutor opens before a lesson: what this student is working on,
 * what the standing arrangement is, and what happened last time. The goal is
 * the most human thing in the tutor workspace and it leads the page.
 *
 * The rate panel shows the split rather than the price. A tutor looking at a
 * relationship is asking what it is worth to her, and the listed price is not
 * that number.
 */
export default async function TutorStudentPage({ params }: { params: Promise<{ slug: string }> }) {
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

      {/* ── Who, and what we are trying to fix ────────────────────────── */}
      <div className="mt-4">
        <Panel tone="hero">
          <PanelBody className="flex flex-wrap items-start gap-x-8 gap-y-6 py-6">
            <div className="flex min-w-[240px] flex-1 items-start gap-4">
              <Disc initials={student.initials} size="lg" />
              <div className="min-w-0">
                <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.018em] text-text-primary">
                  {student.firstName}
                </h1>
                <p className="mt-1 text-[13px] text-text-muted">
                  Year {student.schoolYear} &middot; {serviceNameFor(student)} &middot;{' '}
                  {student.parentName}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <Chip tone={student.cadence === 'paused' ? 'ghost' : 'current'}>
                    {CADENCE_LABEL[student.cadence]}
                  </Chip>
                  <Chip tone="neutral">
                    {student.lessonsSoFar} {student.lessonsSoFar === 1 ? 'lesson' : 'lessons'}
                  </Chip>
                </div>
              </div>
            </div>

            <span aria-hidden className="hidden h-20 w-px bg-brand/20 sm:block" />

            <div className="min-w-[240px] flex-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-brand-strong">
                What we are working on
              </p>
              <p className="mt-1.5 max-w-[52ch] font-display text-[18px] leading-snug text-text-primary">
                {student.goal}
              </p>
            </div>
          </PanelBody>
        </Panel>
      </div>

      {/* ── The arrangement, and what it pays ─────────────────────────── */}
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHead title="The arrangement" />
          <PanelBody>
            <Facts>
              <Fact label="Cadence" value={student.standing} />
              <Fact label="Length" value={`${String(student.durationMinutes)} minutes`} />
              <Fact label="Format" value={student.format === 'online' ? 'Online' : 'In person'} />
              <Fact label="Service" value={service?.name ?? 'Maths'} />
              <Fact label="Parent" value={student.parentName} />
            </Facts>
          </PanelBody>
        </Panel>

        <Panel tone="quiet">
          <PanelHead title="What this lesson pays" />
          <PanelBody>
            <EarningsSplit grossMinor={priceFor(student.durationMinutes)} />
            <p className="mt-3 text-[12px] leading-relaxed text-text-muted">
              Studdy&rsquo;s commission comes out of the listed price, so the family pays exactly
              the figure they were shown.
            </p>
          </PanelBody>
        </Panel>
      </div>

      {/* ── What is booked ────────────────────────────────────────────── */}
      <div className="mt-5">
        <Panel>
          <PanelHead title="Coming up" meta={`${String(upcoming.length)}`} />
          <PanelBody className="grid gap-4 sm:grid-cols-2">
            {upcoming.length === 0 ? (
              <div className="sm:col-span-2">
                <Aside title="Nothing booked">
                  {student.cadence === 'paused'
                    ? student.standing
                    : 'No lesson in the next fortnight.'}
                </Aside>
              </div>
            ) : (
              upcoming.map((lesson) => (
                <div
                  key={lesson.id}
                  className="flex flex-col gap-2 rounded-[5px] border border-surface-border bg-surface-card-secondary px-4 py-3.5"
                >
                  <p className="text-[14px] font-semibold tabular-nums text-text-primary">
                    {spanLabel(lesson.at, lesson.durationMinutes)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone="current">Booked</Chip>
                    <Chip tone="ghost">{lesson.format === 'online' ? 'Online' : 'In person'}</Chip>
                  </div>
                </div>
              ))
            )}
          </PanelBody>
        </Panel>
      </div>

      {/* ── What has been taught, as records you can open ─────────────── */}
      {past.length > 0 ? (
        <section className="mt-8">
          <CardsHead
            title="Lesson records"
            meta={`${String(past.length)}`}
            action={
              <DemoButton href="/demo/tutor/lessons" tone="quiet" size="sm">
                All lessons
              </DemoButton>
            }
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {past.map((lesson) => {
              const record = lessonRecord(lesson.topic);
              return (
                <Panel key={lesson.id} href={`/demo/tutor/lessons/${lesson.id}`}>
                  <PanelBody className="flex h-full flex-col gap-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="min-w-0 font-display text-[16.5px] font-medium leading-tight text-text-primary">
                        {lesson.topic ?? 'Lesson'}
                      </h3>
                      <OpenMark label="" />
                    </div>
                    <p className="text-[12px] tabular-nums text-text-muted">
                      {SHORT.format(lesson.at)} &middot; {lesson.durationMinutes} min
                    </p>
                    {record === null ? null : (
                      <p className="text-[12.5px] leading-relaxed text-text-secondary">
                        {record.struggled}
                      </p>
                    )}
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                      <Chip tone="neutral">Completed</Chip>
                      {record === null ? null : (
                        <Chip tone="ghost">{record.homework.length} homework</Chip>
                      )}
                    </div>
                  </PanelBody>
                </Panel>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="mt-5">
        <Panel tone="quiet">
          <PanelHead title="History" />
          <PanelBody className="flex flex-wrap gap-x-9 gap-y-4">
            <Stat label="Lessons so far" value={String(student.lessonsSoFar)} />
            <Stat
              label="Records written"
              value={String(past.length)}
              detail="summary and homework"
            />
            <Stat label="Booked ahead" value={String(upcoming.length)} detail="next fortnight" />
          </PanelBody>
        </Panel>
      </div>
    </TutorShell>
  );
}
