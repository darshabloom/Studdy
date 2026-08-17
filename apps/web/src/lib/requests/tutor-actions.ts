'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  acceptTutorRequestTime,
  declineTutorRequest,
  RequestNotOpenError,
  TimeNoLongerAvailableError,
  tutorProfileForUser,
} from '@studdy/database';
import { resolveIdentity } from '../identity/resolve';

export interface TutorResponseFormState {
  error: string | null;
}

/**
 * Accept one offered time.
 *
 * The tutor's identity comes from the session and nowhere else — never a form
 * field, never a URL. The reference and the option id are both scoped by that
 * identity inside the authoritative query, so a value belonging to another
 * tutor matches nothing rather than being found and then refused.
 */
export async function acceptTimeAction(
  _previous: TutorResponseFormState,
  formData: FormData,
): Promise<TutorResponseFormState> {
  const identity = await resolveIdentity();
  if (identity === null || identity.studdyUserId === null) redirect('/sign-in');
  const profile = await tutorProfileForUser(identity.studdyUserId);
  if (profile === null) return { error: 'Your tutor profile is not active yet.' };

  const reference = String(formData.get('reference') ?? '');
  const tutorRequestTimeOptionId = String(formData.get('tutorRequestTimeOptionId') ?? '');
  if (reference === '' || tutorRequestTimeOptionId === '') {
    return { error: 'Choose which time you can do.' };
  }

  try {
    await acceptTutorRequestTime({
      reference,
      tutorProfileId: profile.id,
      tutorRequestTimeOptionId,
      actorUserId: identity.studdyUserId,
      correlationId: `cor_${randomUUID()}`,
    });
  } catch (error) {
    // One message for every cause. Whether the family withdrew the time,
    // another request claimed the tutor's calendar, or the start has simply
    // passed, the tutor learns the time is gone and nothing about who acted.
    if (error instanceof TimeNoLongerAvailableError) {
      return {
        error: 'That time is no longer available. Choose another time you can do, if there is one.',
      };
    }
    if (error instanceof RequestNotOpenError) {
      return { error: 'That request is no longer open.' };
    }
    throw error;
  }

  revalidatePath('/tutor/requests');
  revalidatePath(`/tutor/requests/${reference}`);
  return { error: null };
}

/** Decline a request. Takes no calendar time and releases nothing. */
export async function declineRequestAction(
  _previous: TutorResponseFormState,
  formData: FormData,
): Promise<TutorResponseFormState> {
  const identity = await resolveIdentity();
  if (identity === null || identity.studdyUserId === null) redirect('/sign-in');
  const profile = await tutorProfileForUser(identity.studdyUserId);
  if (profile === null) return { error: 'Your tutor profile is not active yet.' };

  const reference = String(formData.get('reference') ?? '');
  if (reference === '') return { error: 'That request is no longer open.' };
  const reasonCode = String(formData.get('declineReasonCode') ?? '').trim();

  try {
    await declineTutorRequest({
      reference,
      tutorProfileId: profile.id,
      actorUserId: identity.studdyUserId,
      declineReasonCode: reasonCode === '' ? null : reasonCode,
      correlationId: `cor_${randomUUID()}`,
    });
  } catch (error) {
    if (error instanceof RequestNotOpenError) {
      return { error: 'That request is no longer open.' };
    }
    throw error;
  }

  revalidatePath('/tutor/requests');
  revalidatePath(`/tutor/requests/${reference}`);
  return { error: null };
}
