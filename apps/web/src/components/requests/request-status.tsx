import { StatusBadge, type StatusFamily } from '@studdy/design-system';
import type { ReactNode } from 'react';

/**
 * Status presentation for the request slice.
 *
 * The family view and the tutor view use DIFFERENT label maps. A tutor must
 * never see a label that distinguishes "another tutor was selected" from "the
 * family withdrew" — every ending reads the same to them.
 */

const FAMILY_TUTOR_REQUEST_LABELS: Record<string, { label: string; family: StatusFamily }> = {
  sent: { label: 'Awaiting response', family: 'pending' },
  accepted: { label: 'Accepted', family: 'active' },
  selected: { label: 'You chose this tutor', family: 'complete' },
  declined: { label: 'Declined', family: 'cancelled' },
  expired: { label: 'No response in time', family: 'overdue' },
  acceptance_withdrawn: { label: 'Tutor withdrew', family: 'cancelled' },
  closed: { label: 'Closed', family: 'archived' },
};

/**
 * The family may see WHY a request closed — it is their own request. The
 * reason lives in `close_reason_code`, which the family projection selects and
 * the tutor projection deliberately does not. Same status, different audience.
 */
const FAMILY_CLOSE_REASON_LABELS: Record<string, { label: string; family: StatusFamily }> = {
  requester_withdrew: { label: 'Withdrawn by you', family: 'cancelled' },
  request_expired: { label: 'Request expired', family: 'overdue' },
  all_tutors_declined: { label: 'Closed', family: 'archived' },
  another_tutor_selected: { label: 'You chose another tutor', family: 'archived' },
  // The family let their own window run out. Saying so plainly is the point:
  // "Closed" would leave them guessing why a tutor they had secured vanished.
  // The same close reason renders to that tutor as the generic ending.
  selection_window_lapsed: { label: 'You did not choose in time', family: 'overdue' },
  payment_window_lapsed: { label: 'Payment window passed', family: 'overdue' },
};

const FAMILY_REQUEST_LABELS: Record<string, { label: string; family: StatusFamily }> = {
  draft: { label: 'Draft', family: 'pending' },
  awaiting_responses: { label: 'Awaiting responses', family: 'pending' },
  ready_for_selection: { label: 'Ready to choose', family: 'awaiting_action' },
  // Chosen but not yet paid. "Booked" is reserved for a confirmed booking, so
  // this must not borrow it — a family told they are booked before payment
  // would be told something untrue.
  awaiting_payment: { label: 'Payment next', family: 'awaiting_action' },
  fulfilled: { label: 'Booked', family: 'complete' },
  closed: { label: 'Closed', family: 'archived' },
};

/**
 * Tutor-facing labels. Every terminal state that is not "you declined" reads
 * as a single neutral outcome, so closure never reveals why.
 */
const TUTOR_REQUEST_LABELS: Record<string, { label: string; family: StatusFamily }> = {
  sent: { label: 'Awaiting your response', family: 'awaiting_action' },
  accepted: { label: 'You accepted', family: 'active' },
  // The chosen tutor. Without this the winner fell through to "Closed — no
  // longer available", which is the safe direction but plainly false: their
  // time is held and the lesson is going ahead pending payment.
  selected: { label: 'You were chosen', family: 'complete' },
  // Tutor-driven endings: the tutor already knows these, so they stay distinct.
  declined: { label: 'You declined', family: 'cancelled' },
  acceptance_withdrawn: { label: 'You withdrew your acceptance', family: 'cancelled' },
  expired: { label: 'Closed — no longer available', family: 'archived' },
  // Family-side and system-side endings are ONE indistinguishable outcome.
  closed: { label: 'Closed — no longer available', family: 'archived' },
  // `selected` is never rendered here: the selection slice replaces it with
  // the confirmed booking view. Falling through to the neutral label is the
  // safe default if it ever appears.
};

export function FamilyRequestStatus({
  statusCode,
  closeReasonCode = null,
}: {
  statusCode: string;
  closeReasonCode?: string | null;
}): ReactNode {
  // The request is theirs, so a closed one says why. A selection or payment
  // window that ran out is exactly the case where a bare "Closed" would leave
  // a family unable to tell what happened to a tutor they had already secured.
  const entry =
    statusCode === 'closed' && closeReasonCode !== null
      ? (FAMILY_CLOSE_REASON_LABELS[closeReasonCode] ?? FAMILY_REQUEST_LABELS['closed']!)
      : (FAMILY_REQUEST_LABELS[statusCode] ?? {
          label: statusCode,
          family: 'archived' as const,
        });
  return <StatusBadge family={entry.family}>{entry.label}</StatusBadge>;
}

export function FamilyTutorRequestStatus({
  statusCode,
  closeReasonCode = null,
}: {
  statusCode: string;
  closeReasonCode?: string | null;
}): ReactNode {
  // For a closed request the family sees the reason; the tutor never does.
  const entry =
    statusCode === 'closed' && closeReasonCode !== null
      ? (FAMILY_CLOSE_REASON_LABELS[closeReasonCode] ?? FAMILY_TUTOR_REQUEST_LABELS['closed']!)
      : (FAMILY_TUTOR_REQUEST_LABELS[statusCode] ?? {
          label: statusCode,
          family: 'archived' as const,
        });
  return <StatusBadge family={entry.family}>{entry.label}</StatusBadge>;
}

export function TutorRequestStatus({ statusCode }: { statusCode: string }): ReactNode {
  const entry = TUTOR_REQUEST_LABELS[statusCode] ?? {
    label: 'Closed — no longer available',
    family: 'archived' as const,
  };
  return <StatusBadge family={entry.family}>{entry.label}</StatusBadge>;
}

/** Long-form date used across the request screens (doc 01 §16). */
export function formatLessonDateTime(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-NZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  }).format(value);
}

export function formatDeadline(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-NZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  }).format(value);
}

export function formatMoney(amountMinor: bigint, currencyCode: string): string {
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: currencyCode,
  }).format(Number(amountMinor) / 100);
}
