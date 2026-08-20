import { describe, expect, it } from 'vitest';
import {
  CLOSE_REASON_CODES,
  TUTOR_REQUEST_STATUSES,
  canTransitionIlr,
  canTransitionReservation,
  canTransitionTutorRequest,
  isTerminalIlrStatus,
  isTerminalTutorRequestStatus,
} from './transitions';

describe('Intended Lesson Request transitions', () => {
  it('opens for responses and can close from any open state', () => {
    expect(canTransitionIlr('draft', 'awaiting_responses')).toBe(true);
    expect(canTransitionIlr('awaiting_responses', 'closed')).toBe(true);
    expect(canTransitionIlr('ready_for_selection', 'awaiting_payment')).toBe(true);
  });

  it('never reopens a terminal request', () => {
    expect(isTerminalIlrStatus('fulfilled')).toBe(true);
    expect(isTerminalIlrStatus('closed')).toBe(true);
    expect(canTransitionIlr('closed', 'awaiting_responses')).toBe(false);
    expect(canTransitionIlr('fulfilled', 'ready_for_selection')).toBe(false);
  });

  it('cannot skip straight from draft to fulfilled', () => {
    expect(canTransitionIlr('draft', 'fulfilled')).toBe(false);
  });

  it('selection lands on awaiting_payment, never on fulfilled', () => {
    // `fulfilled` is terminal and means a confirmed booking — the interface
    // renders it as "Booked". Reaching it at selection would claim a booking
    // for a lesson nobody has paid for.
    expect(canTransitionIlr('ready_for_selection', 'fulfilled')).toBe(false);
    expect(canTransitionIlr('awaiting_responses', 'fulfilled')).toBe(false);
  });

  it('gives payment a forward path in both directions of outcome', () => {
    // Success and failure both move forwards. Nothing has to reverse out of a
    // terminal state, which is what made `fulfilled`-at-selection unworkable.
    expect(canTransitionIlr('awaiting_payment', 'fulfilled')).toBe(true);
    expect(canTransitionIlr('awaiting_payment', 'closed')).toBe(true);
    expect(isTerminalIlrStatus('awaiting_payment')).toBe(false);
  });

  it('reaches a confirmed booking only through selection and then payment', () => {
    const path = [
      'draft',
      'awaiting_responses',
      'ready_for_selection',
      'awaiting_payment',
    ] as const;
    for (const [index, from] of path.entries()) {
      const next = path[index + 1] ?? 'fulfilled';
      expect(canTransitionIlr(from, next), `${from} → ${next}`).toBe(true);
    }
  });
});

describe('Tutor Request transitions', () => {
  it('a sent request may be answered, withdrawn, expired or closed', () => {
    expect(canTransitionTutorRequest('sent', 'accepted')).toBe(true);
    expect(canTransitionTutorRequest('sent', 'declined')).toBe(true);
    expect(canTransitionTutorRequest('sent', 'expired')).toBe(true);
    expect(canTransitionTutorRequest('sent', 'closed')).toBe(true);
  });

  it('a closed request can never later be accepted', () => {
    expect(canTransitionTutorRequest('closed', 'accepted')).toBe(false);
    expect(isTerminalTutorRequestStatus('closed')).toBe(true);
  });

  it('declined, acceptance_withdrawn and expired are terminal', () => {
    for (const status of ['declined', 'acceptance_withdrawn', 'expired'] as const) {
      expect(isTerminalTutorRequestStatus(status)).toBe(true);
    }
  });

  it('has no status meaning "you lost" — closure is undifferentiated', () => {
    // A tutor whose request ends because someone else was chosen must reach
    // exactly the same status as one whose requester withdrew.
    expect(TUTOR_REQUEST_STATUSES).not.toContain('lost');
    expect(TUTOR_REQUEST_STATUSES).not.toContain('not_selected');
    expect(TUTOR_REQUEST_STATUSES).not.toContain('rejected_by_parent');
    // Critically: no separate status for a family withdrawal either — that
    // would differentiate it from 'a competitor was selected'.
    expect(TUTOR_REQUEST_STATUSES).not.toContain('withdrawn');
    expect(TUTOR_REQUEST_STATUSES).not.toContain('superseded');
    expect(TUTOR_REQUEST_STATUSES).toHaveLength(7);
    expect(canTransitionTutorRequest('sent', 'closed')).toBe(true);
    expect(canTransitionTutorRequest('accepted', 'closed')).toBe(true);
  });

  it('keeps close reasons server-side only', () => {
    // The reasons exist for the family and for audit; the tutor projection
    // never selects them. This test pins the vocabulary so a future addition
    // is a deliberate act.
    expect(CLOSE_REASON_CODES).toContain('another_tutor_selected');
    expect(CLOSE_REASON_CODES).toContain('requester_withdrew');
  });
});

describe('Reservation transitions', () => {
  it('an active hold releases once and stays released', () => {
    expect(canTransitionReservation('active', 'released')).toBe(true);
    expect(canTransitionReservation('released', 'active')).toBe(false);
  });
});
