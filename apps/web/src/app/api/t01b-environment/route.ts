import { NextResponse } from 'next/server';
import { createDatabaseClient } from '@studdy/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Temporary T01b diagnostic. Never return credentials, hostnames, user records,
// provider keys or database errors. Remove after verification; do not release.
const project = 'klocfukykunxiggwpohg';
const origin = 'https://studdy-git-t01b-confirmed-schedule-darsha-waterhouses-projects.vercel.app';

function targetMatches(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return ['postgres:', 'postgresql:'].includes(url.protocol) &&
      (url.hostname === `db.${project}.supabase.co` ||
        (url.hostname.endsWith('.pooler.supabase.com') &&
          decodeURIComponent(url.username).endsWith(`.${project}`)));
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== 'preview' ||
      process.env.VERCEL_GIT_COMMIT_REF !== 't01b/confirmed-schedule' ||
      process.env.STUDDY_ENVIRONMENT !== 'development' ||
      new URL(request.url).origin !== origin) {
    return new NextResponse(null, { status: 404 });
  }
  const databaseTargetMatches = targetMatches(process.env.DATABASE_URL);
  let databaseReachable = false;
  if (databaseTargetMatches) {
    try {
      const { sql } = createDatabaseClient();
      try {
        const rows = await sql`select 1 as ok`;
        databaseReachable = rows.length === 1;
      } finally {
        await sql.end({ timeout: 2 });
      }
    } catch {
      // Deliberately suppress errors that could contain connection information.
    }
  }
  const stripe = process.env.STRIPE_SECRET_KEY?.trim() ?? '';
  const publishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? '';
  const stripeDisabled = stripe === '' && publishable === '';
  const stripeTestKeys = /^(sk|rk)_test_/.test(stripe) && publishable.startsWith('pk_test_');
  const transactionalEmailDisabled = !process.env.RESEND_API_KEY?.trim() ||
    !process.env.RESEND_FROM_ADDRESS;
  return NextResponse.json({
    databaseTargetMatches,
    databaseReachable,
    stripeDisabled,
    stripeTestKeys,
    transactionalEmailDisabled,
    siteOriginMatches: process.env.NEXT_PUBLIC_SITE_URL === origin,
    googleEnabled: process.env.STUDDY_GOOGLE_AUTH_ENABLED === 'true',
  }, { headers: { 'Cache-Control': 'no-store' } });
}
