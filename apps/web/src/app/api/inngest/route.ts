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

/**
 * The ceiling Vercel gives one invocation of this endpoint.
 *
 * Inngest's Vercel guidance is to set this explicitly rather than inherit an
 * implicit platform timeout, so a step cannot be killed mid-flight by a default
 * nobody chose. 300 seconds is their documented example and also the Hobby
 * plan's default AND maximum with fluid compute, so it is the largest honest
 * value here and carries no risk of failing a deployment the way an
 * over-plan-limit setting would.
 *
 * The expiry sweep itself finishes in tens of milliseconds — 59ms, 89ms and
 * 354ms across three observed runs. This is headroom, not an expectation.
 *
 * CHECKPOINTING'S `maxRuntime` IS DELIBERATELY NOT SET. Inngest recommends
 * pinning it 20-40% below `maxDuration` when checkpointing is in play, which
 * exists so a long multi-step function persists progress before the platform
 * kills the request. This function has no steps and one database call; the
 * installed SDK creates that timer only when `maxRuntime` is explicitly
 * configured, so there is no default sitting above this ceiling to correct.
 * Setting it would be inventing a timeout policy for a sub-second function.
 */
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [expireRequestsScheduled],
});
