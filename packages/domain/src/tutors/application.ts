import { domainError } from '../core/errors';
import { fail, ok, type CommandResult } from '../core/result';

/**
 * TUTOR APPLICATION — becoming a Studdy tutor.
 *
 * AN APPLICATION IS A WORKFLOW RECORD, NOT A PROFILE. The planning pack is firm
 * that the application stays separate from the operational Tutor Profile
 * (database spec §6.1): an applicant has no public presence, cannot be booked
 * and holds no tutor workspace until a person decides, in one controlled
 * transaction, to create them one. Nothing here can make anyone visible.
 *
 * WHAT STUDDY DECIDES FROM, AND WHAT IT WILL NOT COLLECT. The application asks
 * for what a reviewer needs to make a safe decision — who the person is, what
 * they teach and at what level, their experience and qualifications, referees
 * and the declarations. It deliberately does NOT collect identity documents,
 * date of birth or police-vetting evidence: those are checked by a person
 * outside the form and recorded as a check outcome, so Studdy never holds the
 * documents themselves. Data it never asked for cannot leak.
 *
 * Pure: no clock, no database.
 */

// ---------------------------------------------------------------------------
// Status machine
// ---------------------------------------------------------------------------

/**
 * The application's own states. A deliberate SUBSET of the pack's longer list
 * (doc 09 §38): conditional approval is not part of this slice, and nothing
 * here is added without something that can drive it.
 *
 *     draft → submitted → under_review → approved
 *                              ↓  ↑           (terminal)
 *                    changes_requested        rejected (terminal)
 *
 * `withdrawn` is the applicant's own exit from any live state.
 */
export const TUTOR_APPLICATION_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'changes_requested',
  'approved',
  'rejected',
  'withdrawn',
] as const;

export type TutorApplicationStatus = (typeof TUTOR_APPLICATION_STATUSES)[number];

const APPLICATION_TRANSITIONS: Readonly<
  Record<TutorApplicationStatus, readonly TutorApplicationStatus[]>
> = {
  draft: ['submitted', 'withdrawn'],
  submitted: ['under_review', 'changes_requested', 'approved', 'rejected', 'withdrawn'],
  under_review: ['changes_requested', 'approved', 'rejected', 'withdrawn'],
  /** The applicant edits and resubmits, which creates a new revision. */
  changes_requested: ['submitted', 'withdrawn'],
  approved: [],
  rejected: [],
  withdrawn: [],
};

export function canTransitionApplication(
  from: TutorApplicationStatus,
  to: TutorApplicationStatus,
): boolean {
  return APPLICATION_TRANSITIONS[from].includes(to);
}

export function isTerminalApplicationStatus(status: TutorApplicationStatus): boolean {
  return APPLICATION_TRANSITIONS[status].length === 0;
}

/** Statuses in which the applicant may still change what they have written. */
export const EDITABLE_APPLICATION_STATUSES: readonly TutorApplicationStatus[] = [
  'draft',
  'changes_requested',
];

/** Statuses a reviewer may decide from. */
export const DECIDABLE_APPLICATION_STATUSES: readonly TutorApplicationStatus[] = [
  'submitted',
  'under_review',
];

/** What a guarded `UPDATE ... WHERE status_code IN (...)` may move FROM, for a target. */
export function applicationStatusesThatMayMoveTo(
  target: TutorApplicationStatus,
): readonly TutorApplicationStatus[] {
  return TUTOR_APPLICATION_STATUSES.filter((from) => canTransitionApplication(from, target));
}

// ---------------------------------------------------------------------------
// Verification checks
// ---------------------------------------------------------------------------

/**
 * The checks a person performs BEFORE approving — each recorded on its own, never
 * as one generic "verified" flag (database spec §6.4: one boolean is prohibited).
 *
 * Done outside the form and recorded here as an outcome, so the evidence stays
 * with whoever checked it and Studdy holds the result, not the documents.
 */
export const APPLICATION_CHECK_CODES = [
  /** Who they say they are. */
  'identity',
  /** The safeguarding requirements for working with children. */
  'safeguarding',
  /** Referees contacted and satisfactory. */
  'references',
  /** Studdy has spoken with them. */
  'interview',
] as const;

export type ApplicationCheckCode = (typeof APPLICATION_CHECK_CODES)[number];

