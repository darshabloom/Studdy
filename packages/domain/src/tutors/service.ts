import { domainError } from '../core/errors';
import { fail, ok, type CommandResult } from '../core/result';
import { YEAR_LEVEL_MAX, YEAR_LEVEL_MIN } from './application';

/**
 * A TUTOR'S SERVICE — what they put on sale, and the review it passes first.
 *
 * PURE AND DATABASE-FREE. The states, who may move between them, what a complete
 * service is and what must be true before it goes on sale are product rules, so
 * they live here and are tested without a database.
 *
 * THE LIFECYCLE is the launch subset of the approved service workflow (doc 09
 * §45-47). Every new service is reviewed by Studdy before it can be published
 * (doc 04 §15); approval does not publish it, the tutor does, so going on sale is
 * always the tutor's own act.
 *
 *     draft → pending_approval → approved → published ⇄ unpublished
 *       ↑          ↓  ↑
 *       └── changes_requested
 *
 * `archived` is the exit from any state that is not on sale. Scheduled
 * publication, restriction and suspension are in the approved workflow and are
 * NOT built: nothing in this slice could drive them.
 *
 * A PUBLISHED SERVICE IS NEVER EDITED IN PLACE (database spec §8.2). Changing one
 * creates a separate draft that goes through review like any other; the service
 * on sale stays on sale, unchanged, until the tutor publishes its replacement.
 */
export const SERVICE_STATUSES = [
  'draft',
  'pending_approval',
  'changes_requested',
  'approved',
  'published',
  'unpublished',
  'archived',
] as const;

export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export function isServiceStatus(value: string): value is ServiceStatus {
  return (SERVICE_STATUSES as readonly string[]).includes(value);
}

const SERVICE_TRANSITIONS: Readonly<Record<ServiceStatus, readonly ServiceStatus[]>> = {
  draft: ['pending_approval', 'archived'],
  /** Back to `draft` is the tutor withdrawing it from review to keep editing. */
  pending_approval: ['draft', 'approved', 'changes_requested'],
  changes_requested: ['pending_approval', 'archived'],
  approved: ['published', 'archived'],
  /** `archived` from here happens only when an approved replacement is published. */
  published: ['unpublished', 'archived'],
  unpublished: ['published', 'archived'],
  archived: [],
};

export function canTransitionService(from: ServiceStatus, to: ServiceStatus): boolean {
  return SERVICE_TRANSITIONS[from].includes(to);
}

/** What a guarded `UPDATE ... WHERE status_code IN (...)` may move FROM, for a target. */
export function serviceStatusesThatMayMoveTo(target: ServiceStatus): readonly ServiceStatus[] {
  return SERVICE_STATUSES.filter((from) => canTransitionService(from, target));
}

/** Statuses in which the tutor may change what the service says. */
export const EDITABLE_SERVICE_STATUSES: readonly ServiceStatus[] = ['draft', 'changes_requested'];

/** The one status a reviewer may decide from. */
export const REVIEWABLE_SERVICE_STATUSES: readonly ServiceStatus[] = ['pending_approval'];

/** Statuses the tutor may publish from: reviewed, and not currently on sale. */
export const PUBLISHABLE_SERVICE_STATUSES: readonly ServiceStatus[] = ['approved', 'unpublished'];

/** Reviewed services, which change only through a separately reviewed replacement. */
export const REVISABLE_SERVICE_STATUSES: readonly ServiceStatus[] = [
  'approved',
  'published',
  'unpublished',
];

/** Statuses the tutor may remove a service from. Never one that is on sale. */
export const ARCHIVABLE_SERVICE_STATUSES: readonly ServiceStatus[] = [
  'draft',
  'changes_requested',
  'approved',
  'unpublished',
];

/** Services that have passed review at some point. */
export const REVIEWED_SERVICE_STATUSES: readonly ServiceStatus[] = [
  'approved',
  'published',
  'unpublished',
];

// ---------------------------------------------------------------------------
// What a service says
// ---------------------------------------------------------------------------

export const SERVICE_FORMAT_CODES = ['online', 'in_person', 'either'] as const;

export type ServiceFormatCode = (typeof SERVICE_FORMAT_CODES)[number];

/**
 * The lesson lengths a service may be sold in.
 *
 * A closed list rather than free minutes: availability is cut into 15-minute
 * steps and families choose a length before a tutor, so a 50-minute lesson would
 * be one no other tutor offers and no shortlist could compare.
 */
export const SERVICE_DURATION_MINUTES = [30, 45, 60, 90, 120] as const;

export const SERVICE_OPTIONS_MAX = SERVICE_DURATION_MINUTES.length;

/**
 * Price bounds per lesson, in minor units. PROVISIONAL, and guards against a
 * slipped key rather than a pricing policy: $10 to $500.
 */
