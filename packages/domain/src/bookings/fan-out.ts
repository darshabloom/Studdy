import { domainError, type DomainError } from '../core/errors';
import { fail, ok, type CommandResult } from '../core/result';
import type { RequestRules } from './request-rules';

const MS_PER_HOUR = 60 * 60 * 1000;

/** One tutor being invited, with the exact priced version they are asked about. */
export interface FanOutTarget {
  readonly tutorProfileId: string;
  readonly serviceVersionId: string;
}

export interface FanOutInput {
  readonly targets: readonly FanOutTarget[];
  readonly proposedStartAt: Date;
  readonly proposedEndAt: Date;
  readonly formatCode: string;
  /** Whether the requester currently has a usable payment method on file. */
  readonly hasPaymentMethodOnFile: boolean;
  /** An approved exemption: free trial, organisation funding, admin approval. */
  readonly paymentExemptionCode: string | null;
}

export interface ValidatedFanOut {
  readonly targets: readonly FanOutTarget[];
  readonly durationMinutes: number;
}

/**
 * Validate a fan-out before anything is written.
 *
 * Fan-out is ALL-OR-NOTHING (approved decision 8): this returns a single
 * failure for the whole command rather than silently dropping a tutor. Slot
 * availability is not checked here — it is enforced by the database exclusion
 * constraint inside the transaction, because only the database can decide it
 * without a race.
 */
export function validateFanOut(
  rules: RequestRules,
  input: FanOutInput,
  now: Date,
): CommandResult<ValidatedFanOut> {
  const issues: Record<string, string> = {};

  if (input.targets.length === 0) {
    issues['targets'] = 'Choose at least one tutor to send this request to.';
  }
  if (input.targets.length > rules.fanOutCap) {
    issues['targets'] = `You can send this request to at most ${rules.fanOutCap} tutors.`;
  }

  const tutorIds = input.targets.map((target) => target.tutorProfileId);
  if (new Set(tutorIds).size !== tutorIds.length) {
    issues['targets'] = 'Each tutor can only be asked once for the same lesson.';
  }

  if (input.proposedEndAt.getTime() <= input.proposedStartAt.getTime()) {
    issues['proposedEndAt'] = 'The lesson must end after it starts.';
  }

  if (input.proposedStartAt.getTime() <= now.getTime()) {
    issues['proposedStartAt'] = 'Choose a lesson time in the future.';
  } else {
    const hoursUntil = (input.proposedStartAt.getTime() - now.getTime()) / MS_PER_HOUR;
    if (hoursUntil < rules.minimumNoticeHours) {
      issues['proposedStartAt'] =
        `Choose a time at least ${rules.minimumNoticeHours} hours from now so tutors have time to respond.`;
    }
  }

  if (input.formatCode !== 'online' && input.formatCode !== 'in_person') {
    issues['formatCode'] = 'Choose whether the lesson is online or in person.';
  }

  // Card-on-file gate. The approved policy requires a payment method before
  // requests are sent, but the rule stays disabled until the Stripe slice
  // provides a real way to add one — enabling it sooner would block every
  // request with no way to satisfy it.
  if (
    rules.requirePaymentMethodBeforeSend &&
    !input.hasPaymentMethodOnFile &&
    input.paymentExemptionCode === null
  ) {
    issues['paymentMethod'] =
      'Add a payment method before sending requests. You will not be charged now — payment happens only after you choose a tutor.';
  }

  if (Object.keys(issues).length > 0) {
    return fail(domainError('VALIDATION_FAILED', 'Fan-out validation failed', { issues }));
  }

  const durationMinutes = Math.round(
    (input.proposedEndAt.getTime() - input.proposedStartAt.getTime()) / 60000,
  );

  return ok({ targets: input.targets, durationMinutes });
}

/** Slot positions are 1..N in the order the requester chose the tutors. */
export function assignPositions(
  targets: readonly FanOutTarget[],
): ReadonlyArray<FanOutTarget & { position: number }> {
  return targets.map((target, index) => ({ ...target, position: index + 1 }));
}

/** A tutor's slot was taken between validation and the write. */
export function slotUnavailableError(tutorDisplayName: string): DomainError {
  return domainError('PRECONDITION_FAILED', 'Tutor slot unavailable', {
    issues: {
      targets: `${tutorDisplayName} is no longer free at that time. Nothing has been sent — choose another time or another tutor.`,
    },
  });
}
