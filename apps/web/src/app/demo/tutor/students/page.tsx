import type { ReactNode } from 'react';
import { TutorShell } from '@/components/demo/demo-shells';
import { CardsHead, Chip, Disc, OpenMark, Panel, PanelBody } from '@/components/demo/kit';
import { CADENCE_LABEL, STUDENTS, type DemoStudent } from '@/lib/demo/fixtures';
import { committedLessons, demoFortnight, serviceNameFor, spanLabel } from '@/lib/demo/schedule';

export const metadata = { title: 'Students' };

/**
 * THE ROSTER — five relationships, five different shapes.
 *
 * This page is what makes Stacey read as established rather than as somebody
 * with an empty diary and a booking form. The variety is the point: a weekly
 * student, another weekly student, a one-off, a trial, and one paused for the
 * holidays. A product that only models "has lessons / does not" cannot show
 * this list.
 *
 * EACH ONE IS A CARD THAT OPENS, and looks it. These are the objects a tutor
 * navigates by — she thinks "I need to look at Leo before Wednesday", not "row
 * three" — so the goal line is on the card rather than hidden behind it, and
 * the whole surface is the target.
 */
export default function TutorStudentsPage() {
  const now = new Date();
  const upcoming = committedLessons(demoFortnight(now), now);
  const active = STUDENTS.filter((student) => student.cadence !== 'paused');
  const paused = STUDENTS.filter((student) => student.cadence === 'paused');

  const cardFor = (student: DemoStudent): ReactNode => {
    const next = upcoming.find((lesson) => lesson.student.slug === student.slug);
    const isPaused = student.cadence === 'paused';
    return (
      <Panel
        key={student.slug}
        href={`/demo/tutor/students/${student.slug}`}
        tone={isPaused ? 'quiet' : 'default'}
      >
        <PanelBody className={`flex h-full flex-col gap-3.5 ${isPaused ? 'opacity-75' : ''}`}>
          <div className="flex items-start gap-3.5">
            <Disc initials={student.initials} />
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-[18px] font-medium leading-tight text-text-primary">
                {student.firstName}
              </h3>
              <p className="mt-0.5 text-[12.5px] text-text-muted">
                Year {student.schoolYear} &middot; {serviceNameFor(student)}
              </p>
            </div>
            <OpenMark label="" />
          </div>

          <p className="text-[13px] leading-relaxed text-text-secondary">{student.goal}</p>

          <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-surface-border pt-3">
            <Chip tone={isPaused ? 'ghost' : student.cadence === 'one_off' ? 'neutral' : 'current'}>
              {CADENCE_LABEL[student.cadence]}
            </Chip>
            <Chip tone="neutral">
              {student.lessonsSoFar} {student.lessonsSoFar === 1 ? 'lesson' : 'lessons'}
            </Chip>
            <span className="ml-auto text-right text-[12px] tabular-nums text-text-secondary">
              {isPaused
                ? 'Resumes 12 Oct'
                : next === undefined
                  ? 'Nothing booked'
                  : spanLabel(next.at, next.durationMinutes)}
            </span>
          </div>
        </PanelBody>
      </Panel>
    );
  };

  return (
    <TutorShell active="/demo/tutor/students">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
            {STUDENTS.length} families
          </p>
          <h1 className="mt-1.5 font-display text-[30px] font-semibold leading-tight tracking-[-0.018em] text-text-primary">
            Students
          </h1>
          <p className="mt-1.5 max-w-[62ch] text-[13.5px] text-text-muted">
            The arrangement you have with each, and what you are working on together.
          </p>
        </div>
      </header>

      <section className="mt-6 sm:mt-7">
        <CardsHead title="Active" meta={`${String(active.length)}`} />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">{active.map(cardFor)}</div>
      </section>

      {paused.length > 0 ? (
        <section className="mt-6 sm:mt-8">
          <CardsHead title="Paused" meta={`${String(paused.length)}`} />
          <p className="mt-2 max-w-[68ch] text-[13px] text-text-secondary">
            A paused relationship keeps its history and its standing slot, and takes no time out of
            your availability while it lasts.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">{paused.map(cardFor)}</div>
        </section>
      ) : null}
    </TutorShell>
  );
}
