import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import { expireRequestsScheduled } from '@/inngest/functions/expire-requests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const expiry = process.env.STUDDY_ENABLE_EXPIRY_SCHEDULER === 'true';
const probe = process.env.STUDDY_ENABLE_SCHEDULER_PROBE === 'true';
const enabled =
  process.env.STUDDY_ENVIRONMENT === 'development' &&
  process.env.VERCEL_ENV === 'preview' &&
  process.env.VERCEL_GIT_COMMIT_REF === 'development' &&
  Boolean(process.env.INNGEST_SIGNING_KEY?.trim()) &&
  !process.env.INNGEST_DEV &&
  expiry !== probe;

// The probe has no cron, database, payment or email dependencies.
const unavailable = () => new Response(null, { status: 404 });
const handlers = enabled
  ? serve({
      client: inngest,
      functions: expiry
        ? [expireRequestsScheduled]
        : [
            inngest.createFunction(
              {
                id: 'scheduler-connectivity-probe',
                triggers: [{ event: 'studdy/scheduler.probe' }],
              },
              async () => ({ ok: true }),
            ),
          ],
    })
  : { GET: unavailable, POST: unavailable, PUT: unavailable };

export const { GET, POST, PUT } = handlers;
