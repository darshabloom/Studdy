/**
 * Status vocabularies and allowed transitions for the request slice.
 *
 * These are the approved 5/7/2 state machines (Booking's 4 arrive with the
 * selection slice). There is deliberately no database trigger: every command
 * guards its own transition with a status-named
 * `UPDATE ... WHERE status_code IN (...)`, which enforces the same rule at the
 * point of change, and integration tests are the authoritative protection.
 */

export const ILR_STATUSES = [
  'draft',
  'awaiting_responses',
  'ready_for_selection',
  'fulfilled',
  'closed',
] as const;

export type IlrStatus = (typeof ILR_STATUSES)[number];

/**
 * The approved seven Tutor Request states.
 *
 * THE PRIVACY BOUNDARY IS EXPRESSED IN THIS ENUM, not merely in the labels.
 *
 * Every family-side and system-side closure collapses into the single status
 * `closed` — the family withdrew this request, the family withdrew the whole
 * request, a competitor was selected, the request expired after another tutor
 * accepted, or the winner's payment window lapsed. The real reason lives in
 * `close_reason_code`, which is server-only and never projected to a tutor.
 *
 * If "withdrawn by family" and "not selected" were distinct statuses, the
 * status alone would tell a tutor that a competitor existed.
 *
 * Tutor-driven terminals stay distinct because the tutor already knows them:
 * `declined` and `acceptance_withdrawn` are the tutor's own acts, and
 * `expired` is their own inaction.
 */
export const TUTOR_REQUEST_STATUSES = [
  'sent',
  'accepted',
  /** The chosen tutor. Set by the selection slice. */
  'selected',
  'declined',
  'expired',
  /** The tutor withdrew their own acceptance (Doc 04 §26 reliability). */
  'acceptance_withdrawn',
  /** Every family-side and system-side ending, indistinguishably. */
  'closed',
] as const;

export type TutorRequestStatus = (typeof TUTOR_REQUEST_STATUSES)[number];

export const RESERVATION_STATUSES = ['active', 'released'] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/**
 * Statuses in which a Tutor Request still occupies a slot and a hold.
 * `selected` is included: the winner keeps its slot and its reservation.
 */
export const LIVE_TUTOR_REQUEST_STATUSES: readonly TutorRequestStatus[] = [
  'sent',
  'accepted',
  'selected',
];

/** Statuses in which an ILR is still open for responses or selection. */
export const OPEN_ILR_STATUSES: readonly IlrStatus[] = [
  'awaiting_responses',
  'ready_for_selection',
];

const ILR_TRANSITIONS: Record<IlrStatus, readonly IlrStatus[]> = {
  draft: ['awaiting_responses', 'closed'],
  awaiting_responses: ['ready_for_selection', 'fulfilled', 'closed'],
  ready_for_selection: ['fulfilled', 'closed'],
  fulfilled: [],
  closed: [],
};

const TUTOR_REQUEST_TRANSITIONS: Record<TutorRequestStatus, readonly TutorRequestStatus[]> = {
  sent: ['accepted', 'declined', 'expired', 'closed'],
  // Selection and acceptance-withdrawal land with their own slices.
  accepted: ['selected', 'acceptance_withdrawn', 'expired', 'closed'],
  // The winner. Payment failure closes it rather than reopening anything.
  selected: ['closed'],
  declined: [],
  expired: [],
  acceptance_withdrawn: [],
  closed: [],
};

const RESERVATION_TRANSITIONS: Record<ReservationStatus, readonly ReservationStatus[]> = {
  active: ['released'],
  released: [],
};

export function canTransitionIlr(from: IlrStatus, to: IlrStatus): boolean {
  return ILR_TRANSITIONS[from].includes(to);
}

export function canTransitionTutorRequest(
  from: TutorRequestStatus,
  to: TutorRequestStatus,
): boolean {
  return TUTOR_REQUEST_TRANSITIONS[from].includes(to);
}

export function canTransitionReservation(from: ReservationStatus, to: ReservationStatus): boolean {
  return RESERVATION_TRANSITIONS[from].includes(to);
}

/** Terminal states never transition again — a closed request cannot reopen. */
export function isTerminalTutorRequestStatus(status: TutorRequestStatus): boolean {
  return TUTOR_REQUEST_TRANSITIONS[status].length === 0;
}

export function isTerminalIlrStatus(status: IlrStatus): boolean {
  return ILR_TRANSITIONS[status].length === 0;
}

/**
 * Close reasons are recorded server-side for the requesting family's benefit
 * and for audit. They are NEVER rendered to a tutor: distinguishing "another
 * tutor was selected" from "the family withdrew" would leak the existence of
 * competitors. Every one of these produces the status `closed`.
 */
export const CLOSE_REASON_CODES = [
  'requester_withdrew',
  'request_expired',
  'all_tutors_declined',
  'another_tutor_selected',
  'payment_window_lapsed',
] as const;

export type CloseReasonCode = (typeof CLOSE_REASON_CODES)[number];
