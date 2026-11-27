import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import { schedulerMode } from '@/inngest/scheduler-mode';
import { expireRequestsScheduled } from '@/inngest/functions/expire-requests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const enabled =
  schedulerMode(
    process.env.STUDDY_ENVIRONMENT,
    process.env.STUDDY_ENABLE_EXPIRY_SCHEDULER,
    process.env.VERCEL_ENV,
    process.env.VERCEL_GIT_COMMIT_REF,
  ) === 'expiry-only' &&
  Boolean(process.env.INNGEST_SIGNING_KEY) &&
  process.env.INNGEST_DEV !== '1' &&
  process.env.INNGEST_DEV !== 'true';

// Fail closed before handing requests to the SDK in any other environment.
const unavailable = () => new Response(null, { status: 404 });
const handlers = enabled
  ? serve({ client: inngest, functions: [expireRequestsScheduled] })
  : { GET: unavailable, POST: unavailable, PUT: unavailable };

export const { GET, POST, PUT } = handlers;
