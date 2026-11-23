import { describe, expect, it } from 'vitest';
import {
  applicantAge,
  applicantIsMinor,
  emptyApplicationV2,
  validateApplicationV2,
  type TutorApplicationV2Draft,
} from './application-v2';

const base = emptyApplicationV2();

const complete: TutorApplicationV2Draft = {
  ...base,
  about: {
    ...base.about,
    legalFirstName: 'Aroha',
    legalFamilyName: 'Ngata',
    preferredFirstName: 'Aroha',
    dateOfBirth: '2008-05-19',
    mobile: '+64 21 123 4567',
    location: 'Auckland',
  },
  subjects: {
    selections: [
      { subjectId: 'mathematics', levels: [7, 8, 9, 10], specialisations: 'Algebra' },
      { subjectId: 'physics', levels: [11, 12, 13], specialisations: '' },
    ],
    suggestedSubjects: [],
    offersOnline: true,
    offersInPerson: false,
    curricula: ['ncea', 'cambridge'],
  },
  teaching: {
    ...base.teaching,
    experience: 'none',
    settings: ['none_yet'],
    approach: 'I explain each step patiently, with real examples and practice.',
    studentGroups: ['no_previous_students'],
  },
  qualifications: {
    ...base.qualifications,
    highestEducation: 'ncea_3',
    currentlyStudying: 'no',
    noRelevantQualifications: true,
    evidenceIntention: 'will_provide_later',
  },
  references: [
    {
      fullName: 'Hemi Walker',
      relationship: 'Former teacher',
      category: 'teacher',
      organisation: 'School',
      position: 'Teacher',
      email: '',
      phone: '021 234 5678',
      permissionConfirmed: true,
      contactPreference: 'contact_me_first',
    },
  ],
  declarations: {
    accuracyAccepted: true,
    safeguardingAccepted: true,
    codeOfConductAccepted: true,
    tutorAgreementAccepted: true,
    privacyNoticeAccepted: true,
    interviewAccepted: true,
  },
};

const validate = (draft: TutorApplicationV2Draft) =>
  validateApplicationV2(draft, {
    today: '2026-11-24',
    knownSubjectIds: ['mathematics', 'physics'],
  });

describe('application v2 foundation', () => {
  it('accepts the product-approved options, including a first-time tutor with one phone-only referee', () => {
    expect(validate(complete)).toEqual({ valid: true, issues: {} });
  });

  it('supports independent year levels for each subject', () => {
    expect(complete.subjects.selections[0]?.levels).toEqual([7, 8, 9, 10]);
    expect(complete.subjects.selections[1]?.levels).toEqual([11, 12, 13]);
    const invalid = {
      ...complete,
      subjects: {
        ...complete.subjects,
        selections: [{ subjectId: 'mathematics', levels: [19], specialisations: '' }],
      },
    };
    expect(validate(invalid).issues).toHaveProperty('subjects.selections.0.levels');
  });

  it('prevents a suggestion becoming an approved subject without catalogue review', () => {
    const draft = {
      ...complete,
      subjects: {
        ...complete.subjects,
        selections: [{ subjectId: 'suggested-not-approved', levels: [8], specialisations: '' }],
      },
    };
    expect(validate(draft).issues).toHaveProperty('subjects.selections.0.subjectId');
  });

  it('validates date-only DOBs, under-16 boundaries and minor status', () => {
    expect(applicantAge('2008-11-25', '2026-11-24')).toBe(17);
    expect(applicantIsMinor('2008-11-25', '2026-11-24')).toBe(true);
    expect(applicantIsMinor('2008-11-24', '2026-11-24')).toBe(false);
    expect(applicantAge('2010-02-29', '2026-11-24')).toBeNull();
    expect(applicantAge('2030-01-01', '2026-11-24')).toBeNull();
    expect(
      validate({
        ...complete,
        about: { ...complete.about, dateOfBirth: '2011-01-01' },
      }).issues,
    ).toHaveProperty('about.dateOfBirth');
  });

  it('accepts email-only referees with explicit permission', () => {
    const draft = {
      ...complete,
      references: [{ ...complete.references[0]!, email: 'hemi@example.test', phone: '' }],
    };
    expect(validate(draft).valid).toBe(true);
  });

  it('requires at least one contact method, permission and timing', () => {
    const draft = {
      ...complete,
      references: [{
        ...complete.references[0]!,
        email: '',
        phone: '',
        permissionConfirmed: false,
        contactPreference: '' as const,
      }],
    };
    const result = validate(draft);
    expect(result.issues).toHaveProperty('references.0.contact');
    expect(result.issues).toHaveProperty('references.0.permissionConfirmed');
    expect(result.issues).toHaveProperty('references.0.contactPreference');
  });

  it('requires all independent declarations rather than one combined checkbox', () => {
    const draft = {
      ...complete,
      declarations: { ...complete.declarations, safeguardingAccepted: false },
    };
    expect(validate(draft).issues).toHaveProperty('declarations.safeguardingAccepted');
  });

  it('requires mutually exclusive None yet categories and at least one approved curriculum choice', () => {
    const draft = {
      ...complete,
      subjects: { ...complete.subjects, curricula: ['none_yet', 'ncea'] },
      teaching: { ...complete.teaching, settings: ['none_yet', 'private_tutoring'] },
    };
    const issues = validate(draft).issues;
    expect(issues).toHaveProperty('subjects.curricula');
    expect(issues).toHaveProperty('teaching.settings');
  });

  it('allows incomplete drafts to exist, but refuses their final submission', () => {
    const draft = emptyApplicationV2();
    expect(draft.schemaVersion).toBe(2);
    expect(validate(draft).valid).toBe(false);
  });
});
