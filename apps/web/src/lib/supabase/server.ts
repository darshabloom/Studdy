import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Server-side Supabase client (anon key + user cookies). Auth only —
 * business data access goes through the domain layer and direct Postgres,
 * never through the browser-facing data API in package one.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url === undefined || anonKey === undefined) {
    return null; // Supabase not configured (e.g. bare CI build) — treated as signed out.
  }
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            const cookie = options as Parameters<typeof cookieStore.set>[2];
            if (cookie === undefined) {
              cookieStore.set(name, value);
            } else {
              cookieStore.set(name, value, cookie);
            }
          }
        } catch {
          // Called from a Server Component — middleware refreshes sessions.
        }
      },
    },
  });
}
