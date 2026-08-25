import { describe, expect, it } from 'vitest';
import { bookingSections, previousAskedStep, previousHref, unaskedSteps } from './sections';
import type { BookingParams, BookingStep } from './draft';
import type { SummaryRow } from '@/components/booking/booking-summary';

/**
 * The accordion and the Back link, without a database.
 *
 * These are the rules a family actually feels — which section is open, which
 * one reopens when tapped, and which questions were never asked at all — so
 * they are worth pinning down independently of what any particular tutor
 * happens to publish.
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
    { step: 'child', label: 'Who for', value: 'Fox', settled: false },
    { step: 'subject', label: 'Subject', value: 'Mathematics', settled: false },
    { step: 'tutor', label: 'Tutor', value: 'Aroha', settled: false },
    { step: 'length', label: 'Lesson length', value: '60 minutes · $40.00', settled: false },
    { step: 'format', label: 'Online or in person', value: 'Online', settled: false },
    { step: 'times', label: 'Time', value: 'Tue 1 Sep, 4:00 pm', settled: false },
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
   * The heart of it: a settled answer is shown but not offered as a choice.
   * Following it would land on a screen with one option already taken.
   */
  it('shows a settled answer without offering to change it', () => {
    const sections = bookingSections(
      rows({ tutor: { settled: true }, length: { settled: true } }),
      'times',
      PARAMS,
    );

    const tutor = sections.find((section) => section.step === 'tutor');
    expect(tutor?.value).toBe('Aroha');
    expect(tutor?.settled).toBe(true);
    expect(tutor?.href).toBeNull();

    expect(sections.find((section) => section.step === 'length')?.href).toBeNull();
    // An answer the family really made is still changeable beside it.
    expect(sections.find((section) => section.step === 'subject')?.href).not.toBeNull();
  });

  it('treats every answered section as complete once the family reaches review', () => {
    const sections = bookingSections(rows(), 'review', PARAMS);
    expect(sections.every((section) => section.state === 'complete')).toBe(true);
  });
});

describe('unaskedSteps', () => {
  it('counts a settled answer as a question that was never put', () => {
    const unasked = unaskedSteps(rows({ child: { settled: true }, tutor: { settled: true } }));
    expect([...unasked].sort()).toEqual(['child', 'tutor']);
  });

  it('also honours a step the caller already knows will not appear', () => {
    const unasked = unaskedSteps(rows({ child: { settled: true } }), ['format']);
    expect([...unasked].sort()).toEqual(['child', 'format']);
  });
});

describe('previousAskedStep', () => {
  it('walks back to the previous real question', () => {
    expect(previousAskedStep('times', new Set())).toBe('format');
  });

  it('steps over questions the family was never asked', () => {
    expect(previousAskedStep('times', new Set<BookingStep>(['format', 'length']))).toBe('tutor');
  });

  /**
   * The case that made this worth extracting. When everything before a step was
   * settled there is nowhere to go back TO, and Back must disappear rather than
   * land on the first screen — which would be a one-option question the journey
   * has just finished deciding not to ask.
   */
  it('reports no previous step when every earlier question was settled', () => {
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
