import { domainError } from '../core/errors';
import { fail, ok, type CommandResult } from '../core/result';
import { YEAR_LEVEL_MAX, YEAR_LEVEL_MIN } from './application';

/**
 * AN APPROVED TUTOR'S OWN PROFILE AND SETUP — what they may change, and what
 * still stands between them and being bookable.
 *
 * PURE AND DATABASE-FREE. The checklist is a function of facts, so "what does an
 * approved tutor still have to do?" has one answer, tested here, and every screen
 * that shows it shows the same thing.
 */

// ---------------------------------------------------------------------------
// The profile
// ---------------------------------------------------------------------------

/**
 * Profile states that may enter the tutor workspace.
 *
 * `approved` is a tutor who has not yet published anything, `active` one who has,
 * and `unlisted` one who has stepped back but still has lessons to look after.
 * Anything else (suspended, departed, an applicant) is kept out.
 */
export const TUTOR_WORKSPACE_PROFILE_STATUSES = ['approved', 'active', 'unlisted'] as const;

/**
 * The availability labels a tutor may choose for themselves (doc 14 §13).
 * `existing_only` and `waiting_list` change who may book, so they are not a label
 * a tutor can simply pick.
 */
export const TUTOR_SELECTABLE_AVAILABILITY_LABELS = ['accepting_new', 'limited'] as const;

export type TutorSelectableAvailabilityLabel =
  (typeof TUTOR_SELECTABLE_AVAILABILITY_LABELS)[number];

const HEADLINE_MAX = 140;
const APPROACH_MIN = 40;
const APPROACH_MAX = 2000;

/** The profile form, as typed. */
export interface TutorProfileInput {
  readonly headline: string;
  readonly teachingApproach: string;
  readonly yearLevelFrom: string;
  readonly yearLevelTo: string;
  readonly offersOnline: boolean;
  readonly offersInPerson: boolean;
  readonly availabilityLabelCode: string;
}

export interface ValidatedTutorProfile {
  readonly headline: string;
  readonly teachingApproach: string;
  readonly yearLevelFrom: number;
  readonly yearLevelTo: number;
  readonly offersOnline: boolean;
  readonly offersInPerson: boolean;
  readonly availabilityLabelCode: TutorSelectableAvailabilityLabel;
}

function integerYear(value: string): number | null {
  if (!/^\d{1,2}$/.test(value.trim())) return null;
  const year = Number(value.trim());
  return year >= YEAR_LEVEL_MIN && year <= YEAR_LEVEL_MAX ? year : null;
}

/**
 * Validate a tutor's edit of their own public profile.
 *
 * THE NAME IS NOT HERE. The first name families see was checked against a real
 * person at approval; changing it is not a profile edit.
 */
export function validateTutorProfile(
  input: TutorProfileInput,
): CommandResult<ValidatedTutorProfile> {
  const issues: Record<string, string> = {};

  const headline = input.headline.trim();
  if (headline.length === 0 || headline.length > HEADLINE_MAX) {
    issues['headline'] = `Write a one-line headline of up to ${String(HEADLINE_MAX)} characters.`;
  }
  const teachingApproach = input.teachingApproach.trim();
  if (teachingApproach.length < APPROACH_MIN || teachingApproach.length > APPROACH_MAX) {
    issues['teachingApproach'] =
      `Describe how you teach, in at least ${String(APPROACH_MIN)} characters.`;
  }

  const yearLevelFrom = integerYear(input.yearLevelFrom);
  const yearLevelTo = integerYear(input.yearLevelTo);
  if (yearLevelFrom === null) issues['yearLevelFrom'] = 'Choose the youngest year level you teach.';
  if (yearLevelTo === null) issues['yearLevelTo'] = 'Choose the oldest year level you teach.';
  if (yearLevelFrom !== null && yearLevelTo !== null && yearLevelFrom > yearLevelTo) {
    issues['yearLevelTo'] = 'The oldest year level cannot be below the youngest.';
  }

  if (!input.offersOnline && !input.offersInPerson) {
    issues['formats'] = 'Choose at least one way you teach.';
  }

  const label = input.availabilityLabelCode.trim();
  if (!(TUTOR_SELECTABLE_AVAILABILITY_LABELS as readonly string[]).includes(label)) {
    issues['availabilityLabelCode'] = 'Choose how much room you have for new students.';
  }

  if (Object.keys(issues).length > 0) {
    return fail(domainError('VALIDATION_FAILED', 'The profile is incomplete.', issues));
  }
  return ok({
    headline,
    teachingApproach,
    yearLevelFrom: yearLevelFrom!,
    yearLevelTo: yearLevelTo!,
    offersOnline: input.offersOnline,
    offersInPerson: input.offersInPerson,
    availabilityLabelCode: label as TutorSelectableAvailabilityLabel,
  });
}

