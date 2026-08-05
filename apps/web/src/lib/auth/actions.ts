'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '../supabase/server';

export interface AuthFormState {
  error: string | null;
  message: string | null;
}

const INITIAL: AuthFormState = { error: null, message: null };

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

/** Create a Supabase auth account and send the verification email. */
export async function signUpAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (email.length === 0 || password.length < 10) {
    return {
      error: 'Choose a password of at least 10 characters and enter your email address.',
      message: null,
    };
  }
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return { error: 'Sign-up is not available: authentication is not configured.', message: null };
  }
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${siteUrl()}/verify` },
  });
  if (error !== null) {
    return { error: 'We could not create the account yet. Please try again.', message: null };
  }
  return {
    ...INITIAL,
    message: 'Check your email to verify your account, then sign in.',
  };
}

/** Sign in with email and password. */
export async function signInAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '');
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return { error: 'Sign-in is not available: authentication is not configured.', message: null };
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error !== null) {
    return { error: 'We could not sign you in with those details.', message: null };
  }
  redirect(next.startsWith('/') ? next : '/workspace');
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (supabase !== null) {
    await supabase.auth.signOut();
  }
  redirect('/');
}
