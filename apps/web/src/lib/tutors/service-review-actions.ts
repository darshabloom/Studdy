'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { approveTutorService, requestTutorServiceChanges } from '@studdy/database';
import { requireStaff } from '../auth/staff';
import { REVIEW_NOTICE, type ReviewNotice } from './review-notices';

/**
 * The reviewer's decisions on a tutor's service.
 *
 * EVERY ONE RE-CHECKS THAT THE CALLER IS STAFF, FIRST, with `requireStaff`, which
 * re-reads their role and their MFA level. A server action is a directly callable
 * endpoint: a signed-in tutor could POST to it to approve their own service
 * without ever opening a manager page, so nothing here relies on the page having
 * rendered the button. The check happens before the form is even read.
 */

const QUEUE = '/manager/services';
const REFERENCE = /^SERVICE-\d{8}$/;
const NOTE_MAX = 1000;

function back(reference: string, notice: ReviewNotice): never {
  revalidatePath(QUEUE);
  revalidatePath(`${QUEUE}/${reference}`);
  redirect(`${QUEUE}/${reference}?notice=${notice}`);
}

function readReference(formData: FormData): string {
  const value = formData.get('reference');
  if (typeof value !== 'string' || !REFERENCE.test(value)) redirect(QUEUE);
  return value;
}

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export async function approveServiceAction(formData: FormData): Promise<void> {
  const actor = await requireStaff(QUEUE);
  const reference = readReference(formData);
  const note = readText(formData, 'internalNote');
  if (note.length > NOTE_MAX) back(reference, REVIEW_NOTICE.invalid);

  const result = await approveTutorService({
    reference,
    actorUserId: actor.studdyUserId,
    correlationId: randomUUID(),
    internalNote: note === '' ? null : note,
  });
  if (result.status === 'not_found') redirect(QUEUE);
  back(
    reference,
    result.status === 'done' ? REVIEW_NOTICE.serviceApproved : REVIEW_NOTICE.serviceNotDecidable,
  );
}

export async function requestServiceChangesAction(formData: FormData): Promise<void> {
  const actor = await requireStaff(QUEUE);
  const reference = readReference(formData);
  // Shown to the tutor, so it is required and written for them.
  const message = readText(formData, 'message');
  if (message === '' || message.length > NOTE_MAX) {
    back(reference, REVIEW_NOTICE.serviceMessageRequired);
  }

  const result = await requestTutorServiceChanges({
    reference,
    message,
    actorUserId: actor.studdyUserId,
    correlationId: randomUUID(),
  });
  if (result.status === 'not_found') redirect(QUEUE);
  back(
    reference,
    result.status === 'done'
      ? REVIEW_NOTICE.serviceChangesRequested
      : REVIEW_NOTICE.serviceNotDecidable,
  );
}