/** Does the profile say enough to be shown to a family? */
export function isTutorProfileComplete(profile: {
  readonly headline: string | null;
  readonly teachingApproach: string | null;
  readonly yearLevelFrom: number | null;
  readonly yearLevelTo: number | null;
  readonly offersOnline: boolean;
  readonly offersInPerson: boolean;
}): boolean {
  return (
    (profile.headline ?? '').trim() !== '' &&
    (profile.teachingApproach ?? '').trim() !== '' &&
    profile.yearLevelFrom !== null &&
    profile.yearLevelTo !== null &&
    (profile.offersOnline || profile.offersInPerson)
  );
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

/** Visibility states in which a tutor is listed, and so may pause themselves. */
export const LISTED_VISIBILITY_STATES = ['public_recommended', 'public_reduced'] as const;

export function isListedVisibility(state: string): boolean {
  return (LISTED_VISIBILITY_STATES as readonly string[]).includes(state);
}

// ---------------------------------------------------------------------------
// The setup checklist
// ---------------------------------------------------------------------------

export const TUTOR_SETUP_STEP_CODES = [
  'profile',
  'service',
  'review',
  'availability',
  'payouts',
  'publish',
] as const;

export type TutorSetupStepCode = (typeof TUTOR_SETUP_STEP_CODES)[number];

/**
 * `todo` is the tutor's to do now. `waiting` is with Studdy. `blocked` cannot be
 * started until an earlier step is done.
 */
export type TutorSetupStepStatus = 'done' | 'todo' | 'waiting' | 'blocked';

export interface TutorSetupStep {
  readonly code: TutorSetupStepCode;
  readonly status: TutorSetupStepStatus;
}

/** Everything the checklist is a function of. Counts and booleans, no records. */
export interface TutorSetupFacts {
  readonly profileComplete: boolean;
  /** The profile's own state allows it to be listed and to publish. */
  readonly profileEligible: boolean;
  /** The tutor has paused their own listing. */
  readonly listingPaused: boolean;
  readonly services: {
    readonly draft: number;
    readonly pendingApproval: number;
    readonly changesRequested: number;
    readonly approved: number;
    readonly published: number;
    readonly unpublished: number;
  };
  readonly availabilityRuleCount: number;
  readonly canReceivePayments: boolean;
  /** Whether a service may be published before payouts are ready. */
  readonly payoutsRequiredToPublish: boolean;
}

export interface TutorSetupChecklist {
  readonly steps: readonly TutorSetupStep[];
  /** Whole percent of steps done. */
  readonly percentComplete: number;
  /** The first step the tutor can act on now, or null when nothing is theirs to do. */
  readonly nextStep: TutorSetupStepCode | null;
  /** Something is with Studdy and nothing is the tutor's to do. */
  readonly waitingOnStuddy: boolean;
  /** Every step is done: families can find, ask and pay this tutor. */
  readonly bookable: boolean;
}

/**
 * What an approved tutor has done and what remains (doc 04 §14: mandatory tasks,
 * blocked items, next required action, reviewer status).
 *
 * BOOKABLE MEANS ALL SIX. Payouts are on the list whether or not they gate
 * publishing, because a family's payment is refused for a tutor who cannot be
 * paid: a tutor in discovery who cannot be paid is not bookable, only visible.
 */
export function tutorSetupChecklist(facts: TutorSetupFacts): TutorSetupChecklist {
  const { services } = facts;
  const reviewed = services.approved + services.published + services.unpublished;
  const total = reviewed + services.draft + services.pendingApproval + services.changesRequested;

  const profile: TutorSetupStepStatus = facts.profileComplete ? 'done' : 'todo';
  const service: TutorSetupStepStatus = total > 0 ? 'done' : 'todo';

  let review: TutorSetupStepStatus;
  if (total === 0) review = 'blocked';
  else if (reviewed > 0) review = 'done';
  else if (services.draft + services.changesRequested > 0) review = 'todo';
  else review = 'waiting';

  const availability: TutorSetupStepStatus = facts.availabilityRuleCount > 0 ? 'done' : 'todo';
  const payouts: TutorSetupStepStatus = facts.canReceivePayments ? 'done' : 'todo';

  let publish: TutorSetupStepStatus;
  if (services.published > 0 && !facts.listingPaused && facts.profileEligible) {
    publish = 'done';
  } else if (
    !facts.profileEligible ||
    reviewed === 0 ||
    (facts.payoutsRequiredToPublish && !facts.canReceivePayments)
  ) {
    publish = 'blocked';
  } else {
    publish = 'todo';
  }

  const steps: readonly TutorSetupStep[] = [
    { code: 'profile', status: profile },
    { code: 'service', status: service },
    { code: 'review', status: review },
    { code: 'availability', status: availability },
    { code: 'payouts', status: payouts },
    { code: 'publish', status: publish },
  ];

  const done = steps.filter((step) => step.status === 'done').length;
  const nextStep = steps.find((step) => step.status === 'todo')?.code ?? null;
  return {
    steps,
    percentComplete: Math.round((done / steps.length) * 100),
    nextStep,
    waitingOnStuddy: nextStep === null && steps.some((step) => step.status === 'waiting'),
    bookable: done === steps.length,
  };
}
