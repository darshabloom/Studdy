import type { StatusFamily } from '@studdy/design-system';
import type { ApplicationCheckCode, TutorApplicationStatus } from '@studdy/domain/tutors';

/** How an application's status is spoken and shown, in one place. */

export const APPLICATION_STATUS_LABEL: Readonly<Record<TutorApplicationStatus, string>> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  changes_requested: 'Changes requested',
  approved: 'Approved',
  rejected: 'Not approved',
  withdrawn: 'Withdrawn',
};

export const APPLICATION_STATUS_FAMILY: Readonly<Record<TutorApplicationStatus, StatusFamily>> = {
  draft: 'paused',
  submitted: 'pending',
  under_review: 'pending',
  changes_requested: 'awaiting_action',
  approved: 'complete',
  rejected: 'failed',
  withdrawn: 'cancelled',
};

export const CHECK_LABEL: Readonly<Record<ApplicationCheckCode, string>> = {
  identity: 'Identity',
  safeguarding: 'Safeguarding requirements',
  references: 'References',
  interview: 'Interview',
};

export const CHECK_HELP: Readonly<Record<ApplicationCheckCode, string>> = {
  identity:
    'You have confirmed who they are, outside the form. Studdy keeps the outcome, not documents.',
  safeguarding: 'The safeguarding requirements for working with children are met.',
  references: 'The referees have been contacted and the replies are satisfactory.',
  interview: 'Studdy has spoken with the applicant.',
};
