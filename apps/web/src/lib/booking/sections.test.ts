import { describe, expect, it } from 'vitest';
import { bookingSections, previousAskedStep, previousHref, unaskedSteps } from './sections';
import type { BookingParams, BookingStep } from './draft';
import type { SummaryRow } from '@/components/booking/booking-summary';

/**
 * The accordion and the Back link, without a database.
 *
 * These are the rules a family actually feels — which section is open, which
 * one reopens when tapped — so they are worth pinning down independently of
 * what any particular tutor happens to publish.
 */

const PARAMS: BookingParams = {
  child: 'child-1',
  subject: 'subject-1',
  tutor: 'tut_abc',
  version: 'ver-1',
  format: 'online',
  times: ['2026-09-01T04:00:00.000Z'],
  week: 1,
};

function rows(overrides: Partial<Record<BookingStep, Partial<SummaryRow>>> = {}): SummaryRow[] {
  const base: SummaryRow[] = [
    { step: 'child', label: 'Who for', value: 'Fox' },
    { step: 'subject', label: 'Subject', value: 'Mathematics' },
    { step: 'tutor', label: 'Tutor', value: 'Aroha' },
    { step: 'length', label: 'Lesson length', value: '60 minutes · $40.00' },
    { step: 'format', label: 'Online or in person', value: 'Online' },
    {
      step: 'times',
      label: 'Preferred times',
      value: null,
      values: ['Tue 1 Sep · 4:00–5:00 pm', 'Tue 1 Sep · 4:30–5:30 pm'],
      note: 'Any one of these',
    },
  ];
  return base.map((row) => ({ ...row, ...(overrides[row.step] ?? {}) }));
}

describe('bookingSections', () => {
  it('opens exactly one section, and it is the current route', () => {
    const sections = bookingSections(rows(), 'tutor', PARAMS);

    expect(sections.filter((section) => section.state === 'current')).toHaveLength(1);
    expect(sections.find((section) => section.state === 'current')?.step).toBe('tutor');
  });

  it('puts answered questions behind the current one and the rest ahead', () => {
    const sections = bookingSections(rows(), 'tutor', PARAMS);
    const state = Object.fromEntries(sections.map((section) => [section.step, section.state]));

    expect(state).toEqual({
      child: 'complete',
      subject: 'complete',
      tutor: 'current',
      length: 'upcoming',
      format: 'upcoming',
      times: 'upcoming',
    });
  });

  it('reopens a completed section, dropping what depended on it', () => {
    const sections = bookingSections(rows(), 'times', PARAMS);
    const subject = sections.find((section) => section.step === 'subject');

    // Reopening the subject cannot keep the tutor chosen under the old one.
    expect(subject?.href).toBe('/book/subject?child=child-1&subject=subject-1');
  });

  it('never offers to reopen the section already open', () => {
    const sections = bookingSections(rows(), 'tutor', PARAMS);
    expect(sections.find((section) => section.step === 'tutor')?.href).toBeNull();
  });

  it('never offers to jump ahead to a question not yet reached', () => {
    const sections = bookingSections(rows(), 'tutor', PARAMS);
    for (const section of sections.filter((candidate) => candidate.state === 'upcoming')) {
      expect(section.href).toBeNull();
    }
  });

  /**
   * The correction that matters. A question with one eligible option is still
   * the parent's to answer, so its row is an ordinary answered row: no marker,
   * and a way back like any other. Scarcity is a fact about supply, not a
   * preference this family expressed.
   */
  it('offers every completed answer back, however few options it had', () => {
    const sections = bookingSections(rows(), 'times', PARAMS);

    for (const step of ['child', 'subject', 'tutor', 'length', 'format'] as const) {
      expect(sections.find((section) => section.step === step)?.href).not.toBeNull();
    }
  });

  /** Times are alternatives, and are carried as separate entries to stay so. */
  it('keeps each preferred time as its own entry, with its full interval', () => {
    const times = bookingSections(rows(), 'review', PARAMS).find(
      (section) => section.step === 'times',
    );

    expect(times?.values).toEqual(['Tue 1 Sep · 4:00–5:00 pm', 'Tue 1 Sep · 4:30–5:30 pm']);
    expect(times?.note).toBe('Any one of these');
  });

  it('counts a multi-value answer as answered', () => {
    const sections = bookingSections(rows(), 'review', PARAMS);
    expect(sections.find((section) => section.step === 'times')?.href).not.toBeNull();
  });

  it('treats every answered section as complete once the family reaches review', () => {
    const sections = bookingSections(rows(), 'review', PARAMS);
    expect(sections.every((section) => section.state === 'complete')).toBe(true);
  });

  it('shows an unanswered question as upcoming, with nothing behind it', () => {
    const sections = bookingSections(rows({ length: { value: null } }), 'length', PARAMS);
    const length = sections.find((section) => section.step === 'length');

    expect(length?.value).toBeNull();
    expect(length?.href).toBeNull();
  });
});

describe('unaskedSteps', () => {
  /** Nothing is inferred: a one-option question is still asked. */
  it('infers nothing from the answers themselves', () => {
    expect([...unaskedSteps(rows())]).toEqual([]);
  });

  it('honours only what a caller states outright', () => {
    expect([...unaskedSteps(rows(), ['format'])]).toEqual(['format']);
  });
});

describe('previousAskedStep', () => {
  it('walks back to the previous question', () => {
    expect(previousAskedStep('times', new Set())).toBe('format');
  });

  it('steps over a question the caller declared unasked', () => {
    expect(previousAskedStep('times', new Set<BookingStep>(['format', 'length']))).toBe('tutor');
  });

  /**
   * The case that made this worth extracting: the old walk stopped at index 0
   * even when the first step was skipped, and Back then landed on a question
   * the journey had never shown.
   */
  it('reports no previous step when every earlier question was skipped', () => {
    const unasked = new Set<BookingStep>(['child', 'subject', 'tutor', 'length', 'format']);
    expect(previousAskedStep('times', unasked)).toBeNull();
  });

  it('reports no previous step from the very first question', () => {
    expect(previousAskedStep('child', new Set())).toBeNull();
  });
});

describe('previousHref', () => {
  it('carries only the answers the target question depends on', () => {
    expect(previousHref('times', PARAMS, new Set())).toBe(
      '/book/format?child=child-1&subject=subject-1&tutor=tut_abc&version=ver-1&format=online',
    );
  });

  it('is null when there is no earlier question', () => {
    const unasked = new Set<BookingStep>(['child', 'subject', 'tutor', 'length', 'format']);
    expect(previousHref('times', PARAMS, unasked)).toBeNull();
  });
});
