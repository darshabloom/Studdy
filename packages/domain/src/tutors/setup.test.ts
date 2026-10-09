import { describe, expect, it } from 'vitest';
import {
  isTutorProfileComplete,
  tutorSetupChecklist,
  validateTutorProfile,
  type TutorProfileInput,
  type TutorSetupFacts,
  type TutorSetupStepCode,
  type TutorSetupStepStatus,
} from './setup';

const NO_SERVICES = {
  draft: 0,
  pendingApproval: 0,
  changesRequested: 0,
  approved: 0,
  published: 0,
  unpublished: 0,
};

/** A tutor exactly as approval leaves them: a profile and nothing else. */
const justApproved: TutorSetupFacts = {
  profileComplete: true,
  profileEligible: true,
  listingPaused: false,
  services: NO_SERVICES,
  availabilityRuleCount: 0,
  canReceivePayments: false,
  payoutsRequiredToPublish: true,
};

const statuses = (facts: TutorSetupFacts): Record<TutorSetupStepCode, TutorSetupStepStatus> =>
  Object.fromEntries(
    tutorSetupChecklist(facts).steps.map((step) => [step.code, step.status]),
  ) as Record<TutorSetupStepCode, TutorSetupStepStatus>;

describe('the setup checklist', () => {
  it('starts a newly approved tutor with their profile done and a service to create', () => {
    const checklist = tutorSetupChecklist(justApproved);
    expect(statuses(justApproved)).toEqual({
      profile: 'done',
      service: 'todo',
      review: 'blocked',
      availability: 'todo',
      payouts: 'todo',
      publish: 'blocked',
    });
    expect(checklist.nextStep).toBe('service');
    expect(checklist.percentComplete).toBe(17);
    expect(checklist.bookable).toBe(false);
    expect(checklist.waitingOnStuddy).toBe(false);
  });

  it('asks for a draft to be sent, then waits on Studdy once it has been', () => {
    const drafted = { ...justApproved, services: { ...NO_SERVICES, draft: 1 } };
    expect(statuses(drafted).review).toBe('todo');

    const sent = { ...justApproved, services: { ...NO_SERVICES, pendingApproval: 1 } };
    expect(statuses(sent).review).toBe('waiting');
    // Other steps are still theirs to do, so this is not "nothing to do".
    expect(tutorSetupChecklist(sent).nextStep).toBe('availability');
    expect(tutorSetupChecklist(sent).waitingOnStuddy).toBe(false);
  });

  it('says so when Studdy is all that is left to wait for', () => {
    const waiting = tutorSetupChecklist({
      ...justApproved,
      services: { ...NO_SERVICES, pendingApproval: 1 },
      availabilityRuleCount: 3,
      canReceivePayments: true,
    });
    expect(waiting.nextStep).toBeNull();
    expect(waiting.waitingOnStuddy).toBe(true);
    expect(waiting.bookable).toBe(false);
  });

  it('puts a service that was sent back on the tutor again', () => {
    const sentBack = { ...justApproved, services: { ...NO_SERVICES, changesRequested: 1 } };
    expect(statuses(sentBack).review).toBe('todo');
  });

  it('holds publishing back until the tutor can be paid, when that is the rule', () => {
    const approved = {
      ...justApproved,
      services: { ...NO_SERVICES, approved: 1 },
      availabilityRuleCount: 2,
    };
    expect(statuses(approved).publish).toBe('blocked');
    expect(tutorSetupChecklist(approved).nextStep).toBe('payouts');

    expect(statuses({ ...approved, canReceivePayments: true }).publish).toBe('todo');
    expect(statuses({ ...approved, payoutsRequiredToPublish: false }).publish).toBe('todo');
  });

  const published: TutorSetupFacts = {
    ...justApproved,
    services: { ...NO_SERVICES, published: 1 },
    availabilityRuleCount: 2,
    canReceivePayments: true,
  };

  it('is bookable only when every step is done', () => {
    const checklist = tutorSetupChecklist(published);
    expect(checklist.bookable).toBe(true);
    expect(checklist.percentComplete).toBe(100);
    expect(checklist.nextStep).toBeNull();
    expect(checklist.waitingOnStuddy).toBe(false);
  });

  it('is not bookable when published but unpayable, even if the rule let them publish', () => {
    // Visible is not bookable: a family's payment is refused for a tutor Stripe cannot pay.
    const checklist = tutorSetupChecklist({
      ...published,
      canReceivePayments: false,
      payoutsRequiredToPublish: false,
    });
    expect(checklist.bookable).toBe(false);
    expect(checklist.nextStep).toBe('payouts');
  });

  it('is not bookable with no availability, or while the listing is paused', () => {
    expect(tutorSetupChecklist({ ...published, availabilityRuleCount: 0 }).bookable).toBe(false);
    const paused = { ...published, listingPaused: true };
    expect(tutorSetupChecklist(paused).bookable).toBe(false);
    expect(statuses(paused).publish).toBe('todo');
  });

  it('blocks publishing for a profile that is not allowed to be listed', () => {
    expect(statuses({ ...published, profileEligible: false }).publish).toBe('blocked');
  });
});

describe('editing a profile', () => {
  const valid: TutorProfileInput = {
    headline: 'Patient maths tutor for years 7 to 10',
    teachingApproach: 'I start from what the student already knows and build up with examples.',
    yearLevelFrom: '7',
    yearLevelTo: '10',
    offersOnline: true,
    offersInPerson: false,
    availabilityLabelCode: 'limited',
  };

  const issuesFor = (input: TutorProfileInput): string[] => {
    const result = validateTutorProfile(input);
    return result.ok ? [] : Object.keys(result.error.details ?? {}).sort();
  };

  it('accepts a complete edit', () => {
    const result = validateTutorProfile(valid);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.yearLevelTo).toBe(10);
  });

  it('refuses empty words, an upside-down range and no format at all', () => {
    expect(
      issuesFor({
        ...valid,
        headline: ' ',
        teachingApproach: 'short',
        yearLevelFrom: '12',
        yearLevelTo: '8',
        offersOnline: false,
      }),
    ).toEqual(['formats', 'headline', 'teachingApproach', 'yearLevelTo']);
  });

  it('does not let a tutor pick a label that changes who may book', () => {
    for (const label of ['existing_only', 'waiting_list', 'available_this_week', 'suspended', '']) {
      expect(issuesFor({ ...valid, availabilityLabelCode: label })).toEqual([
        'availabilityLabelCode',
      ]);
    }
  });

  it('knows when a profile says enough to show a family', () => {
    const complete = {
      headline: 'A headline',
      teachingApproach: 'An approach',
      yearLevelFrom: 7,
      yearLevelTo: 10,
      offersOnline: true,
      offersInPerson: false,
    };
    expect(isTutorProfileComplete(complete)).toBe(true);
    expect(isTutorProfileComplete({ ...complete, headline: null })).toBe(false);
    expect(isTutorProfileComplete({ ...complete, teachingApproach: '  ' })).toBe(false);
    expect(isTutorProfileComplete({ ...complete, yearLevelTo: null })).toBe(false);
    expect(isTutorProfileComplete({ ...complete, offersOnline: false })).toBe(false);
  });
});
