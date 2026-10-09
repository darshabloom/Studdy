import { describe, expect, it } from 'vitest';
import {
  APPLICATION_CHECK_CODES,
  DEFAULT_REQUIRED_APPLICATION_CHECKS,
  TUTOR_APPLICATION_STATUSES,
  applicationStatusesThatMayMoveTo,
  approvalReadiness,
  canTransitionApplication,
  isTerminalApplicationStatus,
  publicLabelForCheck,
  requiredChecksFrom,
  validateTutorApplication,
  type TutorApplicationInput,
} from './application';

const GOOD: TutorApplicationInput = {
  legalFirstName: 'Aroha',
  legalFamilyName: 'Ngata',
  preferredFirstName: 'Aroha',
  phone: '021 123 4567',
  headline: 'Patient maths tutor for years 7 to 10',
  teachingApproach:
    'I start from what the student already knows and build up, with lots of worked examples.',
  experienceSummary:
    'Five years as a secondary maths teacher, and three years tutoring privately alongside.',
  qualificationsSummary: 'BSc Mathematics, Graduate Diploma in Teaching',
  subjectIds: ['subject-maths'],
  yearLevelFrom: '7',
  yearLevelTo: '10',
  offersOnline: true,
  offersInPerson: false,
  references: [
    {
      fullName: 'Hemi Walker',
      email: 'hemi@example.test',
      relationship: 'Former head of department',
    },
    { fullName: 'Mere Cook', email: 'mere@example.test', relationship: 'Parent of a past student' },
  ],
  declarationsAccepted: true,
};

describe('the application state machine', () => {
  it('moves forward through review to a decision', () => {
    expect(canTransitionApplication('draft', 'submitted')).toBe(true);
    expect(canTransitionApplication('submitted', 'under_review')).toBe(true);
    expect(canTransitionApplication('submitted', 'approved')).toBe(true);
    expect(canTransitionApplication('under_review', 'approved')).toBe(true);
    expect(canTransitionApplication('under_review', 'rejected')).toBe(true);
    expect(canTransitionApplication('under_review', 'changes_requested')).toBe(true);
  });

  it('lets the applicant resubmit after changes are requested, and nothing else forwards', () => {
    expect(canTransitionApplication('changes_requested', 'submitted')).toBe(true);
    expect(canTransitionApplication('changes_requested', 'approved')).toBe(false);
  });

  it('cannot be approved without having been submitted', () => {
    expect(canTransitionApplication('draft', 'approved')).toBe(false);
    expect(canTransitionApplication('draft', 'under_review')).toBe(false);
  });

  it('lets the applicant withdraw from any live state', () => {
    for (const from of ['draft', 'submitted', 'under_review', 'changes_requested'] as const) {
      expect(canTransitionApplication(from, 'withdrawn')).toBe(true);
    }
  });

  it('never re-opens a decided or withdrawn application', () => {
    for (const terminal of ['approved', 'rejected', 'withdrawn'] as const) {
      expect(isTerminalApplicationStatus(terminal)).toBe(true);
      for (const to of TUTOR_APPLICATION_STATUSES) {
        expect(canTransitionApplication(terminal, to)).toBe(false);
      }
    }
  });

  it('derives the guard set for an UPDATE from the map', () => {
    expect(applicationStatusesThatMayMoveTo('approved')).toEqual(['submitted', 'under_review']);
    expect(applicationStatusesThatMayMoveTo('submitted')).toEqual(['draft', 'changes_requested']);
  });
});

describe('approvalReadiness', () => {
  const verified = (code: string) => ({ code, status: 'verified' });

  it('is ready when every required check is verified', () => {
    expect(approvalReadiness(APPLICATION_CHECK_CODES.map(verified))).toEqual({ ready: true });
  });

  it('is not ready while any required check is missing or pending', () => {
    const result = approvalReadiness([
      verified('identity'),
      verified('safeguarding'),
      { code: 'references', status: 'pending' },
    ]);
    expect(result).toEqual({ ready: false, missing: ['references', 'interview'], failed: [] });
  });

  /** A failed check is a finding against the applicant, not merely "not yet". */
  it('names a failed check separately, and it blocks', () => {
    const result = approvalReadiness([
      verified('identity'),
      { code: 'safeguarding', status: 'failed' },
      verified('references'),
      verified('interview'),
    ]);
    expect(result).toEqual({ ready: false, missing: [], failed: ['safeguarding'] });
  });

  it('does not count an unrecorded check as verified', () => {
    expect(approvalReadiness([])).toMatchObject({ ready: false });
  });

  it('ignores a check that is not required', () => {
    expect(
      approvalReadiness(
        [verified('identity'), verified('safeguarding')],
        ['identity', 'safeguarding'],
      ),
    ).toEqual({ ready: true });
  });

  it('defaults to requiring all four checks', () => {
    expect([...DEFAULT_REQUIRED_APPLICATION_CHECKS]).toEqual([
      'identity',
      'safeguarding',
      'references',
      'interview',
    ]);
  });
});

describe('requiredChecksFrom — the rule, failing closed', () => {
  it('reads a valid rule', () => {
    expect(requiredChecksFrom(['identity', 'safeguarding'])).toEqual(['identity', 'safeguarding']);
  });

  it('removes duplicates', () => {
    expect(requiredChecksFrom(['identity', 'identity', 'safeguarding'])).toEqual([
      'identity',
      'safeguarding',
    ]);
  });

  /** An empty list would mean "approve anyone" and must never come from a typo. */
  it('falls back to the full default for an empty, malformed or unknown rule', () => {
    for (const bad of [[], null, undefined, 'identity', 42, { a: 1 }, ['identity', 'made_up']]) {
      expect(requiredChecksFrom(bad)).toEqual(DEFAULT_REQUIRED_APPLICATION_CHECKS);
    }
  });
});

