import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * PKCE code exchange endpoint. Route handlers CAN set cookies (Server
 * Components cannot), so every emailed action link lands here first and is
 * exchanged for a session before redirecting into the app.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const nextParam = url.searchParams.get('next') ?? '/workspace';
  // Only ever redirect within the app.
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/workspace';

  if (code !== null) {
    const supabase = await createSupabaseServerClient();
    if (supabase !== null) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error === null) {
        return NextResponse.redirect(new URL(next, url.origin));
      }
    }
  }
  return NextResponse.redirect(new URL('/verify?error=invalid_link', url.origin));
}
