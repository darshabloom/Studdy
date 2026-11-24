import { describe, expect, it } from 'vitest';
import { emptyApplicationV2, type TutorApplicationV2Draft } from './application-v2';
import {
  applicationV2SubmissionReadiness,
  prepareApplicationV2Submission,
  type ApplicationV2SubmissionPolicy,
} from './application-v2-submission';

const empty = emptyApplicationV2();
const complete: TutorApplicationV2Draft = {
  ...empty,
  about: {
    ...empty.about,
    legalFirstName: 'Aroha',
    legalFamilyName: 'Ngata',
    preferredFirstName: 'Aroha',
    dateOfBirth: '2000-08-10',
    mobile: '+64 21 123 4567',
    location: 'Auckland',
  },
  subjects: {
    ...empty.subjects,
    selections: [{ subjectId: 'math', levels: [8, 12], specialisations: '' }],
    offersOnline: true,
    curricula: ['ncea'],
  },
  teaching: {
    ...empty.teaching,
    experience: 'none',
    settings: ['none_yet'],
    approach: 'I teach at the learner’s pace and provide examples they can practise.',
    studentGroups: ['no_previous_students'],
  },
  qualifications: {
    ...empty.qualifications,
    highestEducation: 'ncea_3',
    currentlyStudying: 'no',
    noRelevantQualifications: true,
    evidenceIntention: 'will_provide_later',
  },
  references: [{
    fullName: 'Taylor Example',
    relationship: 'Teacher',
    organisation: 'Example School',
    position: 'Head of Maths',
    category: 'teacher',
    email: '',
    phone: '+64 21 123 1234',
    permissionConfirmed: true,
    contactPreference: 'contact_me_first',
  }],
  declarations: {
    accuracyAccepted: true,
    safeguardingAccepted: true,
    codeOfConductAccepted: true,
    tutorAgreementAccepted: true,
    privacyNoticeAccepted: true,
    interviewAccepted: true,
  },
};

const policy: ApplicationV2SubmissionPolicy = {
  today: '2026-11-24',
  knownSubjectIds: ['math'],
  tutorAgreementVersion: 'tutor-agreement-2026-11',
  codeOfConductVersion: 'code-of-conduct-2026-11',
  privacyNoticeVersion: 'privacy-notice-2026-11',
  guardianConsentVerified: false,
  guardianConsentReference: null,
};

describe('Tutor Application v2 submission policy', () => {
  it('prepares a separate snapshot for an adult using approved subject levels and a phone-only referee', () => {
    const result = prepareApplicationV2Submission(complete, policy);
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.snapshot.documentVersions.tutorAgreement).toBe('tutor-agreement-2026-11');
    expect(result.snapshot.answers.references[0]?.email).toBe('');
    expect(result.snapshot.answers.subjects.selections[0]?.levels).toEqual([8, 12]);
    expect(result.snapshot.guardianConsentReference).toBeNull();
  });

  it('does not confuse an applicant acknowledgement with legal guardian consent', () => {
    const minor = {
      ...complete,
      about: { ...complete.about, dateOfBirth: '2009-08-10' },
    };
    const result = applicationV2SubmissionReadiness(minor, policy);
    expect(result.requiresGuardianConsent).toBe(true);
    expect(result.ready).toBe(false);
    expect(result.issues).toHaveProperty('about.guardianConsent');
  });

  it('requires verified guardian consent reference to submit for an applicant aged 16–17', () => {
    const minor = {
      ...complete,
      about: { ...complete.about, dateOfBirth: '2009-08-10' },
    };
    expect(prepareApplicationV2Submission(minor, {
      ...policy,
      guardianConsentVerified: true,
      guardianConsentReference: 'CONSENT-TEST-001',
    }).status).toBe('ready');
  });

  it('fails closed when any legal document version is missing', () => {
    for (const key of [
      'tutorAgreementVersion',
      'codeOfConductVersion',
      'privacyNoticeVersion',
    ] as const) {
      const result = applicationV2SubmissionReadiness(complete, { ...policy, [key]: '' });
      expect(result.ready).toBe(false);
      expect(result.issues).toHaveProperty('declarations.' + key);
    }
  });

  it('rejects incomplete drafts and never prepares a submission snapshot', () => {
    const result = prepareApplicationV2Submission(empty, policy);
    expect(result.status).toBe('invalid');
  });

  it('copies the draft so edits after submission preparation cannot rewrite the snapshot', () => {
    const result = prepareApplicationV2Submission(complete, policy);
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.snapshot.answers).not.toBe(complete);
    expect(result.snapshot.answers.about).not.toBe(complete.about);
    expect(result.snapshot.answers.references).not.toBe(complete.references);
    expect(result.snapshot.answers.about.legalFirstName).toBe('Aroha');
  });
});
