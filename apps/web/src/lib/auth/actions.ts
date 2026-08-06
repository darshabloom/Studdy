'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import {
  completeAccountSetup,
  recordAuthAuditEvent,
  setLastActiveWorkspace,
} from '@studdy/database';
import { validateAccountSetup } from '@studdy/domain/identity';
import { WORKSPACE_CODES, WORKSPACE_ROUTE_SEGMENTS, type WorkspaceCode } from '@studdy/permissions';
import { createSupabaseServerClient } from '../supabase/server';
import { resolveIdentity } from '../identity/resolve';

export interface AuthFormState {
  error: string | null;
  message: string | null;
  /** Set when sign-in failed because the email is unverified. */
  unverifiedEmail?: string;
  /** Field-level validation issues. */
  issues?: Record<string, string>;
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
    options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=%2Fwelcome` },
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
    if (error.code === 'email_not_confirmed') {
      return {
        error: 'This email address has not been verified yet.',
        message: null,
        unverifiedEmail: email,
      };
    }
    return { error: 'We could not sign you in with those details.', message: null };
  }
  const identity = await resolveIdentity();
  await recordAuthAuditEvent({
    action: 'auth.sign_in_succeeded',
    studdyUserId: identity?.studdyUserId ?? null,
    correlationId: `cor_${randomUUID()}`,
  });
  redirect(next.startsWith('/') ? next : '/workspace');
}

/** Resend the verification email for an unverified account. */
export async function resendVerificationAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim();
  const supabase = await createSupabaseServerClient();
  if (supabase === null || email.length === 0) {
    return { error: 'We could not resend the email. Please try again.', message: null };
  }
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=%2Fwelcome` },
  });
  if (error !== null) {
    return {
      error: 'We could not resend the email yet. Please wait a moment and try again.',
      message: null,
    };
  }
  return { ...INITIAL, message: 'Verification email sent. Check your inbox.' };
}

/** Request a password-reset email. Always responds neutrally (no account enumeration). */
export async function requestPasswordResetAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim();
  const supabase = await createSupabaseServerClient();
  if (supabase === null || email.length === 0) {
    return { error: 'Enter your email address.', message: null };
  }
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=%2Freset-password%2Fconfirm`,
  });
  await recordAuthAuditEvent({
    action: 'auth.password_reset_requested',
    studdyUserId: null,
    correlationId: `cor_${randomUUID()}`,
  });
  return {
    ...INITIAL,
    message: 'If that address has a Studdy account, a reset email is on its way.',
  };
}

/** Set a new password from the emailed reset link (session established by /reset-password/confirm). */
export async function completePasswordResetAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = String(formData.get('password') ?? '');
  if (password.length < 10) {
    return { error: 'Choose a password of at least 10 characters.', message: null };
  }
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return { error: 'Password reset is not available right now.', message: null };
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error !== null) {
    return {
      error:
        'We could not update the password. The reset link may have expired — request a new one.',
      message: null,
    };
  }
  const identity = await resolveIdentity();
  await recordAuthAuditEvent({
    action: 'auth.password_reset_completed',
    studdyUserId: identity?.studdyUserId ?? null,
    correlationId: `cor_${randomUUID()}`,
  });
  redirect('/workspace');
}

/** Complete /welcome: names + self-serve role choice. Server-authoritative. */
export async function completeAccountSetupAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const identity = await resolveIdentity();
  if (identity === null) redirect('/sign-in?next=%2Fwelcome');
  if (identity.studdyUserId === null) {
    return { error: 'Your account could not be loaded. Please try again.', message: null };
  }

  const validated = validateAccountSetup({
    roleChoice: String(formData.get('roleChoice') ?? ''),
    preferredName: String(formData.get('preferredName') ?? ''),
    familyName: String(formData.get('familyName') ?? ''),
    declaredEighteenPlus: formData.get('declaredEighteenPlus') === 'on',
  });
  if (!validated.ok) {
    return {
      error: 'Please check the highlighted fields.',
      message: null,
      issues: (validated.error.details ?? {}) as Record<string, string>,
    };
  }

  await completeAccountSetup({
    studdyUserId: identity.studdyUserId,
    roleCode: validated.value.roleCode,
    assignmentStatusCode: validated.value.assignmentStatusCode,
    workspaceEnabled: validated.value.workspaceEnabled,
    preferredName: validated.value.preferredName,
    familyName: validated.value.familyName,
    assignmentReasonCode: validated.value.assignmentReasonCode,
    correlationId: `cor_${randomUUID()}`,
  });

  redirect('/workspace');
}

/** Persist a workspace choice from the chooser, then enter it. */
export async function chooseWorkspaceAction(formData: FormData): Promise<void> {
  const choice = String(formData.get('workspace') ?? '');
  const identity = await resolveIdentity();
  if (identity === null) redirect('/sign-in');
  if (
    identity.studdyUserId !== null &&
    (WORKSPACE_CODES as readonly string[]).includes(choice) &&
    identity.workspaces.includes(choice as WorkspaceCode)
  ) {
    await setLastActiveWorkspace(identity.studdyUserId, choice, `cor_${randomUUID()}`);
    redirect(`/${WORKSPACE_ROUTE_SEGMENTS[choice as WorkspaceCode]}`);
  }
  redirect('/workspace');
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (supabase !== null) {
    await supabase.auth.signOut();
  }
  redirect('/');
}
