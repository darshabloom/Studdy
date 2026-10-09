'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  approveApplication,
  recordApplicationCheck,
  rejectApplication,
  requestApplicationChanges,
} from '@studdy/database';
import { APPLICATION_CHECK_STATUSES, isApplicationCheckCode } from '@studdy/domain/tutors';
import { requireStaff } from '../auth/staff';
import { REVIEW_NOTICE, type ReviewNotice } from './review-notices';

/**
 * The reviewer's actions — recording a check and deciding an application.
 *
 * EVERY ONE RE-CHECKS THAT THE CALLER IS STAFF, FIRST, with `requireStaff`, which
 * re-reads their role and their MFA level. A server action is a directly callable
 * endpoint: a signed-in parent can POST to it without ever opening a manager page,
 * so nothing here may rely on the page having been the one that rendered the
 * button. The checks happen before the form is even read.
 *
 * The outcome goes back to the page as a fixed notice token in the URL, never as
 * text: nothing about an applicant belongs in a URL, and a closed set of tokens
 * cannot be made to render something an attacker chose.
 */

const REFERENCE = /^APP-\d{8}$/;
const NOTE_MAX = 1000;

function detailPath(reference: string): string {
  return `/manager/tutor-applications/${reference}`;
}

function back(reference: string, notice: ReviewNotice): never {
  revalidatePath('/manager/tutor-applications');
  revalidatePath(detailPath(reference));
  redirect(`${detailPath(reference)}?notice=${notice}`);
}

/** The reference from the form, or a refusal back to the queue. */
function readReference(formData: FormData): string {
  const value = formData.get('reference');
  if (typeof value !== 'string' || !REFERENCE.test(value)) {
    redirect('/manager/tutor-applications');
  }
  return value;
}

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export async function recordCheckAction(formData: FormData): Promise<void> {
  const actor = await requireStaff('/manager/tutor-applications');
  const reference = readReference(formData);

  const checkCode = readText(formData, 'checkCode');
  const status = readText(formData, 'status');
  const note = readText(formData, 'note');
  if (
    !isApplicationCheckCode(checkCode) ||
    !(APPLICATION_CHECK_STATUSES as readonly string[]).includes(status) ||
    note.length > NOTE_MAX
  ) {
    back(reference, REVIEW_NOTICE.invalid);
  }

  const result = await recordApplicationCheck({
    reference,
    checkCode,
    status: status as (typeof APPLICATION_CHECK_STATUSES)[number],
    note: note === '' ? null : note,
    actorUserId: actor.studdyUserId,
    correlationId: randomUUID(),
  });
  back(reference, result.status === 'done' ? REVIEW_NOTICE.checkSaved : REVIEW_NOTICE.notDecidable);
}

export async function approveApplicationAction(formData: FormData): Promise<void> {
  const actor = await requireStaff('/manager/tutor-applications');
  const reference = readReference(formData);

  const result = await approveApplication({
    reference,
    actorUserId: actor.studdyUserId,
    correlationId: randomUUID(),
  });
  if (result.status === 'approved') return back(reference, REVIEW_NOTICE.approved);
  if (result.status === 'checks_incomplete') {
    return back(reference, REVIEW_NOTICE.checksIncomplete);
  }
  if (result.status === 'profile_exists') return back(reference, REVIEW_NOTICE.profileExists);
  return back(reference, REVIEW_NOTICE.notDecidable);
}

/** What the applicant will be shown, so it is required and written for them. */
function readMessage(formData: FormData, reference: string): string {
  const message = readText(formData, 'message');
  if (message === '' || message.length > NOTE_MAX) back(reference, REVIEW_NOTICE.messageRequired);
  return message;
}

export async function requestChangesAction(formData: FormData): Promise<void> {
  const actor = await requireStaff('/manager/tutor-applications');
  const reference = readReference(formData);
  const message = readMessage(formData, reference);

  const result = await requestApplicationChanges({
    reference,
    message,
    actorUserId: actor.studdyUserId,
    correlationId: randomUUID(),
  });
  back(
    reference,
    result.status === 'done' ? REVIEW_NOTICE.changesRequested : REVIEW_NOTICE.notDecidable,
  );
}

export async function rejectApplicationAction(formData: FormData): Promise<void> {
  const actor = await requireStaff('/manager/tutor-applications');
  const reference = readReference(formData);
  const message = readMessage(formData, reference);

  const result = await rejectApplication({
    reference,
    message,
    actorUserId: actor.studdyUserId,
    correlationId: randomUUID(),
  });
  back(reference, result.status === 'done' ? REVIEW_NOTICE.rejected : REVIEW_NOTICE.notDecidable);
}
