import { describe, expect, it } from 'vitest';
import {
  ARCHIVABLE_SERVICE_STATUSES,
  EDITABLE_SERVICE_STATUSES,
  PUBLISHABLE_SERVICE_STATUSES,
  SERVICE_STATUSES,
  canTransitionService,
  parsePriceToMinor,
  priceInputFromMinor,
  publicationReadiness,
  publicationRequiresPayouts,
  serviceStatusesThatMayMoveTo,
  validateTutorService,
  type TutorServiceInput,
} from './service';

const SUBJECT = 'subject-1';
const context = { knownSubjectIds: [SUBJECT], offersOnline: true, offersInPerson: false };

const valid: TutorServiceInput = {
  subjectId: SUBJECT,
  displayName: 'Year 9 and 10 maths',
  description: 'Weekly lessons that follow the school programme, with worked examples.',
  yearLevelFrom: '9',
  yearLevelTo: '10',
  formatCode: 'online',
  options: [
    { durationMinutes: '90', price: '90' },
    { durationMinutes: '60', price: '65.50' },
  ],
};

describe('the service lifecycle', () => {
  it('cannot be published without passing review', () => {
    // The whole point of the workflow: no path from a draft to on sale skips Studdy.
    expect(canTransitionService('draft', 'published')).toBe(false);
    expect(canTransitionService('pending_approval', 'published')).toBe(false);
    expect(canTransitionService('changes_requested', 'published')).toBe(false);
    expect(serviceStatusesThatMayMoveTo('published')).toEqual(['approved', 'unpublished']);
    expect(PUBLISHABLE_SERVICE_STATUSES).toEqual(['approved', 'unpublished']);
  });

  it('is approved only from review', () => {
    expect(serviceStatusesThatMayMoveTo('approved')).toEqual(['pending_approval']);
    expect(serviceStatusesThatMayMoveTo('changes_requested')).toEqual(['pending_approval']);
  });

  it('lets the tutor take a service back out of review, and send it again', () => {
    expect(canTransitionService('pending_approval', 'draft')).toBe(true);
    expect(canTransitionService('changes_requested', 'pending_approval')).toBe(true);
  });

  it('can be republished after being taken down, without another review', () => {
    expect(canTransitionService('published', 'unpublished')).toBe(true);
    expect(canTransitionService('unpublished', 'published')).toBe(true);
  });

  it('is never editable once it has been sent or reviewed', () => {
    expect(EDITABLE_SERVICE_STATUSES).toEqual(['draft', 'changes_requested']);
  });

  it('cannot be removed by its tutor while it is on sale or in review', () => {
    expect(ARCHIVABLE_SERVICE_STATUSES).not.toContain('published');
    expect(ARCHIVABLE_SERVICE_STATUSES).not.toContain('pending_approval');
  });

  it('has no way out of archived', () => {
    for (const to of SERVICE_STATUSES) expect(canTransitionService('archived', to)).toBe(false);
  });
});

describe('prices', () => {
  it('reads dollars into minor units without a float', () => {
    expect(parsePriceToMinor('65')).toBe(6500n);
    expect(parsePriceToMinor('65.5')).toBe(6550n);
    expect(parsePriceToMinor('65.10')).toBe(6510n);
    expect(parsePriceToMinor(' $70 ')).toBe(7000n);
  });

  it('refuses anything that is not a plain amount', () => {
    for (const bad of ['', 'abc', '65.123', '-5', '1e3', '6,500', '65 dollars']) {
      expect(parsePriceToMinor(bad)).toBeNull();
    }
  });

  it('round-trips what the form shows', () => {
    expect(priceInputFromMinor(6500n)).toBe('65');
    expect(priceInputFromMinor(6550n)).toBe('65.50');
    expect(priceInputFromMinor(6505n)).toBe('65.05');
  });
});

