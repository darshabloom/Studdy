'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  listSubjects,
  saveApplicationDraft,
  startTutorApplication,
  submitApplication,
  withdrawApplication,
} from '@studdy/database';
import { validateTutorApplication } from '@studdy/domain/tutors';
import { resolveIdentity } from '../identity/resolve';
import { applicationInputFromFormData } from './application-form';
import type { TutorFormState } from './form-state';

/**
 * The applicant's own actions.
 *
 * SCOPED BY THE SESSION, NEVER BY AN ID FROM THE BROWSER. Every action resolves
 * the signed-in user and hands the repository only that user's id; there is no
 * application id or reference in any form for a tampering applicant to change, so
 * they can only ever reach their own application.
 *
 * Saving a draft is NOT validated — a half-written application must be saveable —
 * and a failed submission saves what was typed before it reports what is wrong, so
 * a validation error never costs anyone their work.
 */

const PAGE = '/apply/tutor';

async function requireApplicant(): Promise<string> {
  const identity = await resolveIdentity();
  if (identity === null || identity.studdyUserId === null) {
    redirect(`/sign-in?next=${encodeURIComponent(PAGE)}`);
  }
  if (!identity.databaseAvailable) redirect('/');
  return identity.studdyUserId;
}

export async function startApplicationAction(): Promise<void> {
  const userId = await requireApplicant();
  const result = await startTutorApplication({ userId, correlationId: randomUUID() });
  revalidatePath(PAGE);
  redirect(result.status === 'already_a_tutor' ? '/tutor' : PAGE);
}

export async function saveApplicationAction(
  _previous: TutorFormState,
  formData: FormData,
): Promise<TutorFormState> {
  const userId = await requireApplicant();
  const result = await saveApplicationDraft({
    userId,
    draft: applicationInputFromFormData(formData),
  });
  if (result === 'saved') {
    return { error: null, message: 'Draft saved.', issues: {} };
  }
  return {
    error:
      result === 'not_editable'
        ? 'This application has been submitted and can no longer be edited.'
        : 'We could not find your application.',
    message: null,
    issues: {},
  };
}

export async function submitApplicationAction(
  _previous: TutorFormState,
  formData: FormData,
): Promise<TutorFormState> {
  const userId = await requireApplicant();
  const input = applicationInputFromFormData(formData);

  // Save first, so a validation problem never loses what was typed.
  await saveApplicationDraft({ userId, draft: input });

  const known = await listSubjects();
  const validated = validateTutorApplication(input, {
    knownSubjectIds: known.map((subject) => subject.subjectId),
  });
  if (!validated.ok) {
    return {
      error: 'Please check the highlighted fields.',
      message: null,
      issues: (validated.error.details ?? {}) as Record<string, string>,
    };
  }

  const result = await submitApplication({
    userId,
    application: validated.value,
    correlationId: randomUUID(),
  });
  if (result.status !== 'submitted') {
    return {
      error:
        result.status === 'not_editable'
          ? 'This application has already been submitted.'
          : 'We could not find your application.',
      message: null,
      issues: {},
    };
  }
  revalidatePath(PAGE);
  redirect(PAGE);
}

export async function withdrawApplicationAction(): Promise<void> {
  const userId = await requireApplicant();
  await withdrawApplication({ userId, correlationId: randomUUID() });
  revalidatePath(PAGE);
  redirect(PAGE);
}