export const SERVICE_PRICE_MIN_MINOR = 1_000n;
export const SERVICE_PRICE_MAX_MINOR = 50_000n;

export const SERVICE_CURRENCY_CODE = 'NZD';

const NAME_MIN = 3;
const NAME_MAX = 80;
const DESCRIPTION_MIN = 40;
const DESCRIPTION_MAX = 1000;

/** One length and its price, as typed. */
export interface ServiceOptionInput {
  readonly durationMinutes: string;
  /** Dollars as typed, for example `65` or `65.50`. */
  readonly price: string;
}

/** The service form, as typed. Everything is a string until validated. */
export interface TutorServiceInput {
  readonly subjectId: string;
  readonly displayName: string;
  readonly description: string;
  readonly yearLevelFrom: string;
  readonly yearLevelTo: string;
  readonly formatCode: string;
  readonly options: readonly ServiceOptionInput[];
}

export interface ValidatedServiceOption {
  readonly durationMinutes: number;
  readonly priceAmountMinor: bigint;
}

export interface ValidatedTutorService {
  readonly subjectId: string;
  readonly displayName: string;
  readonly description: string;
  readonly yearLevelFrom: number;
  readonly yearLevelTo: number;
  readonly formatCode: ServiceFormatCode;
  /** Shortest first, one per length. */
  readonly options: readonly ValidatedServiceOption[];
}

export const EMPTY_TUTOR_SERVICE: TutorServiceInput = {
  subjectId: '',
  displayName: '',
  description: '',
  yearLevelFrom: '',
  yearLevelTo: '',
  formatCode: 'online',
  options: [{ durationMinutes: '60', price: '' }],
};

/**
 * Dollars as typed, to minor units. INTEGERS ONLY: the string is split on the
 * decimal point and never passes through a float, because 65.10 * 100 is not
 * 6510 in binary floating point.
 */
export function parsePriceToMinor(value: string): bigint | null {
  const trimmed = value.trim().replace(/^\$/, '');
  const match = /^(\d{1,5})(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (match === null) return null;
  const dollars = BigInt(match[1] ?? '0');
  const cents = BigInt((match[2] ?? '').padEnd(2, '0') || '0');
  return dollars * 100n + cents;
}

/** Minor units back to what the form shows: `65` or `65.50`. */
export function priceInputFromMinor(amountMinor: bigint): string {
  const dollars = amountMinor / 100n;
  const cents = amountMinor % 100n;
  return cents === 0n
    ? dollars.toString()
    : `${dollars.toString()}.${cents.toString().padStart(2, '0')}`;
}

function integerYear(value: string): number | null {
  if (!/^\d{1,2}$/.test(value.trim())) return null;
  const year = Number(value.trim());
  return year >= YEAR_LEVEL_MIN && year <= YEAR_LEVEL_MAX ? year : null;
}

/**
 * Validate a COMPLETE service, as is required to submit it for review.
 *
 * Saving a draft runs the same validation, unlike an application: a service is a
 * short form, and a draft that could not be submitted is not worth keeping.
 *
 * `offers` is what the tutor's PROFILE says they do. A service cannot promise a
 * format the profile does not, or discovery would list a tutor as online-only
 * while selling an in-person lesson.
 */
export function validateTutorService(
  input: TutorServiceInput,
  context: {
    readonly knownSubjectIds: readonly string[];
    readonly offersOnline: boolean;
    readonly offersInPerson: boolean;
  },
): CommandResult<ValidatedTutorService> {
  const issues: Record<string, string> = {};

  const subjectId = input.subjectId.trim();
  if (subjectId === '' || !context.knownSubjectIds.includes(subjectId)) {
    issues['subjectId'] = 'Choose the subject this service teaches.';
  }

  const displayName = input.displayName.trim();
  if (displayName.length < NAME_MIN || displayName.length > NAME_MAX) {
    issues['displayName'] =
      `Give the service a name of ${String(NAME_MIN)} to ${String(NAME_MAX)} characters.`;
  }

  const description = input.description.trim();
  if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) {
    issues['description'] =
      `Describe what a family gets, in ${String(DESCRIPTION_MIN)} to ${String(DESCRIPTION_MAX)} characters.`;
  }

  const yearLevelFrom = integerYear(input.yearLevelFrom);
  const yearLevelTo = integerYear(input.yearLevelTo);
  if (yearLevelFrom === null) issues['yearLevelFrom'] = 'Choose the youngest year level.';
  if (yearLevelTo === null) issues['yearLevelTo'] = 'Choose the oldest year level.';
  if (yearLevelFrom !== null && yearLevelTo !== null && yearLevelFrom > yearLevelTo) {
    issues['yearLevelTo'] = 'The oldest year level cannot be below the youngest.';
  }

  const formatCode = input.formatCode.trim();
  if (!(SERVICE_FORMAT_CODES as readonly string[]).includes(formatCode)) {
    issues['formatCode'] = 'Choose how this service is taught.';
  } else if (
    (formatCode === 'online' && !context.offersOnline) ||
    (formatCode === 'in_person' && !context.offersInPerson) ||
    (formatCode === 'either' && !(context.offersOnline && context.offersInPerson))
  ) {
    issues['formatCode'] =
      'Your profile does not offer this format. Change your profile first, then this service.';
  }

  const options: ValidatedServiceOption[] = [];
  const typed = input.options.filter(
    (option) => option.durationMinutes.trim() !== '' || option.price.trim() !== '',
  );
  if (typed.length === 0) {
    issues['options'] = 'Add at least one lesson length and its price.';
  } else if (typed.length > SERVICE_OPTIONS_MAX) {
    issues['options'] = `A service can have up to ${String(SERVICE_OPTIONS_MAX)} lesson lengths.`;
  } else {
    const seen = new Set<number>();
    typed.forEach((option, index) => {
      const duration = Number(option.durationMinutes.trim());
      if (!(SERVICE_DURATION_MINUTES as readonly number[]).includes(duration)) {
        issues[`options.${String(index)}.durationMinutes`] = 'Choose a lesson length.';
        return;
      }
      if (seen.has(duration)) {
        issues[`options.${String(index)}.durationMinutes`] =
          'Each lesson length can only be listed once.';
        return;
      }
      seen.add(duration);
      const price = parsePriceToMinor(option.price);
      if (price === null || price < SERVICE_PRICE_MIN_MINOR || price > SERVICE_PRICE_MAX_MINOR) {
        issues[`options.${String(index)}.price`] =
          'Enter a price between $10 and $500, for example 65 or 65.50.';
        return;
      }
      options.push({ durationMinutes: duration, priceAmountMinor: price });
    });
  }

  if (Object.keys(issues).length > 0) {
    return fail(domainError('VALIDATION_FAILED', 'The service is incomplete.', issues));
  }

  return ok({
    subjectId,
    displayName,
    description,
    yearLevelFrom: yearLevelFrom!,
    yearLevelTo: yearLevelTo!,
    formatCode: formatCode as ServiceFormatCode,
    options: options.sort((a, b) => a.durationMinutes - b.durationMinutes),
  });
}

