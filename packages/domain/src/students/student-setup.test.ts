import { describe, expect, it } from 'vitest';
import {
  schoolYearLabel,
  schoolYearNumber,
  validateStudentProfile,
  validateSubjectSection,
} from './student-setup';

describe('validateStudentProfile', () => {
  const base = { preferredName: 'Ari', familyName: 'Ngata', schoolYearCode: 'year_9' };

  it('accepts a valid profile and trims names', () => {
    const result = validateStudentProfile({ ...base, preferredName: '  Ari  ' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.preferredName).toBe('Ari');
      expect(result.value.schoolYearCode).toBe('year_9');
    }
  });

  it('requires a preferred name and a valid school year', () => {
    expect(validateStudentProfile({ ...base, preferredName: '   ' }).ok).toBe(false);
    expect(validateStudentProfile({ ...base, schoolYearCode: 'year_99' }).ok).toBe(false);
  });

  it('treats family name and school as optional', () => {
    const result = validateStudentProfile({ ...base, familyName: '' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.familyName).toBeNull();
      expect(result.value.schoolOrProviderName).toBeNull();
    }
  });
});

describe('validateSubjectSection', () => {
  const base = {
    subjectId: '00000000-0000-4000-8000-000000000001',
    schoolYearCode: 'year_11',
    formatPreferenceCode: 'either',
  };

  it('accepts a valid subject need', () => {
    expect(validateSubjectSection(base).ok).toBe(true);
  });

  it('requires a subject, a year and a known format', () => {
    expect(validateSubjectSection({ ...base, subjectId: '' }).ok).toBe(false);
    expect(validateSubjectSection({ ...base, schoolYearCode: '' }).ok).toBe(false);
    expect(validateSubjectSection({ ...base, formatPreferenceCode: 'carrier_pigeon' }).ok).toBe(
      false,
    );
  });

  it('rejects an over-long goals field', () => {
    expect(validateSubjectSection({ ...base, goals: 'x'.repeat(1001) }).ok).toBe(false);
  });
});

describe('school year helpers', () => {
  it('maps codes to numbers and labels', () => {
    expect(schoolYearNumber('year_1')).toBe(1);
    expect(schoolYearNumber('year_13')).toBe(13);
    expect(schoolYearNumber('nonsense')).toBeNull();
    expect(schoolYearLabel('year_7')).toBe('Year 7');
    expect(schoolYearLabel('nonsense')).toBe('Not set');
  });
});
