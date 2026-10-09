import { describe, expect, it } from 'vitest';
import { validateTutorService } from '@studdy/domain/tutors';
import {
  profileInputFromFormData,
  serviceInputFromFormData,
  serviceInputFromRecord,
} from './service-form';
import { SERVICE_NOTICE, tutorNoticeCopy } from './service-status';

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) data.set(name, value);
  return data;
}

describe('reading a service out of a form', () => {
  it('reads every field, and the option rows by their fixed names', () => {
    const input = serviceInputFromFormData(
      form({
        subjectId: 'subject-1',
        displayName: 'Year 9 maths',
        description: 'A description.',
        yearLevelFrom: '9',
        yearLevelTo: '10',
        formatCode: 'online',
        'options.0.durationMinutes': '60',
        'options.0.price': '65',
        'options.1.durationMinutes': '90',
        'options.1.price': '90',
      }),
    );
    expect(input.displayName).toBe('Year 9 maths');
    expect(input.options.slice(0, 2)).toEqual([
      { durationMinutes: '60', price: '65' },
      { durationMinutes: '90', price: '90' },
    ]);
    // Rows the form did not send are empty, never invented.
    expect(input.options.slice(2).every((option) => option.price === '')).toBe(true);
  });

  it('never fails on a form with nothing in it', () => {
    const input = serviceInputFromFormData(new FormData());
    expect(input.subjectId).toBe('');
    expect(
      validateTutorService(input, { knownSubjectIds: [], offersOnline: true, offersInPerson: true })
        .ok,
    ).toBe(false);
  });

  it('ignores option rows beyond the ones it reads, however many a browser sends', () => {
    const input = serviceInputFromFormData(
      form({ 'options.99.durationMinutes': '60', 'options.99.price': '1' }),
    );
    expect(input.options.some((option) => option.price === '1')).toBe(false);
  });

  it('turns a stored service back into what the form shows', () => {
    expect(
      serviceInputFromRecord({
        subjectId: 'subject-1',
        displayName: 'Year 9 maths',
        description: null,
        yearLevelFrom: 9,
        yearLevelTo: null,
        formatCode: 'either',
        options: [{ durationMinutes: 60, priceAmountMinor: 6550n }],
      }),
    ).toEqual({
      subjectId: 'subject-1',
      displayName: 'Year 9 maths',
      description: '',
      yearLevelFrom: '9',
      yearLevelTo: '',
      formatCode: 'either',
      options: [{ durationMinutes: '60', price: '65.50' }],
    });
  });
});

describe('reading a profile edit out of a form', () => {
  it('treats an unticked box as off', () => {
    const input = profileInputFromFormData(form({ headline: 'Hello', offersOnline: 'on' }));
    expect(input).toMatchObject({ headline: 'Hello', offersOnline: true, offersInPerson: false });
  });
});

describe('notices', () => {
  it('has copy for every token, and nothing for one it does not know', () => {
    for (const token of Object.values(SERVICE_NOTICE)) {
      expect(tutorNoticeCopy(token)).not.toBeNull();
    }
    expect(tutorNoticeCopy(undefined)).toBeNull();
    expect(tutorNoticeCopy('<script>alert(1)</script>')).toBeNull();
    expect(tutorNoticeCopy('toString')).toBeNull();
  });
});
