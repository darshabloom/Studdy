import {
  applicantAge,
  validateApplicationV2,
  type ApplicationV2Issues,
  type ApplicationV2ValidationOptions,
  type TutorApplicationV2Draft,
} from './application-v2';

/**
 * Submission policy supplied by trusted server-side configuration and checks.
 *
 * Client declarations record agreement, never proof that a human verified
 * identity, a referee or a minor's consent. Do not infer these facts from DOB.
 */
export interface ApplicationV2SubmissionPolicy extends ApplicationV2ValidationOptions {
  readonly tutorAgreementVersion: string | null;
  readonly codeOfConductVersion: string | null;
  readonly privacyNoticeVersion: string | null;
  readonly guardianConsentVerified: boolean;
  readonly guardianConsentReference: string | null;
}

export interface ApplicationV2SubmissionReadiness {
  readonly ready: boolean;
  readonly issues: ApplicationV2Issues;
  readonly requiresGuardianConsent: boolean;
}

/** These are *submission* gates. Staff identity and safeguarding checks gate approval separately. */
export function applicationV2SubmissionReadiness(
  draft: TutorApplicationV2Draft,
  policy: ApplicationV2SubmissionPolicy,
): ApplicationV2SubmissionReadiness {
  const validated = validateApplicationV2(draft, policy);
  const issues: ApplicationV2Issues = { ...validated.issues };
  const age = applicantAge(draft.about.dateOfBirth, policy.today);
  const requiresGuardianConsent = age !== null && age >= 16 && age < 18;

  if (!policy.tutorAgreementVersion?.trim()) {
    issues['declarations.tutorAgreementVersion'] =
      'The Tutor Agreement is currently unavailable. Please try again later.';
  }
  if (!policy.codeOfConductVersion?.trim()) {
    issues['declarations.codeOfConductVersion'] =
      'The Tutor Code of Conduct is currently unavailable. Please try again later.';
  }
  if (!policy.privacyNoticeVersion?.trim()) {
    issues['declarations.privacyNoticeVersion'] =
      'The Privacy Notice is currently unavailable. Please try again later.';
  }

  // A minor's declaration cannot substitute for recorded guardian permission.
  if (
    requiresGuardianConsent &&
    (!policy.guardianConsentVerified || !policy.guardianConsentReference?.trim())
  ) {
    issues['about.guardianConsent'] =
      'Guardian consent must be verified before this application can be submitted.';
  }

  return {
    ready: Object.keys(issues).length === 0,
    issues,
    requiresGuardianConsent,
  };
}

/**
 * Constructs a detached, immutable-in-practice snapshot value. The database
 * must separately enforce append-only revisions and retain the exact document
 * versions accepted. This function has no persistence side effects.
 */
export interface ApplicationV2SubmissionSnapshot {
  readonly schemaVersion: 2;
  readonly answers: TutorApplicationV2Draft;
  readonly documentVersions: {
    readonly tutorAgreement: string;
    readonly codeOfConduct: string;
    readonly privacyNotice: string;
  };
  readonly guardianConsentReference: string | null;
}

export function prepareApplicationV2Submission(
  draft: TutorApplicationV2Draft,
  policy: ApplicationV2SubmissionPolicy,
): { readonly status: 'invalid'; readonly issues: ApplicationV2Issues } |
  { readonly status: 'ready'; readonly snapshot: ApplicationV2SubmissionSnapshot } {
  const result = applicationV2SubmissionReadiness(draft, policy);
  if (!result.ready) return { status: 'invalid', issues: result.issues };

  // Values are checked above; type-safe fallback leaves fail-closed behaviour
  // if a caller accidentally passes an empty configuration.
  const agreement = policy.tutorAgreementVersion?.trim();
  const conduct = policy.codeOfConductVersion?.trim();
  const notice = policy.privacyNoticeVersion?.trim();
  if (!agreement || !conduct || !notice) {
    return { status: 'invalid', issues: { 'declarations.documents': 'Required legal documents are unavailable.' } };
  }

  return {
    status: 'ready',
    snapshot: {
      schemaVersion: 2,
      answers: structuredClone(draft),
      documentVersions: {
        tutorAgreement: agreement,
        codeOfConduct: conduct,
        privacyNotice: notice,
      },
      guardianConsentReference: result.requiresGuardianConsent
        ? policy.guardianConsentReference
        : null,
    },
  };
}