export function isApplicationCheckCode(value: string): value is ApplicationCheckCode {
  return (APPLICATION_CHECK_CODES as readonly string[]).includes(value);
}

export const APPLICATION_CHECK_STATUSES = ['pending', 'verified', 'failed'] as const;

export type ApplicationCheckStatus = (typeof APPLICATION_CHECK_STATUSES)[number];

/**
 * WHICH CHECKS MUST BE VERIFIED BEFORE APPROVAL — the default, and a rule.
 *
 * Every one of the four, because the pack says identity, required safeguarding
 * checks and serious reference concerns must never be deferred, and an interview
 * is part of the application it describes. It is carried as a versioned rule
 * (`tutors.required_application_checks`) rather than hard-coded, so the owner can
 * change what approval demands without a release — but this default is the
 * cautious one, and a missing rule falls back to it, never to "nothing".
 */
export const DEFAULT_REQUIRED_APPLICATION_CHECKS: readonly ApplicationCheckCode[] = [
  'identity',
  'safeguarding',
  'references',
  'interview',
];

export const TUTOR_APPLICATION_RULE_KEYS = {
  requiredChecks: 'tutors.required_application_checks',
} as const;

/**
 * Read a rule value as a list of check codes, FAILING CLOSED.
 *
 * Anything that is not an array of known codes — a malformed rule, an empty list
 * written by mistake — falls back to the full default. An empty list would mean
 * "approve anyone", and that must be a deliberate, reviewed rule change, never
 * the result of a typo.
 */
export function requiredChecksFrom(value: unknown): readonly ApplicationCheckCode[] {
  if (!Array.isArray(value) || value.length === 0) return DEFAULT_REQUIRED_APPLICATION_CHECKS;
  const codes = value.filter((entry): entry is ApplicationCheckCode =>
    typeof entry === 'string' ? isApplicationCheckCode(entry) : false,
  );
  // One unrecognised entry means the rule is not what it was meant to be.
  return codes.length === value.length ? [...new Set(codes)] : DEFAULT_REQUIRED_APPLICATION_CHECKS;
}

export interface RecordedCheck {
  readonly code: string;
  readonly status: string;
}

export type ApprovalReadiness =
  | { readonly ready: true }
  | {
      readonly ready: false;
      /** Required checks not yet verified. */
      readonly missing: readonly ApplicationCheckCode[];
      /** Required checks that failed. A failed check is not "not yet": it blocks. */
      readonly failed: readonly ApplicationCheckCode[];
    };

/**
 * May this applicant be approved? ONE FUNCTION answers, so the review screen's
 * button and the approval transaction cannot disagree.
 *
 * Only `verified` counts. `pending` is not done yet, and `failed` is a positive
 * finding against the applicant — approval is refused for it, and the reviewer is
 * told which, rather than treating it as merely incomplete.
 */
export function approvalReadiness(
  checks: readonly RecordedCheck[],
  required: readonly ApplicationCheckCode[] = DEFAULT_REQUIRED_APPLICATION_CHECKS,
): ApprovalReadiness {
  const statusOf = (code: ApplicationCheckCode): string | undefined =>
    checks.find((check) => check.code === code)?.status;

  const failed = required.filter((code) => statusOf(code) === 'failed');
  const missing = required.filter(
    (code) => statusOf(code) !== 'verified' && !failed.includes(code),
  );
  return failed.length === 0 && missing.length === 0
    ? { ready: true }
    : { ready: false, missing, failed };
}

/**
 * The PUBLIC label a verified check earns on a tutor's profile — what a family
 * may be told, and nothing more (database spec §6.4: "Identity verified", not a
 * document). Safeguarding earns none: it is a condition of working with children,
 * not a selling point, and a label implies the others lack it.
 */
export function publicLabelForCheck(code: ApplicationCheckCode): string | null {
  switch (code) {
    case 'identity':
      return 'identity_verified';
    case 'references':
      return 'references_completed';
    case 'interview':
      return 'interviewed';
    case 'safeguarding':
      return null;
  }
}

// ---------------------------------------------------------------------------
// The application's content
// ---------------------------------------------------------------------------

export const APPLICATION_DECLARATIONS_VERSION = 'v1';

