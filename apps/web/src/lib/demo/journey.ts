import type { JourneySection } from '@/lib/journey/section';
import { PLATFORM_TIME_ZONE } from '@/lib/time';
import { DEMO_DURATION_MINUTES, DEMO_FAMILY } from './fixtures';
import type { DemoStory, DemoTime } from './story';

/**
 * The request as it is being assembled, in the shape the production
 * `JourneyShell` and `JourneySummary` already draw.
 *
 * The demo reuses those components unchanged. They take a `sections` array and
 * nothing else — no booking draft, no resolver, no server — so the running
 * summary a reviewer watches grow down the right-hand side is the real one.
 *
 * WHO FOR, SUBJECT and TUTOR are answered before the journey starts, exactly as
 * they are in production when a family clicks "Book a lesson" on a profile they
 * reached in a subject context. They are still shown, and still marked as
 * choices, because arriving prefilled does not make them any less chosen.
 */

export type DemoBookingStep = 'format' | 'length' | 'times' | 'review';

const ORDER: readonly DemoBookingStep[] = ['format', 'length', 'times', 'review'];

export interface DemoBookingAnswers {
  readonly format: 'online' | 'in_person' | null;
  readonly durationMinutes: number | null;
  readonly times: readonly DemoTime[];
}

/** 'Tue 9 Sep, 4:00 – 5:00 pm' — the span the lesson would occupy, not a bare start. */
export function intervalLabel(at: Date, durationMinutes: number): string {
  const end = new Date(at.getTime() + durationMinutes * 60_000);
  const date = new Intl.DateTimeFormat('en-NZ', {
    timeZone: PLATFORM_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(at)
    .replace(',', '');
  const clock = (at: Date): string =>
    new Intl.DateTimeFormat('en-NZ', {
      timeZone: PLATFORM_TIME_ZONE,
      hour: 'numeric',
      minute: '2-digit',
    }).format(at);
  return `${date}, ${clock(at)} – ${clock(end)}`;
}

export function demoSections(
  story: DemoStory,
  current: DemoBookingStep | null,
  answers: DemoBookingAnswers,
): readonly JourneySection[] {
  const currentIndex = current === null ? ORDER.length : ORDER.indexOf(current);
  const stateOf = (step: DemoBookingStep): JourneySection['state'] => {
    const index = ORDER.indexOf(step);
    return index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'upcoming';
  };
  /** A section reopens only once it is behind the question being asked. */
  const hrefOf = (step: DemoBookingStep, href: string): string | null =>
    stateOf(step) === 'complete' ? href : null;

  const settled = (key: string, label: string, value: string): JourneySection => ({
    key,
    label,
    value,
    values: [],
    note: null,
    state: 'complete',
    href: null,
  });

  return [
    settled('child', 'Who for', DEMO_FAMILY.studentPreferredName),
    settled('subject', 'Subject', DEMO_FAMILY.subjectDisplayName),
    settled('tutor', 'Tutor', story.tutor.firstName),
    {
      key: 'format',
      label: 'Format',
      value:
        answers.format === null ? null : answers.format === 'online' ? 'Online' : 'In person',
      values: [],
      note: null,
      state: stateOf('format'),
      href: hrefOf('format', '/demo/parent/book/format'),
    },
    {
      key: 'length',
      label: 'Lesson length',
      value: answers.durationMinutes === null ? null : `${String(answers.durationMinutes)} minutes`,
      values: [],
      note: null,
      state: stateOf('length'),
      href: hrefOf('length', '/demo/parent/book/length'),
    },
    {
      key: 'times',
      label: 'Times you can do',
      value: null,
      values: answers.times.map((time) =>
        intervalLabel(time.at, answers.durationMinutes ?? DEMO_DURATION_MINUTES),
      ),
      note: answers.times.length > 1 ? 'Any one of these' : null,
      state: stateOf('times'),
      href: hrefOf('times', '/demo/parent/book/times'),
    },
  ];
}
