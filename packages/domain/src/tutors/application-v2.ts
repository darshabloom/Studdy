/**
 * Approved Tutor application v2 — pure questionnaire contract.
 *
 * This module is deliberately independent of the live application persistence
 * path. The v1 form/reviewer can continue to operate while migrations and
 * audited reviewer projections are prepared. Drafts may be incomplete; only
 * final submission invokes validateApplicationV2.
 */
export const APPLICATION_V2_STEPS = [
  'about',
  'subjects',
  'teaching',
  'qualifications',
  'references',
  'declarations',
] as const;

export type ApplicationV2Step = (typeof APPLICATION_V2_STEPS)[number];

export const APPLICATION_V2_EXPERIENCE = [
  'none',
  'under_1_year',
  '1_2_years',
  '3_5_years',
  '6_10_years',
  'over_10_years',
] as const;

export const APPLICATION_V2_CURRICULA = [
  'nz_curriculum',
  'ncea',
  'cambridge',
  'ib',
  'australian',
  'university_specific',
  'other',
  'none_yet',
] as const;

export interface ApplicationV2Subject {
  readonly subjectId: string;
  readonly levels: readonly number[];
  readonly specialisations: string;
}

export interface ApplicationV2Reference {
  readonly fullName: string;
  readonly relationship: string;
  readonly organisation: string;
  readonly position: string;
  readonly email: string;
  readonly phone: string;
  readonly permissionConfirmed: boolean;
  readonly contactPreference: 'contact_now' | 'contact_me_first' | '';
  readonly category: string;
}

export interface ApplicationV2Qualification {
  readonly title: string;
  readonly institution: string;
  readonly field: string;
  readonly awardedYear: string;
}

/** The autosaved working copy: not a verified identity or a public tutor profile. */
export interface TutorApplicationV2Draft {
  readonly schemaVersion: 2;
  readonly about: {
    readonly legalFirstName: string;
    readonly legalFamilyName: string;
    readonly preferredFirstName: string;
    readonly dateOfBirth: string;
    readonly mobile: string;
    readonly location: string;
    readonly currentActivities: readonly string[];
  };
  readonly subjects: {
    readonly selections: readonly ApplicationV2Subject[];
    readonly suggestedSubjects: readonly string[];
    readonly offersOnline: boolean;
    readonly offersInPerson: boolean;
    readonly curricula: readonly string[];
  };
  readonly teaching: {
    readonly experience: string;
    readonly settings: readonly string[];
    readonly approach: string;
    readonly studentGroups: readonly string[];
    readonly learningNeeds: readonly string[];
    readonly example: string;
  };
  readonly qualifications: {
    readonly highestEducation: string;
    readonly currentlyStudying: 'yes' | 'no' | '';
    readonly currentQualification: string;
    readonly currentInstitution: string;
    readonly expectedCompletionYear: string;
    readonly relevantQualifications: readonly ApplicationV2Qualification[];
    readonly noRelevantQualifications: boolean;
    readonly evidenceIntention: 'will_provide_later' | 'available_for_verification' | 'none_to_provide' | '';
    readonly academicResults: string;
    readonly professionalCredentials: string;
    readonly training: readonly string[];
  };
  readonly references: readonly ApplicationV2Reference[];
  readonly declarations: {
    readonly accuracyAccepted: boolean;
    readonly safeguardingAccepted: boolean;
    readonly codeOfConductAccepted: boolean;
    readonly tutorAgreementAccepted: boolean;
    readonly privacyNoticeAccepted: boolean;
    readonly interviewAccepted: boolean;
  };
}

export function emptyApplicationV2(): TutorApplicationV2Draft {
  return {
    schemaVersion: 2,
    about: {
      legalFirstName: '',
      legalFamilyName: '',
      preferredFirstName: '',
      dateOfBirth: '',
      mobile: '',
      location: '',
      currentActivities: [],
    },
    subjects: {
      selections: [],
      suggestedSubjects: [],
      offersOnline: false,
      offersInPerson: false,
      curricula: [],
    },
    teaching: {
      experience: '',
      settings: [],
      approach: '',
      studentGroups: [],
      learningNeeds: [],
      example: '',
    },
    qualifications: {
      highestEducation: '',
      currentlyStudying: '',
      currentQualification: '',
      currentInstitution: '',
      expectedCompletionYear: '',
      relevantQualifications: [],
      noRelevantQualifications: false,
      evidenceIntention: '',
      academicResults: '',
      professionalCredentials: '',
      training: [],
    },
    references: [],
    declarations: {
      accuracyAccepted: false,
      safeguardingAccepted: false,
      codeOfConductAccepted: false,
      tutorAgreementAccepted: false,
      privacyNoticeAccepted: false,
      interviewAccepted: false,
    },
  };
}

