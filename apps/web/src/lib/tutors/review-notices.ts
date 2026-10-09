/**
 * The outcome of a reviewer's action, as a CLOSED set of tokens carried in the
 * URL. Never free text: nothing about an applicant belongs in a URL, and a token
 * that is not in this set renders as nothing.
 */
export const REVIEW_NOTICE = {
  checkSaved: 'check_saved',
  approved: 'approved',
  checksIncomplete: 'checks_incomplete',
  profileExists: 'profile_exists',
  changesRequested: 'changes_requested',
  rejected: 'rejected',
  messageRequired: 'message_required',
  notDecidable: 'not_decidable',
  invalid: 'invalid',
} as const;

export type ReviewNotice = (typeof REVIEW_NOTICE)[keyof typeof REVIEW_NOTICE];

export interface NoticeCopy {
  readonly tone: 'success' | 'warning' | 'critical';
  readonly text: string;
}

const COPY: Readonly<Record<ReviewNotice, NoticeCopy>> = {
  check_saved: { tone: 'success', text: 'Check recorded.' },
  approved: {
    tone: 'success',
    text: 'Approved. The applicant now has a tutor profile and workspace.',
  },
  checks_incomplete: {
    tone: 'warning',
    text: 'Not approved: every required check has to be verified first.',
  },
  profile_exists: {
    tone: 'critical',
    text: 'Not approved: this person already has a tutor profile. Look into it before going on.',
  },
  changes_requested: {
    tone: 'success',
    text: 'Changes requested. The applicant can edit and resubmit.',
  },
  rejected: { tone: 'success', text: 'The application was declined.' },
  message_required: {
    tone: 'warning',
    text: 'Write a message for the applicant (up to 1000 characters).',
  },
  not_decidable: {
    tone: 'warning',
    text: 'This application has already been decided or is not under review.',
  },
  invalid: { tone: 'warning', text: 'That was not understood. Nothing was changed.' },
};

/** The copy for a notice token from the URL, or nothing for one we do not know. */
export function noticeCopy(token: string | undefined): NoticeCopy | null {
  if (token === undefined) return null;
  return (COPY as Record<string, NoticeCopy | undefined>)[token] ?? null;
}
