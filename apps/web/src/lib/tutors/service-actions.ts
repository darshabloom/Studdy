'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  archiveTutorService,
  createTutorService,
  listSubjects,
  pauseTutorListing,
  publishTutorService,
  resumeTutorListing,
  startServiceRevision,
  submitTutorService,
  tutorOwnProfile,
  unpublishTutorService,
  updateTutorProfile,
  updateTutorService,
  withdrawTutorServiceSubmission,
} from '@studdy/database';
import { validateTutorProfile, validateTutorService } from '@studdy/domain/tutors';
import type { TutorFormState } from './form-state';
import { profileInputFromFormData, serviceInputFromFormData } from './service-form';
import { SERVICE_NOTICE, type ServiceNotice } from './service-status';
import { requireTutor } from './tutor-session';

/**
 * The tutor's own actions on their services, their profile and their listing.
 *
 * SCOPED BY THE SESSION, NEVER BY AN ID FROM THE BROWSER. Every action calls
 * `requireTutor` first and hands the repository the profile id it resolved. A
 * service reference does come from the form, and is matched together with that
 * profile id in the query, so one belonging to another tutor finds nothing.
 *
 * Outcomes go back as a fixed notice token in the URL, never as text.
 */

const SERVICES = '/tutor/services';
const PROFILE = '/tutor/profile';
const REFERENCE = /^SERVICE-\d{8}$/;

function servicePath(reference: string): string {
  return `${SERVICES}/${reference}`;
}

function revalidateTutor(): void {
  revalidatePath('/tutor');
  revalidatePath(SERVICES);
  revalidatePath(PROFILE);
}

function readReference(formData: FormData): string {
  const value = formData.get('reference');
  if (typeof value !== 'string' || !REFERENCE.test(value)) redirect(SERVICES);
  return value;
}

function backToService(reference: string, notice: ServiceNotice): never {
  revalidateTutor();
  revalidatePath(servicePath(reference));
  redirect(`${servicePath(reference)}?notice=${notice}`);
}

function backToList(notice: ServiceNotice): never {
  revalidateTutor();
  redirect(`${SERVICES}?notice=${notice}`);
}

/**
 * Create a service, or save changes to one that has not been reviewed yet.
 *
 * Which of the two is decided by whether the form carries a reference. The
 * service is validated against the tutor's CURRENT profile, read here, so it
 * cannot promise a format the profile does not offer.
 */
export async function saveServiceAction(
  _previous: TutorFormState,
  formData: FormData,
): Promise<TutorFormState> {
  const actor = await requireTutor(SERVICES);
  const profile = await tutorOwnProfile(actor.studdyUserId);
  if (profile === null) redirect('/tutor');

  const known = await listSubjects();
  const validated = validateTutorService(serviceInputFromFormData(formData), {
    knownSubjectIds: known.map((subject) => subject.subjectId),
    offersOnline: profile.offersOnline,
    offersInPerson: profile.offersInPerson,
  });
  if (!validated.ok) {
    return {
      error: 'Please check the highlighted fields.',
      message: null,
      issues: (validated.error.details ?? {}) as Record<string, string>,
    };
  }

  const command = {
    tutorProfileId: actor.tutorProfileId,
    actorUserId: actor.studdyUserId,
    correlationId: randomUUID(),
    service: validated.value,
  };
  const rawReference = formData.get('reference');
  if (typeof rawReference === 'string' && rawReference !== '') {
    if (!REFERENCE.test(rawReference)) redirect(SERVICES);
    const result = await updateTutorService({ ...command, reference: rawReference });
    if (result.status === 'done') backToService(rawReference, SERVICE_NOTICE.saved);
    if (result.status === 'not_found') redirect(SERVICES);
    return {
      error: 'This service can no longer be edited here. Go back to your services.',
      message: null,
      issues: {},
    };
  }

  const created = await createTutorService(command);
  if (created.status === 'limit_reached') {
    return {
      error: 'You have reached the limit on services. Remove one you no longer need first.',
      message: null,
      issues: {},
    };
  }
  backToService(created.reference, SERVICE_NOTICE.saved);
}

async function command(formData: FormData) {
  const actor = await requireTutor(SERVICES);
  return {
    reference: readReference(formData),
    tutorProfileId: actor.tutorProfileId,
    actorUserId: actor.studdyUserId,
    correlationId: randomUUID(),
  };
}

