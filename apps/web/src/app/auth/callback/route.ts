import { NextResponse, type NextRequest } from 'next/server';
import { safeAuthNext } from '@/lib/auth/safe-next';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * PKCE code exchange endpoint. Route handlers CAN set cookies (Server
 * Components cannot), so every emailed action link lands here first and is
 * exchanged for a session before redirecting into the app.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeAuthNext(url.searchParams.get('next'));
  const googleFlow = url.searchParams.get('provider') === 'google';
  if (googleFlow && (url.searchParams.has('error') || process.env.STUDDY_GOOGLE_AUTH_ENABLED !== 'true')) {
    return NextResponse.redirect(new URL('/sign-in?error=google_unavailable', url.origin));
  }

  if (code !== null) {
    const supabase = await createSupabaseServerClient();
    if (supabase !== null) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error === null) {
        return NextResponse.redirect(new URL(next, url.origin));
      }
    }
  }
  return NextResponse.redirect(
    new URL(googleFlow ? '/sign-in?error=google_unavailable' : '/verify?error=invalid_link', url.origin),
  );
}
