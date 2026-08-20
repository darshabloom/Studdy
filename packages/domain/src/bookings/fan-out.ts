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
  /**
   * The times the family would accept, as start instants (D-3). A request
   * carries several so a tutor has something to say yes to without a
   * negotiation, and so one tutor's full diary does not end the conversation.
   */
  readonly proposedStarts: readonly Date[];
  readonly durationMinutes: number;
  readonly formatCode: string;
  /** Whether the requester currently has a usable payment method on file. */
  readonly hasPaymentMethodOnFile: boolean;
  /** An approved exemption: free trial, organisation funding, admin approval. */
  readonly paymentExemptionCode: string | null;
}

export interface ValidatedFanOut {
  readonly targets: readonly FanOutTarget[];
  readonly durationMinutes: number;
  /** Chronological and de-duplicated, ready to be written as positions 1..n. */
  readonly proposedStarts: readonly Date[];
}

/**
 * Validate a fan-out before anything is written.
 *
 * Fan-out is ALL-OR-NOTHING (approved decision 8): this returns a single
 * failure for the whole command rather than silently dropping a tutor.
 *
 * Which of the offered times each tutor can actually do is decided against
 * live availability by the caller, not here — see `offeredSubset`. Nothing is
 * held at send any more (D-1): a request is a question, and holding three
 * tutors' calendars on speculation was taking real bookable time from people
 * who had not yet agreed to anything.
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

  if (input.durationMinutes <= 0) {
    issues['durationMinutes'] = 'The lesson must have a length.';
  }

  // De-duplicate before counting: two identical times are one choice, and
  // counting them as two would let a family satisfy the minimum without
  // actually offering a tutor any alternative.
  const uniqueStarts = [
    ...new Map(input.proposedStarts.map((at) => [at.getTime(), at])).values(),
  ].sort((a, b) => a.getTime() - b.getTime());

  if (uniqueStarts.length < rules.minTimeOptions) {
    issues['times'] =
      `Choose at least ${rules.minTimeOptions} different times so tutors have a choice.`;
  }
  if (uniqueStarts.length > rules.maxTimeOptions) {
    issues['times'] = `Choose no more than ${rules.maxTimeOptions} times.`;
  }

  // Every offered time must stand on its own: a tutor may accept any of them,
  // so one that is already too close is not a lesser option, it is an invalid
  // one.
  for (const startAt of uniqueStarts) {
    if (startAt.getTime() <= now.getTime()) {
      issues['times'] = 'Every time you choose must be in the future.';
      break;
    }
    const hoursUntil = (startAt.getTime() - now.getTime()) / MS_PER_HOUR;
    if (hoursUntil < rules.minimumNoticeHours) {
      issues['times'] =
        `Every time must be at least ${rules.minimumNoticeHours} hours from now so tutors have time to respond.`;
      break;
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

  return ok({
    targets: input.targets,
    durationMinutes: input.durationMinutes,
    proposedStarts: uniqueStarts,
  });
}

/** Slot positions are 1..N in the order the requester chose the tutors. */
export function assignPositions(
  targets: readonly FanOutTarget[],
): ReadonlyArray<FanOutTarget & { position: number }> {
  return targets.map((target, index) => ({ ...target, position: index + 1 }));
}

/**
 * The times one tutor is actually offered: the family's chosen times that this
 * tutor can genuinely do, in the family's order.
 *
 * A tutor is asked only about times they could accept, so "no longer
 * available" never has to stand in for "we asked you about a time you were
 * never free for". A tutor whose subset is empty is not sent a request at all
 * (D-2) — an unanswerable request is worse than no request, and it would leak
 * that the family asked without giving them anything to say yes to.
 */
export function offeredSubset(
  proposedStarts: readonly Date[],
  tutorBookableStarts: readonly Date[],
): readonly Date[] {
  const bookable = new Set(tutorBookableStarts.map((at) => at.getTime()));
  return proposedStarts.filter((at) => bookable.has(at.getTime()));
}

/** A tutor's slot was taken between validation and the write. */
export function slotUnavailableError(tutorDisplayName: string): DomainError {
  return domainError('PRECONDITION_FAILED', 'Tutor slot unavailable', {
    issues: {
      targets: `${tutorDisplayName} is no longer free at that time. Nothing has been sent — choose another time or another tutor.`,
    },
  });
}
