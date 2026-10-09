import 'server-only';
import { redirect } from 'next/navigation';
import { tutorProfileForUser } from '@studdy/database';
import { resolveIdentity } from '../identity/resolve';

export interface TutorActor {
  readonly tutorProfileId: string;
  readonly studdyUserId: string;
}

/**
 * The signed-in tutor, resolved from the SESSION, or a redirect.
 *
 * Every tutor page and action that reads or changes a tutor's own profile or
 * services calls this itself. A server action is a directly callable endpoint and
 * a page's data fetch runs alongside its layout, so the workspace layout's guard
 * is the second layer, never the only one. The profile id returned here is the
 * only one a repository is ever handed: nothing from a form names a tutor.
 */
export async function requireTutor(returnTo: string): Promise<TutorActor> {
  const identity = await resolveIdentity();
  if (identity === null || identity.studdyUserId === null) {
    redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  }
  // A database blip must never read as "yes".
  if (!identity.databaseAvailable) redirect('/workspace');
  const profile = await tutorProfileForUser(identity.studdyUserId);
  if (profile === null) redirect('/tutor');
  return { tutorProfileId: profile.id, studdyUserId: identity.studdyUserId };
}