describe('validating a service', () => {
  it('accepts a complete service and orders its options shortest first', () => {
    const result = validateTutorService(valid, context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.options).toEqual([
      { durationMinutes: 60, priceAmountMinor: 6550n },
      { durationMinutes: 90, priceAmountMinor: 9000n },
    ]);
    expect(result.value.yearLevelFrom).toBe(9);
  });

  const issuesFor = (input: TutorServiceInput, ctx = context): Record<string, string> => {
    const result = validateTutorService(input, ctx);
    return result.ok ? {} : ((result.error.details ?? {}) as Record<string, string>);
  };

  it('refuses a subject Studdy does not know', () => {
    expect(issuesFor({ ...valid, subjectId: 'made-up' })).toHaveProperty('subjectId');
  });

  it('refuses a missing name, a thin description and an upside-down year range', () => {
    const issues = issuesFor({
      ...valid,
      displayName: 'x',
      description: 'Too short.',
      yearLevelFrom: '11',
      yearLevelTo: '9',
    });
    expect(Object.keys(issues).sort()).toEqual(['description', 'displayName', 'yearLevelTo']);
  });

  it('refuses a format the profile does not offer', () => {
    // The profile is online-only, so neither in-person nor "either" may be sold.
    expect(issuesFor({ ...valid, formatCode: 'in_person' })).toHaveProperty('formatCode');
    expect(issuesFor({ ...valid, formatCode: 'either' })).toHaveProperty('formatCode');
    expect(
      issuesFor(
        { ...valid, formatCode: 'either' },
        { ...context, offersOnline: true, offersInPerson: true },
      ),
    ).toEqual({});
  });

  it('needs at least one priced lesson length', () => {
    expect(issuesFor({ ...valid, options: [] })).toHaveProperty('options');
    expect(issuesFor({ ...valid, options: [{ durationMinutes: '', price: '' }] })).toHaveProperty(
      'options',
    );
  });

  it('refuses a length off the list, a repeated length and a price out of bounds', () => {
    const issues = issuesFor({
      ...valid,
      options: [
        { durationMinutes: '50', price: '60' },
        { durationMinutes: '60', price: '60' },
        { durationMinutes: '60', price: '70' },
        { durationMinutes: '90', price: '5' },
        { durationMinutes: '120', price: '900' },
      ],
    });
    expect(Object.keys(issues).sort()).toEqual([
      'options.0.durationMinutes',
      'options.2.durationMinutes',
      'options.3.price',
      'options.4.price',
    ]);
  });
});

describe('going on sale', () => {
  const ready = {
    profileStatus: 'approved',
    serviceStatus: 'approved',
    pricedOptionCount: 1,
    payoutsRequired: true,
    canReceivePayments: true,
  };

  it('is ready when the profile, the review, the price and payouts all are', () => {
    expect(publicationReadiness(ready)).toEqual({ ready: true });
    expect(publicationReadiness({ ...ready, profileStatus: 'active' })).toEqual({ ready: true });
    expect(publicationReadiness({ ...ready, serviceStatus: 'unpublished' })).toEqual({
      ready: true,
    });
  });

  it('names every blocker, not just the first', () => {
    expect(
      publicationReadiness({
        profileStatus: 'suspended',
        serviceStatus: 'draft',
        pricedOptionCount: 0,
        payoutsRequired: true,
        canReceivePayments: false,
      }),
    ).toEqual({
      ready: false,
      blockers: [
        'profile_not_eligible',
        'service_not_reviewed',
        'no_priced_option',
        'payouts_not_ready',
      ],
    });
  });

  it('refuses a service still in review, or sent back', () => {
    for (const serviceStatus of ['pending_approval', 'changes_requested', 'archived']) {
      expect(publicationReadiness({ ...ready, serviceStatus })).toEqual({
        ready: false,
        blockers: ['service_not_reviewed'],
      });
    }
  });

  it('lets a tutor who cannot yet be paid publish only when the rule is relaxed', () => {
    expect(publicationReadiness({ ...ready, canReceivePayments: false })).toEqual({
      ready: false,
      blockers: ['payouts_not_ready'],
    });
    expect(
      publicationReadiness({ ...ready, payoutsRequired: false, canReceivePayments: false }),
    ).toEqual({ ready: true });
  });

  it('keeps the payout rule on unless it is deliberately switched off', () => {
    // Fails closed: only a stored literal false relaxes it.
    for (const value of [undefined, null, true, 'false', 0, '', {}, []]) {
      expect(publicationRequiresPayouts(value)).toBe(true);
    }
    expect(publicationRequiresPayouts(false)).toBe(false);
  });
});