export const APPLICATION_REFERENCES_MIN = 2;
export const APPLICATION_REFERENCES_MAX = 3;

export interface ApplicationReferenceInput {
  readonly fullName: string;
  readonly email: string;
  readonly relationship: string;
}

/** What the applicant types. Everything is a string until validated. */
export interface TutorApplicationInput {
  readonly legalFirstName: string;
  readonly legalFamilyName: string;
  readonly preferredFirstName: string;
  readonly phone: string;
  readonly headline: string;
  readonly teachingApproach: string;
  readonly experienceSummary: string;
  readonly qualificationsSummary: string;
  readonly subjectIds: readonly string[];
  readonly yearLevelFrom: string;
  readonly yearLevelTo: string;
  readonly offersOnline: boolean;
  readonly offersInPerson: boolean;
  readonly references: readonly ApplicationReferenceInput[];
  /** All of: 18 or older, accurate, agrees to the terms, accepts the safeguarding requirements. */
  readonly declarationsAccepted: boolean;
}

export interface ValidatedTutorApplication {
  readonly legalFirstName: string;
  readonly legalFamilyName: string;
  readonly preferredFirstName: string;
  readonly phone: string | null;
  readonly headline: string;
  readonly teachingApproach: string;
  readonly experienceSummary: string;
  readonly qualificationsSummary: string | null;
  readonly subjectIds: readonly string[];
  readonly yearLevelFrom: number;
  readonly yearLevelTo: number;
  readonly offersOnline: boolean;
  readonly offersInPerson: boolean;
  readonly references: readonly ApplicationReferenceInput[];
}

const NAME_MAX = 100;
const HEADLINE_MAX = 140;
const LONG_TEXT_MIN = 40;
const LONG_TEXT_MAX = 2000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9 +()-]{6,20}$/;
/** New Zealand school years, the platform's first market. */
export const YEAR_LEVEL_MIN = 1;
export const YEAR_LEVEL_MAX = 13;

function integerYear(value: string): number | null {
  if (!/^\d{1,2}$/.test(value.trim())) return null;
  const year = Number(value.trim());
  return year >= YEAR_LEVEL_MIN && year <= YEAR_LEVEL_MAX ? year : null;
}

/**
 * Validate a COMPLETE application, as is required to submit it.
 *
 * Saving a draft is deliberately NOT validated: a half-written application must
 * be saveable, or the form would lose someone's work. Validation guards the one
 * moment that matters — submission, which freezes a revision a person will read
 * and decide on.
 */
