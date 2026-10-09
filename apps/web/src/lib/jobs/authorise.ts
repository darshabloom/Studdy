import { timingSafeEqual } from 'node:crypto';

/**
 * Is this request carrying the shared job secret?
 *
 * THE HEADER ONLY. A secret in a query string ends up in access logs and
 * browser history, so it is not accepted there — the job endpoints' e2e tests
 * assert that. The comparison is constant-time, and a mismatch in LENGTH is
 * rejected without comparing content, because `timingSafeEqual` requires equal
 * lengths and a short-circuit on content would leak where they diverge.
 *
 * FAILS CLOSED: an unset or empty `CRON_SECRET` authorises nothing, so a
 * deployment that forgot to configure it exposes no money-moving endpoint
 * instead of an open one.
 *
 * The drain and expiry routes carry their own copies of this check; new job
 * routes use this one.
 */
export function isAuthorisedJobRequest(request: Request): boolean {
  const configured = process.env.CRON_SECRET;
  if (configured === undefined || configured.length === 0) return false;

  const header = request.headers.get('authorization');
  if (header === null) return false;

  const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : header;
  const expected = Buffer.from(configured);
  const actual = Buffer.from(provided);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
