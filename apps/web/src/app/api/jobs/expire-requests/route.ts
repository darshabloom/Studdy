import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createLogger } from '@studdy/observability';
import { runExpirySweep } from '@/lib/jobs/expire-requests';

/**
 * Scheduled expiry of overdue tutor requests.
 *
 * This handler does TWO things only: authenticate the scheduler, and invoke
 * the business command. All expiry logic — which requests are due, how holds
 * are released, what is written and in what transaction — lives in
 * `expireOverdueRequests`, which knows nothing about HTTP or any scheduler.
 *
 * THE MANUAL AND OPERATIONS DOOR. Inngest now runs this sweep automatically
 * every minute (`src/inngest/functions/expire-requests.ts`); this route stays
 * so a human can force a sweep — after an incident, while the scheduler is
 * paused, or to reproduce a report — without waiting for the next tick.
 *
 * IT IS NOT A SECOND SCHEDULER. Nothing invokes it on a timer: the Vercel Cron
 * schedule was removed because the Hobby plan allows once-daily execution only,
 * far too coarse for hour-based deadlines and minute-based payment windows, and
 * it has not been reinstated. There is one production scheduler.
 *
 * Both doors call the same `runExpirySweep`, so neither can report something
 * different about the same sweep. See documentation/operations/scheduled-jobs.md.
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

  try {
    // Correlation id, batch size and the log shape all live in the runner, so
    // this door and the scheduler describe the same sweep the same way.
    const { correlationId, durationMs, ...counts } = await runExpirySweep();
    return NextResponse.json({ ok: true, correlationId, durationMs, ...counts });
  } catch {
    // The runner has already logged the failure with its correlation id; the
    // response says only that it failed.
    return NextResponse.json({ error: 'expiry_failed' }, { status: 500 });
  }
}

/** GET is refused: expiry mutates state and must not be triggerable by a link. */
export function GET(): NextResponse {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}
