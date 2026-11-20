import type { ApplicationCheckStatus } from '@studdy/domain/tutors';

/** Serialisable server-action outcome. Never includes private applicant details. */
export interface ReviewCheckState {
  readonly sequence: number;
  readonly outcome: 'idle' | 'saved' | 'invalid' | 'unavailable';
  readonly recordedStatus: ApplicationCheckStatus | null;
}

export const INITIAL_REVIEW_CHECK_STATE: ReviewCheckState = {
  sequence: 0,
  outcome: 'idle',
  recordedStatus: null,
};
