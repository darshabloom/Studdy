import 'server-only';
import { expireOverdueRequests } from '@studdy/database';
import { createLogger } from '@studdy/observability';
import { newCorrelationId } from '@studdy/observability';

/**
 * One expiry sweep, with its logging and its correlation id.
 *
 * TWO DOORS, ONE COMMAND. The scheduler calls this, and so does the manual
 * `POST /api/jobs/expire-requests` route kept for operations. Neither is a
 * source of truth: both authenticate their own caller and then invoke
 * `expireOverdueRequests`, which owns every rule about what is overdue, what
 * closes and which holds are released.
 *
 * This wrapper exists so the two doors cannot drift. Before it, the route
 * carried the correlation id, the batch size and the log shape inline; adding a
 * second caller would have meant a second copy of all three, and the first time
 * one changed the other would have started reporting something subtly different
 * about the same sweep.
 *
 * IT ADDS NO SCHEDULER-SPECIFIC LOCKING, deliberately. Overlapping runs are
 * already safe: `expireOverdueRequests` selects due rows `FOR UPDATE SKIP
 * LOCKED`, every UPDATE is status-guarded, and the whole sweep is one
 * transaction — so a second run finds nothing left to do rather than
 * double-releasing a hold or writing a second close event. A lock here would
 * duplicate a guarantee the repository already gives, and would be the thing
 * that broke when the repository's own guarantee changed.
 */

/** How many due requests one sweep will take. Matches the route's original. */
const BATCH_SIZE = 200;

export interface ExpirySweepOutcome {
  readonly correlationId: string;
  readonly expiredTutorRequests: number;
  readonly closedIntendedLessonRequests: number;
  readonly releasedHolds: number;
  readonly durationMs: number;
}

export async function runExpirySweep(
  correlationId: string = newCorrelationId(),
): Promise<ExpirySweepOutcome> {
  const logger = createLogger({ job: 'expire-requests' });
  const startedAt = Date.now();

  try {
    const result = await expireOverdueRequests({ correlationId, batchSize: BATCH_SIZE });
    const outcome: ExpirySweepOutcome = {
      correlationId,
      ...result,
      durationMs: Date.now() - startedAt,
    };

    /*
     * COUNTS AND TIMING ONLY. Never a reference, a tutor, a student, a family
     * or any request detail. Operations reads this, not a tutor — but keeping
     * request data out of log aggregation entirely is cheaper than deciding,
     * per line, who might eventually read it.
     */
    logger.info('expiry run complete', {
      correlationId: outcome.correlationId,
      expiredTutorRequests: outcome.expiredTutorRequests,
      closedIntendedLessonRequests: outcome.closedIntendedLessonRequests,
      releasedHolds: outcome.releasedHolds,
      durationMs: outcome.durationMs,
    });

    return outcome;
  } catch (error) {
    logger.error('expiry run failed', {
      correlationId,
      durationMs: Date.now() - startedAt,
      // Message only: no request payload, no identifiers.
      message: error instanceof Error ? error.message : 'unknown error',
    });
    throw error;
  }
}
