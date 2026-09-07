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

interface Artefact {
  readonly summary: string;
  readonly homework: readonly string[];
}

const ARTEFACTS: Readonly<Record<string, Artefact>> = {
  'Quadratic equations': {
    summary:
      'Worked through factorising quadratics where the leading coefficient is not 1. Jacob had the method but was losing signs on the middle term, so we slowed down and wrote every expansion out in full before collecting. By the end he was getting them without the intermediate line.',
    homework: [
      'Exercise 7C, questions 1–8 — factorise only, no solving',
      'Write out one full expansion for any question you get wrong',
    ],
  },
  'Simultaneous equations': {
    summary:
      'Substitution and elimination side by side, on the same three problems, so Jacob could see when each one is less work. He defaults to substitution even when elimination is obviously faster.',
    homework: ['Exercise 6B, questions 4–10', 'For each, note which method you chose and why'],
  },
  'Factorising practice': {
    summary:
      'Consolidation session. Difference of two squares, common factors and simple trinomials mixed together, so choosing the method is part of the question.',
    homework: ['Mixed set on the sheet — 12 questions, 20 minutes, timed'],
  },
};

export default function ParentLessonsPage() {
  const now = new Date();
  const { upcoming, past } = lessonsForStudent(JACOB.slug, now);
  const latest = past[0] ?? null;
  const latestArtefact =
    latest?.topic === undefined || latest.topic === null ? undefined : ARTEFACTS[latest.topic];

  return (
    <ParentShell active="/demo/parent/lessons">
      <PageHead
        title="Lessons"
        sub={`${JACOB.firstName}'s sessions with ${STACEY.firstName}, and what was set afterwards.`}
      />

      {latest !== null && latestArtefact !== undefined ? (
        <section className="mt-8">
          <SectionLine
            title="Most recent"
            meta={formatLessonDateTime(latest.at, PLATFORM_TIME_ZONE)}
          />
          <h3 className="mt-4 font-display text-[22px] font-medium text-text-primary">
            {latest.topic}
          </h3>
          <p className="mt-3 max-w-[68ch] text-[15px] leading-relaxed text-text-secondary">
            {latestArtefact.summary}
          </p>

          <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
            Homework set
          </p>
          <ul className="mt-2 flex max-w-[68ch] flex-col">
            {latestArtefact.homework.map((task) => (
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
