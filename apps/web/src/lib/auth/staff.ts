import 'server-only';
import { redirect } from 'next/navigation';
import type { WorkspaceCode } from '@studdy/permissions';
import { resolveIdentity } from '../identity/resolve';
import { createSupabaseServerClient } from '../supabase/server';

/**
 * Who may act as Studdy staff — checked EVERY time, in the action itself.
 *
 * WHY THIS IS NOT JUST THE WORKSPACE LAYOUT. A layout guards what is rendered. A
 * server action is a separate, directly callable endpoint: a signed-in parent can
 * POST to it without ever loading a manager page, and a page's data fetch runs
 * alongside its layout rather than after it. So everything staff-only —
 * reading an applicant's personal data, recording a check, approving a tutor —
 * calls `requireStaff()` itself, and the layout's guard is the second layer, not
 * the only one.
 *
 * STAFF MEANS BOTH, and both are re-checked on every call:
 *   1. an ACTIVE manager or owner role, resolved fresh from the database;
 *   2. an MFA session at assurance level 2 (approved 6 Aug 2026, PD-002).
 * It fails CLOSED: a database that cannot be read, or an auth service that cannot
 * be reached, is a refusal and never a pass.
 */

const STAFF_WORKSPACES: readonly WorkspaceCode[] = ['platform_manager', 'platform_owner'];

export interface StaffActor {
  readonly studdyUserId: string;
}

export async function requireStaff(returnTo: string): Promise<StaffActor> {
  const identity = await resolveIdentity();
  if (identity === null) {
    redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  }
  // A database blip must never read as "yes". Same stance as the workspace shell.
  if (!identity.databaseAvailable || identity.studdyUserId === null) {
    redirect('/workspace');
  }
  if (!identity.workspaces.some((code) => STAFF_WORKSPACES.includes(code))) {
    redirect('/workspace');
  }

  const supabase = await createSupabaseServerClient();
  if (supabase === null) redirect('/sign-in');
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  // No answer is not assurance. Only a positively reported aal2 passes.
  if (data === null || data.currentLevel !== 'aal2') {
    redirect(data?.nextLevel === 'aal2' ? '/mfa' : '/mfa/enroll');
  }

  return { studdyUserId: identity.studdyUserId };
}