export function validateTutorApplication(
  input: TutorApplicationInput,
  options: { readonly knownSubjectIds?: readonly string[] } = {},
): CommandResult<ValidatedTutorApplication> {
  const issues: Record<string, string> = {};

  const legalFirstName = input.legalFirstName.trim();
  const legalFamilyName = input.legalFamilyName.trim();
  const preferredFirstName = input.preferredFirstName.trim();
  const phone = input.phone.trim();
  const headline = input.headline.trim();
  const teachingApproach = input.teachingApproach.trim();
  const experienceSummary = input.experienceSummary.trim();
  const qualificationsSummary = input.qualificationsSummary.trim();

  if (legalFirstName.length === 0 || legalFirstName.length > NAME_MAX) {
    issues['legalFirstName'] = 'Enter your legal first name.';
  }
  if (legalFamilyName.length === 0 || legalFamilyName.length > NAME_MAX) {
    issues['legalFamilyName'] = 'Enter your legal family name.';
  }
  if (preferredFirstName.length === 0 || preferredFirstName.length > NAME_MAX) {
    issues['preferredFirstName'] = 'Enter the first name families will see.';
  }
  if (phone.length > 0 && !PHONE_PATTERN.test(phone)) {
    issues['phone'] = 'Enter a phone number we can reach you on, or leave it blank.';
  }
  if (headline.length === 0 || headline.length > HEADLINE_MAX) {
    issues['headline'] = `Write a one-line headline of up to ${String(HEADLINE_MAX)} characters.`;
  }
  if (teachingApproach.length < LONG_TEXT_MIN || teachingApproach.length > LONG_TEXT_MAX) {
    issues['teachingApproach'] =
      `Describe how you teach, in at least ${String(LONG_TEXT_MIN)} characters.`;
  }
  if (experienceSummary.length < LONG_TEXT_MIN || experienceSummary.length > LONG_TEXT_MAX) {
    issues['experienceSummary'] =
      `Tell us about your experience, in at least ${String(LONG_TEXT_MIN)} characters.`;
  }
  if (qualificationsSummary.length > LONG_TEXT_MAX) {
    issues['qualificationsSummary'] = 'Please keep this under 2000 characters.';
  }

  const subjectIds = [
    ...new Set(input.subjectIds.map((id) => id.trim()).filter((id) => id !== '')),
  ];
  if (subjectIds.length === 0) {
    issues['subjectIds'] = 'Choose at least one subject you teach.';
  } else if (
    options.knownSubjectIds !== undefined &&
    subjectIds.some((id) => !options.knownSubjectIds!.includes(id))
  ) {
    issues['subjectIds'] = 'One of the subjects you chose is not available.';
  }

  const from = integerYear(input.yearLevelFrom);
  const to = integerYear(input.yearLevelTo);
  if (from === null) issues['yearLevelFrom'] = 'Choose the lowest year level you teach.';
  if (to === null) issues['yearLevelTo'] = 'Choose the highest year level you teach.';
  if (from !== null && to !== null && from > to) {
    issues['yearLevelTo'] = 'The highest year level cannot be below the lowest.';
  }

  if (!input.offersOnline && !input.offersInPerson) {
    issues['formats'] = 'Choose online, in person, or both.';
  }

  const references = input.references
    .map((reference) => ({
      fullName: reference.fullName.trim(),
      email: reference.email.trim(),
      relationship: reference.relationship.trim(),
    }))
    .filter((reference) => reference.fullName + reference.email + reference.relationship !== '');
  if (references.length < APPLICATION_REFERENCES_MIN) {
    issues['references'] = `Give at least ${String(APPLICATION_REFERENCES_MIN)} referees.`;
  } else if (references.length > APPLICATION_REFERENCES_MAX) {
    issues['references'] = `Give no more than ${String(APPLICATION_REFERENCES_MAX)} referees.`;
  } else {
    references.forEach((reference, index) => {
      if (reference.fullName.length === 0 || reference.fullName.length > NAME_MAX) {
        issues[`references.${String(index)}.fullName`] = 'Enter the referee’s name.';
      }
      if (!EMAIL_PATTERN.test(reference.email) || reference.email.length > 200) {
        issues[`references.${String(index)}.email`] = 'Enter a valid email address.';
      }
      if (reference.relationship.length === 0 || reference.relationship.length > NAME_MAX) {
        issues[`references.${String(index)}.relationship`] =
          'Say how they know you (for example, a former employer).';
      }
    });
    const emails = references.map((reference) => reference.email.toLowerCase());
    if (new Set(emails).size !== emails.length) {
      issues['references'] = 'Each referee needs their own email address.';
    }
  }

  if (!input.declarationsAccepted) {
    issues['declarationsAccepted'] = 'You need to accept the declarations to apply.';
  }

  if (Object.keys(issues).length > 0) {
    return fail(domainError('VALIDATION_FAILED', 'Tutor application input is invalid.', issues));
  }

  return ok({
    legalFirstName,
    legalFamilyName,
    preferredFirstName,
    phone: phone === '' ? null : phone,
    headline,
    teachingApproach,
    experienceSummary,
    qualificationsSummary: qualificationsSummary === '' ? null : qualificationsSummary,
    subjectIds,
    yearLevelFrom: from!,
    yearLevelTo: to!,
    offersOnline: input.offersOnline,
    offersInPerson: input.offersInPerson,
    references,
  });
}

/** An empty application, the shape a new draft starts from. */
export const EMPTY_TUTOR_APPLICATION: TutorApplicationInput = {
  legalFirstName: '',
  legalFamilyName: '',
  preferredFirstName: '',
  phone: '',
  headline: '',
  teachingApproach: '',
  experienceSummary: '',
  qualificationsSummary: '',
  subjectIds: [],
  yearLevelFrom: '',
  yearLevelTo: '',
  offersOnline: true,
  offersInPerson: false,
  references: [
    { fullName: '', email: '', relationship: '' },
    { fullName: '', email: '', relationship: '' },
  ],
  declarationsAccepted: false,
};
