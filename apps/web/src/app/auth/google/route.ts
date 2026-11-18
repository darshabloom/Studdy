import { NextResponse, type NextRequest } from 'next/server';
import { safeAuthNext } from '@/lib/auth/safe-next';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Start Google OAuth on the server so the PKCE code verifier is saved in
 * Supabase's auth cookies before the provider redirects back.
 *
 * The provider itself must be enabled in the matching Supabase project's
 * Authentication settings. Email/password remains a fully supported route.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const next = safeAuthNext(request.nextUrl.searchParams.get('next'));
  const supabase = await createSupabaseServerClient();

  if (supabase === null) {
    return NextResponse.redirect(new URL('/sign-in?error=google_unavailable', request.url));
  }

  const callback = new URL('/auth/callback', request.url);
  callback.searchParams.set('provider', 'google');
  callback.searchParams.set('next', next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callback.toString(), skipBrowserRedirect: true },
  });

  if (error !== null || !data.url) {
    return NextResponse.redirect(new URL('/sign-in?error=google_unavailable', request.url));
  }

  return NextResponse.redirect(data.url);
}
