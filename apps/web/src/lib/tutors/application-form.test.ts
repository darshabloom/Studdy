import { describe, expect, it } from 'vitest';
import { applicationInputFromFormData } from './application-form';

function form(entries: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  }
  return data;
}

describe('applicationInputFromFormData', () => {
  it('reads every field the form posts', () => {
    const input = applicationInputFromFormData(
      form({
        legalFirstName: 'Aroha',
        legalFamilyName: 'Ngata',
        preferredFirstName: 'Aro',
        phone: '021 123 4567',
        headline: 'Maths',
        teachingApproach: 'Worked examples',
        experienceSummary: 'Five years',
        qualificationsSummary: 'BSc',
        subjectId: ['s1', 's2'],
        yearLevelFrom: '7',
        yearLevelTo: '10',
        offersOnline: 'on',
        'references.0.fullName': 'Hemi',
        'references.0.email': 'hemi@example.test',
        'references.0.relationship': 'Colleague',
        'references.1.fullName': 'Mere',
        'references.1.email': 'mere@example.test',
        'references.1.relationship': 'Parent',
        declarationsAccepted: 'on',
      }),
    );

    expect(input.legalFirstName).toBe('Aroha');
    expect(input.preferredFirstName).toBe('Aro');
    expect(input.subjectIds).toEqual(['s1', 's2']);
    expect(input.yearLevelFrom).toBe('7');
    expect(input.offersOnline).toBe(true);
    expect(input.offersInPerson).toBe(false);
    expect(input.declarationsAccepted).toBe(true);
    expect(input.references[0]).toEqual({
      fullName: 'Hemi',
      email: 'hemi@example.test',
      relationship: 'Colleague',
    });
    expect(input.references).toHaveLength(3);
    expect(input.references[2]).toEqual({ fullName: '', email: '', relationship: '' });
  });

  /** An unchecked box is simply absent from a form post. */
  it('treats an absent checkbox as unchecked', () => {
    const input = applicationInputFromFormData(form({}));
    expect(input.offersOnline).toBe(false);
    expect(input.offersInPerson).toBe(false);
    expect(input.declarationsAccepted).toBe(false);
  });

  it('never fails: an empty post becomes an empty application', () => {
    const input = applicationInputFromFormData(form({}));
    expect(input.legalFirstName).toBe('');
    expect(input.subjectIds).toEqual([]);
    expect(input.references.every((reference) => reference.email === '')).toBe(true);
  });

  /** Only the exact value a browser sends for a ticked box counts. */
  it('does not treat other values as a ticked box', () => {
    const input = applicationInputFromFormData(
      form({ declarationsAccepted: 'true', offersOnline: 'yes' }),
    );
    expect(input.declarationsAccepted).toBe(false);
    expect(input.offersOnline).toBe(false);
  });

  it('ignores a file or non-string value in a text field', () => {
    const data = new FormData();
    data.append('headline', new Blob(['x']), 'x.txt');
    expect(applicationInputFromFormData(data).headline).toBe('');
  });
});
