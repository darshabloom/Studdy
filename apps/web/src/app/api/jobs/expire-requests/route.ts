import { randomUUID, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { expireOverdueRequests } from '@studdy/database';
import { createLogger } from '@studdy/observability';

/**
 * Scheduled expiry of overdue tutor requests.
 *
 * This handler does TWO things only: authenticate the scheduler, and invoke
 * the business command. All expiry logic — which requests are due, how holds
 * are released, what is written and in what transaction — lives in
 * `expireOverdueRequests`, which knows nothing about HTTP or any scheduler.
 * Vercel Cron calls it today; Inngest can call the same function later with no
 * change to the domain.
 *
 * Authentication: a server-only shared secret in the `Authorization` header,
 * never a query string (query strings land in access logs, browser history and
 * referrer headers). Compared with a timing-safe equality check.
 */
export const dynamic = 'force-dynamic';

const logger = createLogger({ job: 'expire-requests' });

function isAuthorised(request: Request): boolean {
  const configured = process.env.CRON_SECRET;
  if (configured === undefined || configured.length === 0) return false;

  const header = request.headers.get('authorization');
  if (header === null) return false;

  const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : header;
  const expected = Buffer.from(configured);
  const actual = Buffer.from(provided);
  // timingSafeEqual requires equal lengths; compare lengths first without
  // short-circuiting on content.
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isAuthorised(request)) {
    // Deliberately uninformative: no hint about whether the secret is unset,
    // malformed or merely wrong.
    logger.warn('expiry run rejected');
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const correlationId = `cor_${randomUUID()}`;
  const startedAt = Date.now();

  try {
    const result = await expireOverdueRequests({ correlationId, batchSize: 200 });

    // Counts and timing only — never a reference, tutor, student, family or
    // any request detail. This log is read by operations, not by a tutor, but
    // the discipline stops request data reaching log aggregation at all.
    logger.info('expiry run complete', {
      correlationId,
      expiredTutorRequests: result.expiredTutorRequests,
      closedIntendedLessonRequests: result.closedIntendedLessonRequests,
      releasedHolds: result.releasedHolds,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.error('expiry run failed', {
      correlationId,
      durationMs: Date.now() - startedAt,
      // Message only: no request payload, no identifiers.
      message: error instanceof Error ? error.message : 'unknown error',
    });
    return NextResponse.json({ error: 'expiry_failed' }, { status: 500 });
  }
}

/** GET is refused: expiry mutates state and must not be triggerable by a link. */
export function GET(): NextResponse {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}
