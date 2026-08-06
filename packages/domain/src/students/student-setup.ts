import { domainError } from '../core/errors';
import { fail, ok, type CommandResult } from '../core/result';

/**
 * Student profile and subject-section rules. Shared by both booking paths —
 * a guardian adding a dependent student, and an independent student setting
 * up their own profile.
 */

/** New Zealand school years; the platform's first market. */
export const SCHOOL_YEAR_CODES = [
  'year_1',
  'year_2',
  'year_3',
  'year_4',
  'year_5',
  'year_6',
  'year_7',
  'year_8',
  'year_9',
  'year_10',
  'year_11',
  'year_12',
  'year_13',
] as const;

export type SchoolYearCode = (typeof SCHOOL_YEAR_CODES)[number];

export const FORMAT_PREFERENCE_CODES = ['online', 'in_person', 'either'] as const;

export type FormatPreferenceCode = (typeof FORMAT_PREFERENCE_CODES)[number];

export function schoolYearNumber(code: string): number | null {
  const index = (SCHOOL_YEAR_CODES as readonly string[]).indexOf(code);
  return index === -1 ? null : index + 1;
}

export function schoolYearLabel(code: string): string {
  const year = schoolYearNumber(code);
  return year === null ? 'Not set' : `Year ${year}`;
}

export interface StudentProfileInput {
  readonly preferredName: string;
  readonly familyName: string;
  readonly schoolYearCode: string;
  readonly schoolOrProviderName?: string | undefined;
}

export interface ValidatedStudentProfile {
  readonly preferredName: string;
  readonly familyName: string | null;
  readonly schoolYearCode: SchoolYearCode;
  readonly schoolOrProviderName: string | null;
}

const NAME_MAX = 100;

export function validateStudentProfile(
  input: StudentProfileInput,
): CommandResult<ValidatedStudentProfile> {
  const preferredName = input.preferredName.trim();
  const familyName = input.familyName.trim();
  const school = (input.schoolOrProviderName ?? '').trim();
  const issues: Record<string, string> = {};

  if (preferredName.length === 0 || preferredName.length > NAME_MAX) {
    issues['preferredName'] = 'Enter the name this student is known by.';
  }
  if (familyName.length > NAME_MAX) {
    issues['familyName'] = 'That family name is too long.';
  }
  if (!(SCHOOL_YEAR_CODES as readonly string[]).includes(input.schoolYearCode)) {
    issues['schoolYearCode'] = 'Choose the school year.';
  }

  if (Object.keys(issues).length > 0) {
    return fail(domainError('VALIDATION_FAILED', 'Student profile input is invalid.', issues));
  }

  return ok({
    preferredName,
    familyName: familyName.length === 0 ? null : familyName,
    schoolYearCode: input.schoolYearCode as SchoolYearCode,
    schoolOrProviderName: school.length === 0 ? null : school,
  });
}

export interface SubjectSectionInput {
  readonly subjectId: string;
  readonly schoolYearCode: string;
  readonly formatPreferenceCode: string;
  readonly goals?: string | undefined;
}

export interface ValidatedSubjectSection {
  readonly subjectId: string;
  readonly schoolYearCode: SchoolYearCode;
  readonly formatPreferenceCode: FormatPreferenceCode;
  readonly goals: string | null;
}

export function validateSubjectSection(
  input: SubjectSectionInput,
): CommandResult<ValidatedSubjectSection> {
  const goals = (input.goals ?? '').trim();
  const issues: Record<string, string> = {};

  if (input.subjectId.trim().length === 0) {
    issues['subjectId'] = 'Choose a subject.';
  }
  if (!(SCHOOL_YEAR_CODES as readonly string[]).includes(input.schoolYearCode)) {
    issues['schoolYearCode'] = 'Choose the school year for this subject.';
  }
  if (!(FORMAT_PREFERENCE_CODES as readonly string[]).includes(input.formatPreferenceCode)) {
    issues['formatPreferenceCode'] = 'Choose how lessons should happen.';
  }
  if (goals.length > 1000) {
    issues['goals'] = 'Please keep this under 1000 characters.';
  }

  if (Object.keys(issues).length > 0) {
    return fail(domainError('VALIDATION_FAILED', 'Subject need input is invalid.', issues));
  }

  return ok({
    subjectId: input.subjectId,
    schoolYearCode: input.schoolYearCode as SchoolYearCode,
    formatPreferenceCode: input.formatPreferenceCode as FormatPreferenceCode,
    goals: goals.length === 0 ? null : goals,
  });
}