describe('publicLabelForCheck', () => {
  it('gives identity, references and interview a public label', () => {
    expect(publicLabelForCheck('identity')).toBe('identity_verified');
    expect(publicLabelForCheck('references')).toBe('references_completed');
    expect(publicLabelForCheck('interview')).toBe('interviewed');
  });

  /** A label for one tutor implies its absence on others, and safeguarding is not optional. */
  it('gives safeguarding none', () => {
    expect(publicLabelForCheck('safeguarding')).toBeNull();
  });
});

describe('validateTutorApplication', () => {
  it('accepts a complete application and trims it', () => {
    const result = validateTutorApplication({ ...GOOD, preferredFirstName: '  Aroha  ' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.preferredFirstName).toBe('Aroha');
      expect(result.value.yearLevelFrom).toBe(7);
      expect(result.value.yearLevelTo).toBe(10);
      expect(result.value.references).toHaveLength(2);
    }
  });

  it('treats a blank phone and blank qualifications as absent', () => {
    const result = validateTutorApplication({ ...GOOD, phone: '  ', qualificationsSummary: '' });
    expect(result.ok && result.value.phone).toBeNull();
    expect(result.ok && result.value.qualificationsSummary).toBeNull();
  });

  const issuesFor = (patch: Partial<TutorApplicationInput>): Record<string, string> => {
    const result = validateTutorApplication({ ...GOOD, ...patch });
    if (result.ok) return {};
    return (result.error.details ?? {}) as Record<string, string>;
  };

  it('requires the names, headline and the two long answers', () => {
    expect(issuesFor({ legalFirstName: ' ' })).toHaveProperty('legalFirstName');
    expect(issuesFor({ legalFamilyName: '' })).toHaveProperty('legalFamilyName');
    expect(issuesFor({ preferredFirstName: '' })).toHaveProperty('preferredFirstName');
    expect(issuesFor({ headline: '' })).toHaveProperty('headline');
    expect(issuesFor({ headline: 'x'.repeat(141) })).toHaveProperty('headline');
    expect(issuesFor({ teachingApproach: 'too short' })).toHaveProperty('teachingApproach');
    expect(issuesFor({ experienceSummary: 'too short' })).toHaveProperty('experienceSummary');
  });

  it('rejects an implausible phone number but allows none', () => {
    expect(issuesFor({ phone: 'call me maybe' })).toHaveProperty('phone');
    expect(issuesFor({ phone: '' })).not.toHaveProperty('phone');
  });

  it('requires at least one subject, and only known ones when told which are known', () => {
    expect(issuesFor({ subjectIds: [] })).toHaveProperty('subjectIds');
    const result = validateTutorApplication(GOOD, { knownSubjectIds: ['someone-elses-subject'] });
    expect(result.ok).toBe(false);
  });

  it('requires a sensible year range', () => {
    expect(issuesFor({ yearLevelFrom: '' })).toHaveProperty('yearLevelFrom');
    expect(issuesFor({ yearLevelTo: '14' })).toHaveProperty('yearLevelTo');
    expect(issuesFor({ yearLevelFrom: '0' })).toHaveProperty('yearLevelFrom');
    expect(issuesFor({ yearLevelFrom: '9', yearLevelTo: '7' })).toHaveProperty('yearLevelTo');
    expect(issuesFor({ yearLevelFrom: '7', yearLevelTo: '7' })).toEqual({});
  });

  it('requires at least one format', () => {
    expect(issuesFor({ offersOnline: false, offersInPerson: false })).toHaveProperty('formats');
    expect(issuesFor({ offersOnline: false, offersInPerson: true })).toEqual({});
  });

  it('requires two to three referees, each complete and distinct', () => {
    expect(issuesFor({ references: [GOOD.references[0]!] })).toHaveProperty('references');
    expect(
      issuesFor({
        references: [
          ...GOOD.references,
          { fullName: 'A', email: 'a@example.test', relationship: 'x' },
          { fullName: 'B', email: 'b@example.test', relationship: 'x' },
        ],
      }),
    ).toHaveProperty('references');
    expect(
      issuesFor({
        references: [GOOD.references[0]!, { ...GOOD.references[1]!, email: 'not-an-email' }],
      }),
    ).toHaveProperty(['references.1.email']);
    expect(
      issuesFor({
        references: [GOOD.references[0]!, { ...GOOD.references[1]!, email: 'HEMI@example.test' }],
      }),
    ).toHaveProperty('references');
  });

  it('ignores a completely blank third referee', () => {
    const result = validateTutorApplication({
      ...GOOD,
      references: [...GOOD.references, { fullName: '', email: '', relationship: '' }],
    });
    expect(result.ok).toBe(true);
  });

  /** Nothing is submitted on the strength of a ticked-by-default box. */
  it('requires the declarations to be accepted', () => {
    expect(issuesFor({ declarationsAccepted: false })).toHaveProperty('declarationsAccepted');
  });

  it('reports every problem at once, not one at a time', () => {
    const issues = issuesFor({
      legalFirstName: '',
      headline: '',
      subjectIds: [],
      declarationsAccepted: false,
    });
    expect(Object.keys(issues).sort()).toEqual([
      'declarationsAccepted',
      'headline',
      'legalFirstName',
      'subjectIds',
    ]);
  });
});