/** Deterministic UTC date-only age calculation, independent of the browser locale. */
export function applicantAge(dateOfBirth: string, today: string): number | null {
  const parse = (value: string): Date | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(value + 'T00:00:00.000Z');
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
      ? null
      : date;
  };
  const birth = parse(dateOfBirth);
  const current = parse(today);
  if (birth === null || current === null || birth.getTime() > current.getTime()) return null;
  let years = current.getUTCFullYear() - birth.getUTCFullYear();
  const birthdayPassed =
    current.getUTCMonth() > birth.getUTCMonth() ||
    (current.getUTCMonth() === birth.getUTCMonth() &&
      current.getUTCDate() >= birth.getUTCDate());
  if (!birthdayPassed) years--;
  return years;
}

export function applicantIsMinor(dateOfBirth: string, today: string): boolean {
  const age = applicantAge(dateOfBirth, today);
  return age !== null && age >= 16 && age < 18;
}

export type ApplicationV2Issues = Record<string, string>;
export interface ApplicationV2ValidationOptions {
  readonly today: string;
  readonly knownSubjectIds: readonly string[];
}

/**
 * Strict final-submission validation. Reviewers must still perform independent
 * safeguarding, identity, interview and reference checks before approval.
 * The form's checkboxes are acknowledgements, never proof of those checks.
 */
