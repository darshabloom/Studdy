import { NextResponse, type NextRequest } from 'next/server';
import { safeAuthNext } from '@/lib/auth/safe-next';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Google OAuth is inert until provider/account-linking verification and explicit activation. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.nextUrl.origin;
  if (process.env.STUDDY_GOOGLE_AUTH_ENABLED !== 'true') {
    return NextResponse.redirect(new URL('/sign-in?error=google_unavailable', origin));
  }

  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return NextResponse.redirect(new URL('/sign-in?error=google_unavailable', origin));
  }

  const callback = new URL('/auth/callback', origin);
  callback.searchParams.set('provider', 'google');
  callback.searchParams.set('next', safeAuthNext(request.nextUrl.searchParams.get('next')));

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callback.toString(),
      skipBrowserRedirect: true,
    },
  });

  if (error !== null || !data.url) {
    return NextResponse.redirect(new URL('/sign-in?error=google_unavailable', origin));
  }

  return NextResponse.redirect(data.url);
}