// ---------------------------------------------------------------------------
// Going on sale
// ---------------------------------------------------------------------------

export const TUTOR_SERVICE_RULE_KEYS = {
  /**
   * Whether a tutor must be able to RECEIVE PAYMENTS before a service can be
   * published. True by default: a family who chooses a tutor Stripe cannot pay
   * reaches the payment step and is refused there, which is the worst place to
   * find out.
   */
  publicationRequiresPayouts: 'services.publication_requires_payout_readiness',
} as const;

/**
 * FAILS CLOSED. Only a stored literal `false` relaxes the rule; a missing,
 * malformed or unexpected value keeps it on.
 */
export function publicationRequiresPayouts(value: unknown): boolean {
  return value !== false;
}

/** Tutor profile states that may put a service on sale. */
export const PUBLISHING_PROFILE_STATUSES = ['approved', 'active'] as const;

export type PublicationBlocker =
  'profile_not_eligible' | 'service_not_reviewed' | 'no_priced_option' | 'payouts_not_ready';

export type PublicationReadiness =
  | { readonly ready: true }
  | { readonly ready: false; readonly blockers: readonly PublicationBlocker[] };

/**
 * May this service go on sale now? (Database spec §8.2: publishing validates
 * tutor eligibility, price and payment rules.)
 *
 * Asked again inside the publishing transaction, under a lock, from values read
 * there. A screen's opinion of readiness is a courtesy, not the gate.
 */
export function publicationReadiness(facts: {
  readonly profileStatus: string;
  readonly serviceStatus: string;
  readonly pricedOptionCount: number;
  readonly payoutsRequired: boolean;
  readonly canReceivePayments: boolean;
}): PublicationReadiness {
  const blockers: PublicationBlocker[] = [];
  if (!(PUBLISHING_PROFILE_STATUSES as readonly string[]).includes(facts.profileStatus)) {
    blockers.push('profile_not_eligible');
  }
  if (!(PUBLISHABLE_SERVICE_STATUSES as readonly string[]).includes(facts.serviceStatus)) {
    blockers.push('service_not_reviewed');
  }
  if (facts.pricedOptionCount < 1) blockers.push('no_priced_option');
  if (facts.payoutsRequired && !facts.canReceivePayments) blockers.push('payouts_not_ready');
  return blockers.length === 0 ? { ready: true } : { ready: false, blockers };
}