export async function submitServiceAction(formData: FormData): Promise<void> {
  const input = await command(formData);
  const result = await submitTutorService(input);
  if (result.status === 'not_found') redirect(SERVICES);
  backToService(
    input.reference,
    result.status === 'done' ? SERVICE_NOTICE.submitted : SERVICE_NOTICE.notAllowed,
  );
}

export async function withdrawServiceAction(formData: FormData): Promise<void> {
  const input = await command(formData);
  const result = await withdrawTutorServiceSubmission(input);
  if (result.status === 'not_found') redirect(SERVICES);
  backToService(
    input.reference,
    result.status === 'done' ? SERVICE_NOTICE.withdrawn : SERVICE_NOTICE.notAllowed,
  );
}

export async function publishServiceAction(formData: FormData): Promise<void> {
  const input = await command(formData);
  const result = await publishTutorService(input);
  if (result.status === 'not_found') redirect(SERVICES);
  if (result.status === 'published') backToService(input.reference, SERVICE_NOTICE.published);
  backToService(
    input.reference,
    result.blockers.includes('payouts_not_ready')
      ? SERVICE_NOTICE.payoutsNotReady
      : SERVICE_NOTICE.notReady,
  );
}

export async function unpublishServiceAction(formData: FormData): Promise<void> {
  const input = await command(formData);
  const result = await unpublishTutorService(input);
  if (result.status === 'not_found') redirect(SERVICES);
  backToService(
    input.reference,
    result.status === 'done' ? SERVICE_NOTICE.unpublished : SERVICE_NOTICE.notAllowed,
  );
}

export async function removeServiceAction(formData: FormData): Promise<void> {
  const input = await command(formData);
  const result = await archiveTutorService(input);
  if (result.status === 'done') backToList(SERVICE_NOTICE.removed);
  if (result.status === 'not_found') redirect(SERVICES);
  backToService(input.reference, SERVICE_NOTICE.notAllowed);
}

export async function reviseServiceAction(formData: FormData): Promise<void> {
  const input = await command(formData);
  const result = await startServiceRevision(input);
  if (result.status === 'started' || result.status === 'existing') {
    backToService(result.reference, SERVICE_NOTICE.revisionStarted);
  }
  if (result.status === 'not_found') redirect(SERVICES);
  backToService(
    input.reference,
    result.status === 'limit_reached' ? SERVICE_NOTICE.limitReached : SERVICE_NOTICE.notAllowed,
  );
}

// ---------------------------------------------------------------------------
// Profile and listing
// ---------------------------------------------------------------------------

export async function saveProfileAction(
  _previous: TutorFormState,
  formData: FormData,
): Promise<TutorFormState> {
  const actor = await requireTutor(PROFILE);
  const validated = validateTutorProfile(profileInputFromFormData(formData));
  if (!validated.ok) {
    return {
      error: 'Please check the highlighted fields.',
      message: null,
      issues: (validated.error.details ?? {}) as Record<string, string>,
    };
  }

  const result = await updateTutorProfile({
    tutorProfileId: actor.tutorProfileId,
    actorUserId: actor.studdyUserId,
    correlationId: randomUUID(),
    profile: validated.value,
  });
  if (result.status === 'not_found') redirect('/tutor');
  if (result.status === 'format_in_use') {
    const format = result.format === 'online' ? 'online' : 'in-person';
    return {
      error: `One of your services is taught ${format}. Change or remove that service before you stop offering ${format} lessons.`,
      message: null,
      issues: { formats: `A service still uses ${format} lessons.` },
    };
  }
  revalidateTutor();
  return { error: null, message: 'Profile saved.', issues: {} };
}

async function listing(direction: 'pause' | 'resume'): Promise<never> {
  const actor = await requireTutor(PROFILE);
  const input = {
    tutorProfileId: actor.tutorProfileId,
    actorUserId: actor.studdyUserId,
    correlationId: randomUUID(),
  };
  const result =
    direction === 'pause' ? await pauseTutorListing(input) : await resumeTutorListing(input);
  revalidateTutor();
  const notice =
    result.status !== 'done'
      ? SERVICE_NOTICE.notAllowed
      : direction === 'pause'
        ? SERVICE_NOTICE.paused
        : SERVICE_NOTICE.resumed;
  redirect(`${PROFILE}?notice=${notice}`);
}

export async function pauseListingAction(): Promise<void> {
  await listing('pause');
}

export async function resumeListingAction(): Promise<void> {
  await listing('resume');
}
