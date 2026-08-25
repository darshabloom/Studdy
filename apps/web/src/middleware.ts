import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Protected-route check + session refresh (Blueprint §6.1). This is the first
 * layer only — every workspace layout re-resolves identity, role assignments
 * and workspace server-side. Entering a protected URL is never sufficient.
 */
const PROTECTED_PREFIXES = [
  // The booking journey acts on a real student, so it is never anonymous. The
  // segment-aware test below keeps this clear of any future '/bookings'.
  '/book',
  '/requests',
  '/parent',
  '/tutor',
  '/student',
  '/organisation',
  '/manager',
  '/owner',
  '/shortlist',
  '/welcome',
];

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Segment-aware: a bare prefix test would treat the PUBLIC /tutors
  // discovery page as the protected /tutor workspace.
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (url === undefined || anonKey === undefined) {
    // Supabase unconfigured: fail closed on protected routes.
    if (isProtected) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/sign-in';
      redirectUrl.searchParams.set('next', request.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          const cookie = options as Parameters<typeof response.cookies.set>[2];
          if (cookie === undefined) {
            response.cookies.set(name, value);
          } else {
            response.cookies.set(name, value, cookie);
          }
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtected && user === null) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/sign-in';
    redirectUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
