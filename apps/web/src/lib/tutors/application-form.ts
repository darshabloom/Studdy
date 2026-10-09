import { EMPTY_TUTOR_APPLICATION, type TutorApplicationInput } from '@studdy/domain/tutors';

/**
 * Read an application out of a submitted form. PURE, so it is testable without a
 * browser, and the single place the form's field names are interpreted.
 *
 * It never fails: an absent or odd field becomes an empty one, and the domain's
 * validator decides what is acceptable. A draft is saved from this unvalidated,
 * deliberately, so a half-written application is never lost.
 */

const REFERENCE_SLOTS = 3;

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

function checked(formData: FormData, name: string): boolean {
  return formData.get(name) === 'on';
}

export function applicationInputFromFormData(formData: FormData): TutorApplicationInput {
  const references = Array.from({ length: REFERENCE_SLOTS }, (_, index) => ({
    fullName: text(formData, `references.${String(index)}.fullName`),
    email: text(formData, `references.${String(index)}.email`),
    relationship: text(formData, `references.${String(index)}.relationship`),
  }));

  return {
    ...EMPTY_TUTOR_APPLICATION,
    legalFirstName: text(formData, 'legalFirstName'),
    legalFamilyName: text(formData, 'legalFamilyName'),
    preferredFirstName: text(formData, 'preferredFirstName'),
    phone: text(formData, 'phone'),
    headline: text(formData, 'headline'),
    teachingApproach: text(formData, 'teachingApproach'),
    experienceSummary: text(formData, 'experienceSummary'),
    qualificationsSummary: text(formData, 'qualificationsSummary'),
    subjectIds: formData
      .getAll('subjectId')
      .filter((value): value is string => typeof value === 'string'),
    yearLevelFrom: text(formData, 'yearLevelFrom'),
    yearLevelTo: text(formData, 'yearLevelTo'),
    offersOnline: checked(formData, 'offersOnline'),
    offersInPerson: checked(formData, 'offersInPerson'),
    references,
    declarationsAccepted: checked(formData, 'declarationsAccepted'),
  };
}
