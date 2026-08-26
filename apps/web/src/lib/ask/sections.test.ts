import { describe, expect, it } from 'vitest';
import { askSections, previousAskHref, previousAskStep, type AskRow } from './sections';
import { askHref, askParamsUpTo, parseAskParams, type AskParams } from './draft';

/**
 * The optional multi-tutor journey's navigation, without a database.
 *
 * Mirrors the booking journey's own section tests deliberately: the two ask
 * different questions, and a family should not be able to tell that two
 * different pieces of code are drawing them.
 */

const SECTION = 'sec-1';

const PARAMS: AskParams = {
  duration: 60,
  format: 'online',
  times: ['2026-09-01T04:00:00.000Z'],
};

function rows(overrides: Partial<Record<string, Partial<AskRow>>> = {}): AskRow[] {
  const base: AskRow[] = [
    { step: 'length', label: 'Lesson length', value: '60 minutes' },
    { step: 'format', label: 'Online or in person', value: 'Online' },
    {
      step: 'times',
      label: 'Preferred times',
      value: null,
      values: ['Tue 1 Sept · 4:00–5:00 pm'],
      note: undefined,
    },
    { step: 'review', label: 'Tutors being asked', value: 'Aroha, James' },
  ];
  return base.map((row) => ({ ...row, ...(overrides[row.step] ?? {}) }));
}

describe('parseAskParams', () => {
  it('reads the answers the journey carries', () => {
    expect(parseAskParams({ duration: '90', format: 'in_person', time: ['a', 'b'] })).toEqual({
      duration: 90,
      format: 'in_person',
      times: ['a', 'b'],
    });
  });

  /**
   * A duration is a price. Nonsense must be dropped rather than coerced, or it
   * reaches the eligibility rules as though the family had chosen it.
   */
  it('drops a duration that is not a positive whole number of minutes', () => {
    for (const value of ['0', '-30', 'sixty', '', '12.5']) {
      expect(parseAskParams({ duration: value }).duration).toBeNull();
    }
  });

  it('drops a format that is not one of the two concrete choices', () => {
    for (const value of ['either', 'any', 'ONLINE', '']) {
      expect(parseAskParams({ format: value }).format).toBeNull();
    }
  });
});

describe('askParamsUpTo', () => {
  /**
   * Going back to the length drops the format AND the times: the times were
   * drawn for a different lesson, and which formats are on offer depends on who
   * is still eligible at the new length.
   */
  it('drops everything that depended on the question being reopened', () => {
    expect(askParamsUpTo('length', PARAMS)).toEqual({
      duration: 60,
      format: null,
      times: [],
    });
  });

  it('keeps the length when reopening the format', () => {
    expect(askParamsUpTo('format', PARAMS)).toEqual({
      duration: 60,
      format: 'online',
      times: [],
    });
  });

  it('keeps everything at the times question', () => {
    expect(askParamsUpTo('times', PARAMS)).toEqual({
      duration: 60,
      format: 'online',
      times: PARAMS.times,
    });
  });
});

describe('askHref', () => {
  it('carries the answers in the URL, one entry per time', () => {
    expect(askHref(SECTION, 'times', PARAMS)).toBe(
      '/shortlist/sec-1/ask/times?duration=60&format=online&time=2026-09-01T04%3A00%3A00.000Z',
    );
  });

  it('omits what has not been answered', () => {
    expect(askHref(SECTION, 'length', {})).toBe('/shortlist/sec-1/ask/length');
  });
});

describe('askSections', () => {
  it('opens exactly one section, and it is the current route', () => {
    const sections = askSections(rows(), 'format', SECTION, PARAMS);
    expect(sections.filter((section) => section.state === 'current')).toHaveLength(1);
    expect(sections.find((section) => section.state === 'current')?.key).toBe('format');
  });

  it('reopens a completed question, dropping what depended on it', () => {
    const sections = askSections(rows(), 'times', SECTION, PARAMS);
    expect(sections.find((section) => section.key === 'length')?.href).toBe(
      '/shortlist/sec-1/ask/length?duration=60',
    );
  });

  it('never offers to jump ahead', () => {
    const sections = askSections(rows(), 'length', SECTION, PARAMS);
    for (const section of sections.filter((candidate) => candidate.state === 'upcoming')) {
      expect(section.href).toBeNull();
    }
  });

  /**
   * On review nothing is being asked, so no section is open — otherwise the
   * persistent panel stays on screen and the same answers appear twice, side by
   * side, at exactly the moment the family is checking they agree.
   */
  it('opens no section at all on review', () => {
    const sections = askSections(rows(), null, SECTION, PARAMS);
    expect(sections.some((section) => section.state === 'current')).toBe(false);
    expect(sections.every((section) => section.state === 'complete')).toBe(true);
  });

  /** Who is being asked falls out of the other answers; it has no screen. */
  it('never offers to change who is being asked', () => {
    const sections = askSections(rows(), null, SECTION, PARAMS);
    expect(sections.find((section) => section.key === 'review')?.href).toBeNull();
  });

  it('carries preferred times as separate entries', () => {
    const sections = askSections(
      rows({
        times: {
          values: ['Tue 1 Sept · 4:00–5:00 pm', 'Tue 1 Sept · 4:30–5:30 pm'],
          note: 'Any one of these',
        },
      }),
      null,
      SECTION,
      PARAMS,
    );
    const times = sections.find((section) => section.key === 'times');

    expect(times?.values).toHaveLength(2);
    expect(times?.note).toBe('Any one of these');
  });
});

describe('previousAskStep', () => {
  it('walks back through the journey', () => {
    expect(previousAskStep('review')).toBe('times');
    expect(previousAskStep('times')).toBe('format');
    expect(previousAskStep('format')).toBe('length');
  });

  it('reports nothing before the first question', () => {
    expect(previousAskStep('length')).toBeNull();
  });

  it('carries only what the earlier question depends on', () => {
    expect(previousAskHref(SECTION, 'times', PARAMS)).toBe(
      '/shortlist/sec-1/ask/format?duration=60&format=online',
    );
  });

  it('has no earlier question to return to from the first', () => {
    expect(previousAskHref(SECTION, 'length', PARAMS)).toBeNull();
  });
});
