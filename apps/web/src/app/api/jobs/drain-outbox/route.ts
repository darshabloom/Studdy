import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createLogger } from '@studdy/observability';
import { runOutboxDrain } from '@/lib/jobs/drain-outbox';

/**
 * Manual drain of the transactional outbox.
 *
 * THE SAME TWO THINGS THE EXPIRY DOOR DOES, and nothing else: authenticate the
 * caller, and invoke the business command. Who is owed what, what is rendered,
 * what is retried and what is settled all live in `runOutboxDrain` and the
 * repository beneath it, which know nothing about HTTP.
 *
 * WHY IT EXISTS, given Inngest already runs this every minute:
 *
 *   1. THE OPERATIONS DOOR, exactly as `/api/jobs/expire-requests` is. After an
 *      incident, while the scheduler is paused, or to push a stuck batch
 *      without waiting for the next tick.
 *   2. THE TEST DOOR. Inngest does not run in CI, so without this there is no
 *      way for an end-to-end test to observe the chain it is supposed to be
 *      proving. A test that cannot trigger the drain can only assert that
 *      nothing happened.
 *
 * IT IS NOT A SECOND SCHEDULER. Nothing invokes it on a timer, and nothing
 * should: there is one production scheduling mechanism and it is Inngest
 * (documentation/operations/scheduled-jobs.md). Both doors call the same
 * `runOutboxDrain`, so neither can report something different about the same
 * drain.
 *
 * Authentication: the server-only shared secret in the `Authorization` header,
 * never a query string — query strings land in access logs, browser history and
 * referrer headers. Timing-safe comparison. This mirrors SP-010 rather than
 * inventing a second scheme, because two slightly different hand-rolled checks
 * is how one of them ends up subtly wrong.
 */
export const dynamic = 'force-dynamic';

const logger = createLogger({ job: 'drain-outbox' });

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
    logger.warn('outbox drain rejected');
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  try {
    /*
     * COUNTS ONLY IN THE RESPONSE. Never an address, a subject line or a
     * reference: this is the one job whose entire input is who is being written
     * to, and an operator forcing a drain does not need to be told who was
     * emailed in order to know it worked.
     */
    const { correlationId, durationMs, ...counts } = await runOutboxDrain();
    return NextResponse.json({ ok: true, correlationId, durationMs, ...counts });
  } catch {
    // The runner has already logged the failure with its correlation id; the
    // response says only that it failed.
    return NextResponse.json({ error: 'drain_failed' }, { status: 500 });
  }
}

/** GET is refused: a drain sends real mail and must not be triggerable by a link. */
export function GET(): NextResponse {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}
