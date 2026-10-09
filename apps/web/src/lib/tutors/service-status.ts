import type { StatusFamily } from '@studdy/design-system';
import type {
  PublicationBlocker,
  ServiceFormatCode,
  ServiceStatus,
  TutorSetupStepCode,
  TutorSetupStepStatus,
} from '@studdy/domain/tutors';

/** How a service's status, format and blockers are spoken and shown, in one place. */

export const SERVICE_STATUS_LABEL: Readonly<Record<ServiceStatus, string>> = {
  draft: 'Draft',
  pending_approval: 'With Studdy for review',
  changes_requested: 'Changes requested',
  approved: 'Approved, not yet published',
  published: 'Published',
  unpublished: 'Unpublished',
  archived: 'Removed',
};

export const SERVICE_STATUS_FAMILY: Readonly<Record<ServiceStatus, StatusFamily>> = {
  draft: 'paused',
  pending_approval: 'pending',
  changes_requested: 'awaiting_action',
  approved: 'awaiting_action',
  published: 'complete',
  unpublished: 'paused',
  archived: 'cancelled',
};

/** What each status means for the tutor, in a sentence. */
export const SERVICE_STATUS_HELP: Readonly<Record<ServiceStatus, string>> = {
  draft: 'Only you can see this. Send it to Studdy for review when it is ready.',
  pending_approval:
    'Studdy is reviewing this service. You will be able to publish it once it is approved.',
  changes_requested: 'Studdy has asked for changes. Edit the service and send it again.',
  approved: 'Studdy has approved this service. Publish it when you want families to see it.',
  published: 'Families can find this service and ask you for a lesson.',
  unpublished:
    'Families cannot ask for this service. Lessons already requested or booked are not affected.',
  archived: 'This service has been removed.',
};

export const SERVICE_FORMAT_LABEL: Readonly<Record<ServiceFormatCode, string>> = {
  online: 'Online',
  in_person: 'In person',
  either: 'Online or in person',
};

export const PUBLICATION_BLOCKER_COPY: Readonly<Record<PublicationBlocker, string>> = {
  profile_not_eligible: 'Your tutor profile cannot publish services at the moment.',
  service_not_reviewed: 'This service has not been approved by Studdy yet.',
  no_priced_option: 'Add at least one lesson length and price.',
  payouts_not_ready:
    'Finish getting set up to be paid first. Families pay when they book, so Studdy has to be able to pay you.',
};

/**
 * The outcome of a tutor's action on a service or profile, as a CLOSED set of
 * tokens carried in the URL. Never free text; a token outside the set renders as
 * nothing.
 */
export const SERVICE_NOTICE = {
  saved: 'saved',
  submitted: 'submitted',
  withdrawn: 'withdrawn',
  published: 'published',
  unpublished: 'unpublished',
  removed: 'removed',
  revisionStarted: 'revision_started',
  notAllowed: 'not_allowed',
  limitReached: 'limit_reached',
  notReady: 'not_ready',
  payoutsNotReady: 'payouts_not_ready',
  paused: 'paused',
  resumed: 'resumed',
} as const;

export type ServiceNotice = (typeof SERVICE_NOTICE)[keyof typeof SERVICE_NOTICE];

export interface TutorNoticeCopy {
  readonly tone: 'success' | 'warning' | 'critical';
  readonly text: string;
}

const NOTICE_COPY: Readonly<Record<ServiceNotice, TutorNoticeCopy>> = {
  saved: { tone: 'success', text: 'Saved.' },
  submitted: { tone: 'success', text: 'Sent to Studdy for review.' },
  withdrawn: { tone: 'success', text: 'Taken back out of review. You can edit it again.' },
  published: { tone: 'success', text: 'Published. Families can now find this service.' },
  unpublished: { tone: 'success', text: 'Unpublished. Families can no longer ask for it.' },
  removed: { tone: 'success', text: 'Service removed.' },
  revision_started: {
    tone: 'success',
    text: 'This is a draft of your changes. The current service stays as it is until you publish this one.',
  },
  not_allowed: {
    tone: 'warning',
    text: 'That is not possible for this service right now. Nothing was changed.',
  },
  limit_reached: { tone: 'warning', text: 'You have reached the limit on services.' },
  not_ready: {
    tone: 'warning',
    text: 'This service cannot be published yet. Check your setup list for what is left.',
  },
  payouts_not_ready: { tone: 'warning', text: PUBLICATION_BLOCKER_COPY.payouts_not_ready },
  paused: {
    tone: 'success',
    text: 'Your listing is paused. Families cannot find you or ask for new lessons.',
  },
  resumed: { tone: 'success', text: 'Your listing is live again.' },
};

export function tutorNoticeCopy(token: string | undefined): TutorNoticeCopy | null {
  // Own keys only: `?notice=toString` must not resolve to something inherited.
  if (token === undefined || !Object.hasOwn(NOTICE_COPY, token)) return null;
  return (NOTICE_COPY as Record<string, TutorNoticeCopy | undefined>)[token] ?? null;
}

// ---------------------------------------------------------------------------
// The setup checklist
// ---------------------------------------------------------------------------

export interface SetupStepCopy {
  readonly title: string;
  readonly href: string;
  readonly actionLabel: string;
  readonly detail: Readonly<Record<TutorSetupStepStatus, string>>;
}

export const SETUP_STEP_COPY: Readonly<Record<TutorSetupStepCode, SetupStepCopy>> = {
  profile: {
    title: 'Complete your profile',
    href: '/tutor/profile',
    actionLabel: 'Edit profile',
    detail: {
      done: 'Your headline, teaching approach, year levels and formats are in place.',
      todo: 'Add a headline, how you teach, the year levels you take and how you teach them.',
      waiting: '',
      blocked: '',
    },
  },
  service: {
    title: 'Create a service',
    href: '/tutor/services/new',
    actionLabel: 'Create a service',
    detail: {
      done: 'You have at least one service.',
      todo: 'A service is what a family books: a subject, the year levels, lesson lengths and prices.',
      waiting: '',
      blocked: '',
    },
  },
  review: {
    title: 'Have Studdy review it',
    href: '/tutor/services',
    actionLabel: 'Go to your services',
    detail: {
      done: 'Studdy has approved a service.',
      todo: 'Send your service to Studdy. Every new service is reviewed before it can be published.',
      waiting: 'Studdy is reviewing your service. There is nothing you need to do.',
      blocked: 'Create a service first.',
    },
  },
  availability: {
    title: 'Set your availability',
    href: '/tutor/availability',
    actionLabel: 'Set availability',
    detail: {
      done: 'Your regular hours are set.',
      todo: 'Families can only ask for times you are free. Add your regular hours.',
      waiting: '',
      blocked: '',
    },
  },
  payouts: {
    title: 'Get set up to be paid',
    href: '/tutor/payments',
    actionLabel: 'Set up payments',
    detail: {
      done: 'Studdy can pay you.',
      todo: 'Families pay when they book, so Studdy needs to be able to pay you. This is done with Stripe.',
      waiting: '',
      blocked: '',
    },
  },
  publish: {
    title: 'Publish',
    href: '/tutor/services',
    actionLabel: 'Go to your services',
    detail: {
      done: 'You are listed and a service is on sale.',
      todo: 'Publish an approved service so families can find you.',
      waiting: '',
      blocked: 'Available once a service is approved and the steps above are done.',
    },
  },
};