export function validateApplicationV2(
  input: TutorApplicationV2Draft,
  options: ApplicationV2ValidationOptions,
): { readonly valid: boolean; readonly issues: ApplicationV2Issues } {
  const issues: ApplicationV2Issues = {};
  const requireText = (path: string, value: string, max = 200): void => {
    if (value.trim().length === 0 || value.trim().length > max) {
      issues[path] = 'Complete this field.';
    }
  };
  const a = input.about;
  requireText('about.legalFirstName', a.legalFirstName, 100);
  requireText('about.legalFamilyName', a.legalFamilyName, 100);
  requireText('about.preferredFirstName', a.preferredFirstName, 100);
  requireText('about.location', a.location, 200);
  if (!/^\+?[0-9 ()-]{6,24}$/.test(a.mobile.trim())) {
    issues['about.mobile'] = 'Enter a mobile number where Studdy can reach you.';
  }
  const age = applicantAge(a.dateOfBirth, options.today);
  if (age === null || age < 16 || age > 120) {
    issues['about.dateOfBirth'] = 'Enter a valid date of birth. Tutors must be at least 16.';
  }

  const s = input.subjects;
  if (s.selections.length === 0) {
    issues['subjects.selections'] = 'Select at least one approved catalogue subject.';
  }
  const seenSubjects = new Set<string>();
  s.selections.forEach((entry, index) => {
    if (!options.knownSubjectIds.includes(entry.subjectId) || seenSubjects.has(entry.subjectId)) {
      issues[`subjects.selections.${index}.subjectId`] = 'Select a distinct catalogue subject.';
    }
    seenSubjects.add(entry.subjectId);
    if (
      entry.levels.length === 0 ||
      new Set(entry.levels).size !== entry.levels.length ||
      entry.levels.some((level) => !Number.isInteger(level) || level < 0 || level > 18)
    ) {
      issues[`subjects.selections.${index}.levels`] = 'Choose valid education levels for this subject.';
    }
    if (entry.specialisations.length > 2000) {
      issues[`subjects.selections.${index}.specialisations`] = 'Keep specialisations under 2000 characters.';
    }
  });
  if (!s.offersOnline && !s.offersInPerson) {
    issues['subjects.formats'] = 'Choose online, in person, or both.';
  }
  if (
    s.curricula.length === 0 ||
    s.curricula.some((value) => !(APPLICATION_V2_CURRICULA as readonly string[]).includes(value)) ||
    new Set(s.curricula).size !== s.curricula.length ||
    (s.curricula.includes('none_yet') && s.curricula.length > 1)
  ) {
    issues['subjects.curricula'] = 'Choose valid curriculum options, or None yet.';
  }

  const t = input.teaching;
  if (!(APPLICATION_V2_EXPERIENCE as readonly string[]).includes(t.experience)) {
    issues['teaching.experience'] = 'Choose your teaching experience.';
  }
  for (const [name, values, none] of [
    ['settings', t.settings, 'none_yet'],
    ['studentGroups', t.studentGroups, 'no_previous_students'],
  ] as const) {
    if (values.length === 0 || (values.includes(none) && values.length > 1)) {
      issues[`teaching.${name}`] = 'Choose at least one option, or None.';
    }
  }
  if (t.approach.trim().length < 40 || t.approach.trim().length > 2000) {
    issues['teaching.approach'] = 'Describe your approach in 40–2000 characters.';
  }
  if (t.example.length > 2000) issues['teaching.example'] = 'Keep your example under 2000 characters.';

  const q = input.qualifications;
  requireText('qualifications.highestEducation', q.highestEducation, 100);
  if (q.currentlyStudying !== 'yes' && q.currentlyStudying !== 'no') {
    issues['qualifications.currentlyStudying'] = 'Choose Yes or No.';
  }
  if (q.currentlyStudying === 'yes') {
    requireText('qualifications.currentQualification', q.currentQualification);
    requireText('qualifications.currentInstitution', q.currentInstitution);
    if (!/^\d{4}$/.test(q.expectedCompletionYear)) {
      issues['qualifications.expectedCompletionYear'] = 'Enter the expected completion year.';
    }
  }
  if (!q.noRelevantQualifications && q.relevantQualifications.length === 0) {
    issues['qualifications.relevantQualifications'] = 'Add a qualification or choose None yet.';
  }
  if (q.noRelevantQualifications && q.relevantQualifications.length > 0) {
    issues['qualifications.relevantQualifications'] = 'Choose qualifications or None yet.';
  }
  q.relevantQualifications.forEach((item, index) => {
    requireText(`qualifications.relevantQualifications.${index}.title`, item.title);
    requireText(`qualifications.relevantQualifications.${index}.institution`, item.institution);
    requireText(`qualifications.relevantQualifications.${index}.field`, item.field);
    if (!/^\d{4}$/.test(item.awardedYear)) {
      issues[`qualifications.relevantQualifications.${index}.awardedYear`] = 'Enter the award year.';
    }
  });
  if (!['will_provide_later', 'available_for_verification', 'none_to_provide'].includes(q.evidenceIntention)) {
    issues['qualifications.evidenceIntention'] = 'Choose when you can provide evidence.';
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phonePattern = /^\+?[0-9 ()-]{6,24}$/;
  const actualReferences = input.references.filter((ref) =>
    [ref.fullName, ref.email, ref.phone, ref.relationship, ref.organisation, ref.position].some(
      (value) => value.trim() !== '',
    ),
  );
  if (actualReferences.length === 0) {
    issues['references'] = 'Provide at least one independent referee.';
  }
  actualReferences.forEach((ref, index) => {
    requireText(`references.${index}.fullName`, ref.fullName, 100);
    requireText(`references.${index}.relationship`, ref.relationship, 100);
    requireText(`references.${index}.organisation`, ref.organisation, 200);
    requireText(`references.${index}.position`, ref.position, 200);
    const email = ref.email.trim();
    const phone = ref.phone.trim();
    if ((email === '' && phone === '') || (email !== '' && !emailPattern.test(email)) ||
      (phone !== '' && !phonePattern.test(phone))) {
      issues[`references.${index}.contact`] = 'Provide a valid email address, telephone number or both.';
    }
    if (!ref.permissionConfirmed) {
      issues[`references.${index}.permissionConfirmed`] = 'Confirm permission to contact this referee.';
    }
    if (!['contact_now', 'contact_me_first'].includes(ref.contactPreference)) {
      issues[`references.${index}.contactPreference`] = 'Choose when Studdy may contact this referee.';
    }
  });
  for (const [key, accepted] of Object.entries(input.declarations)) {
    if (!accepted) issues[`declarations.${key}`] = 'This acknowledgement is required.';
  }
  return { valid: Object.keys(issues).length === 0, issues };
}
