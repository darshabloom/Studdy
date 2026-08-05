'use client';

import { createBrowserClient } from '@supabase/ssr';

/** Browser Supabase client — anon key only. Service-role keys never reach the browser. */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url === undefined || anonKey === undefined) {
    throw new Error('Supabase environment variables are not configured.');
  }
  return createBrowserClient(url, anonKey);
}
