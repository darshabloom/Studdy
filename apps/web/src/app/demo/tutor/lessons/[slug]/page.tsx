import { notFound } from 'next/navigation';
import { TutorShell } from '@/components/demo/demo-shells';
import {
  Chip,
  DemoButton,
  DemoNote,
  Disc,
  Fact,
  Facts,
  PageHead,
  SectionLine,
} from '@/components/demo/kit';
import { formatLessonDateTime } from '@/components/requests/request-status';
import { money } from '@/lib/demo/fixtures';
import { lessonById, serviceNameFor } from '@/lib/demo/schedule';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Lesson' };

/**
 * ONE TAUGHT LESSON — the post-lesson artefacts.
 *
 * The summary and the homework are what a family actually gets between
 * sessions, and they are the clearest signal that Studdy is about the tutoring
 * rather than about the transaction. They are written by the tutor: nothing
 * here is generated, recorded or transcribed, and the demo says so.
 */

interface Artefact {
  readonly summary: string;
  readonly homework: readonly string[];
  readonly went: string;
}

const ARTEFACTS: Readonly<Record<string, Artefact>> = {
  'Quadratic equations': {
    summary:
      'Worked through factorising quadratics where the leading coefficient is not 1. Jacob had the method but was losing signs on the middle term, so we slowed down and wrote every expansion out in full before collecting. By the end he was getting them without the intermediate line.',
    homework: [
      'Exercise 7C, questions 1–8 — factorise only, no solving',
      'Write out one full expansion for any question you get wrong',
    ],
    went: 'Better than last week. The sign errors are nearly gone.',
  },
  'Simultaneous equations': {
    summary:
      'Substitution and elimination side by side, on the same three problems, so Jacob could see when each one is less work. He defaults to substitution even when elimination is obviously faster — worth watching.',
    homework: ['Exercise 6B, questions 4–10', 'For each, note which method you chose and why'],
    went: 'Solid. Needs to trust elimination more.',
  },
  'Factorising practice': {
    summary:
      'Consolidation session. Difference of two squares, common factors, and simple trinomials mixed together so the choice of method is part of the question rather than given by the exercise heading.',
    homework: ['Mixed set on the sheet — 12 questions, 20 minutes, timed'],
    went: 'Good. Speed is the remaining gap.',
  },
  'Ratio word problems': {
    summary:
      'Sophie can do the arithmetic and stalls at turning a sentence into a ratio. We spent the lesson only on the translation step and did not solve a single one — deliberately.',
    homework: ['Five worded problems: write the ratio, do not solve'],
    went: 'A real shift. She saw the pattern by the fourth one.',
  },
};

const DEFAULT_ARTEFACT: Artefact = {
  summary:
    'Covered the planned material and checked the previous week’s homework at the start. Nothing outstanding.',
  homework: ['Practice set from the workbook'],
  went: 'Steady.',
};

export default async function TutorLessonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const now = new Date();
  const lesson = lessonById(slug, now);
  if (lesson === null) notFound();

  const artefact = (lesson.topic === null ? undefined : ARTEFACTS[lesson.topic]) ?? DEFAULT_ARTEFACT;

  return (
    <TutorShell active="/demo/tutor/lessons">
      <DemoButton href="/demo/tutor/lessons" tone="quiet" size="sm">
        &larr; All lessons
      </DemoButton>

      <div className="mt-4 flex items-start gap-4">
        <Disc initials={lesson.student.initials} size="lg" />
        <div className="min-w-0 flex-1">
          <PageHead
            title={lesson.topic ?? 'Lesson'}
            sub={`${lesson.student.firstName} · ${formatLessonDateTime(lesson.at, PLATFORM_TIME_ZONE)}`}
          />
        </div>
        <Chip tone={lesson.status === 'completed' ? 'neutral' : 'current'}>
          {lesson.status === 'completed' ? 'Completed' : 'Booked'}
        </Chip>
      </div>

      <section className="mt-8 max-w-[68ch]">
        <SectionLine title="Lesson summary" />
        <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">{artefact.summary}</p>
      </section>

      <section className="mt-8 max-w-[68ch]">
        <SectionLine title="Homework set" />
        <ul className="mt-3 flex flex-col gap-2">
          {artefact.homework.map((task) => (
            <li
              key={task}
              className="flex gap-3 border-b border-surface-border pb-2 text-[14.5px] text-text-secondary last:border-b-0"
            >
              <span aria-hidden className="text-brand">
                &middot;
              </span>
              {task}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 grid gap-x-10 sm:grid-cols-2">
        <div>
          <SectionLine title="How it went" />
          <p className="mt-3 text-[14.5px] text-text-secondary">{artefact.went}</p>
        </div>
        <div>
          <SectionLine title="The lesson" />
          <div className="mt-3">
            <Facts>
              <Fact label="Service" value={serviceNameFor(lesson.student)} />
              <Fact label="Length" value={`${String(lesson.durationMinutes)} minutes`} />
              <Fact label="Format" value={lesson.format === 'online' ? 'Online' : 'In person'} />
              <Fact label="Paid" value={money(lesson.priceMinor)} strong />
            </Facts>
          </div>
        </div>
      </section>

      <div className="mt-9">
        <DemoNote title="The family sees this too">
          The summary and homework appear on {lesson.student.parentName}&rsquo;s side as soon as you
          save them. Written by you &mdash; Studdy does not record or transcribe lessons.
        </DemoNote>
      </div>

      <div className="mt-6">
        <DemoButton href={`/demo/tutor/students/${lesson.student.slug}`} tone="tertiary" size="sm">
          Open {lesson.student.firstName}
        </DemoButton>
      </div>
    </TutorShell>
  );
}
