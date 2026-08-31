import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import { expireRequestsScheduled } from '@/inngest/functions/expire-requests';

/**
 * The Inngest endpoint: where Inngest discovers and invokes Studdy's scheduled
 * functions.
 *
 * GET, POST and PUT are all required by the SDK — PUT is how Inngest registers
 * the app's functions, GET serves introspection, POST carries an invocation.
 *
 * AUTHENTICATION IS THE SDK'S, not ours. Inngest signs every request with
 * `INNGEST_SIGNING_KEY` and `serve` verifies it, which is why this route has no
 * hand-rolled check of its own — unlike `/api/jobs/expire-requests`, which is
 * called by a human with a shared secret and must do its own. Adding a second,
 * different check here would be a way to get signature verification subtly
 * wrong.
 *
 * The middleware matcher already excludes `api/`, so this is not behind the
 * session gate — which it must not be: Inngest arrives with a signature, never
 * a cookie.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [expireRequestsScheduled],
});
