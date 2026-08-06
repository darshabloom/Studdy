'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createIntendedLessonRequest,
  findRequestForStudents,
  RequestValidationError,
  SlotUnavailableError,
  withdrawRequest,
} from '@studdy/database';
import { resolveDiscoveryContext } from '../discovery/context';

export interface RequestFormState {
  error: string | null;
  issues?: Record<string, string>;
}

/**
 * Send an Intended Lesson Request to the chosen tutors.
 *
 * Authorisation is resolved server-side from the signed-in user: the subject
 * section must belong to a student they may act for. A section id supplied in
 * the form is never trusted on its own.
 */
export async function sendLessonRequestAction(
  _previous: RequestFormState,
  formData: FormData,
): Promise<RequestFormState> {
  const context = await resolveDiscoveryContext();
  if (context === null) {
    return { error: 'Sign in to send a request.' };
  }

  const subjectSectionId = String(formData.get('subjectSectionId') ?? '');
  const section = context.subjectSections.find(
    (candidate) => candidate.subjectSectionId === subjectSectionId,
  );
  if (section === undefined) {
    return { error: 'You do not have access to that subject.' };
  }

  const tutorProfileIds = formData.getAll('tutorProfileId').map(String).filter(Boolean);
  if (tutorProfileIds.length === 0) {
    return { error: null, issues: { targets: 'Choose at least one tutor.' } };
  }

  const date = String(formData.get('lessonDate') ?? '');
  const time = String(formData.get('lessonTime') ?? '');
  const durationMinutes = Number(formData.get('durationMinutes') ?? 60);
  const formatCode = String(formData.get('formatCode') ?? 'online');
  const notes = String(formData.get('notesForTutors') ?? '').trim();

  if (date === '' || time === '') {
    return {
      error: null,
      issues: { lessonDate: 'Choose the date and time you would like the lesson.' },
    };
  }

  const proposedStartAt = new Date(`${date}T${time}:00`);
  if (Number.isNaN(proposedStartAt.getTime())) {
    return { error: null, issues: { lessonDate: 'That date and time could not be understood.' } };
  }
  const proposedEndAt = new Date(proposedStartAt.getTime() + durationMinutes * 60 * 1000);

  let reference: string;
  try {
    const created = await createIntendedLessonRequest({
      studentSubjectSectionId: subjectSectionId,
      requestedByUserId: context.studdyUserId,
      familyAccountId: context.familyAccountId,
      tutorProfileIds,
      proposedStartAt,
      proposedEndAt,
      formatCode,
      timeZone: 'Pacific/Auckland',
      notesForTutors: notes === '' ? null : notes,
      // No payment method exists until the Stripe slice; the gate is
      // configuration-driven and currently disabled.
      hasPaymentMethodOnFile: false,
      paymentExemptionCode: null,
      correlationId: `cor_${randomUUID()}`,
    });
    reference = created.reference;
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return { error: null, issues: error.issues };
    }
    if (error instanceof SlotUnavailableError) {
      return {
        error:
          'One of the tutors you chose is no longer free at that time, so nothing was sent. Choose another time, or a different tutor, and try again.',
      };
    }
    throw error;
  }

  revalidatePath('/requests');
  redirect(`/requests/${reference}`);
}

/** Withdraw one tutor request, or the whole request when no tutor is named. */
export async function withdrawRequestAction(formData: FormData): Promise<void> {
  const context = await resolveDiscoveryContext();
  if (context === null) redirect('/sign-in');

  const reference = String(formData.get('reference') ?? '');
  const tutorRequestId = String(formData.get('tutorRequestId') ?? '');

  // Re-resolve the request through the family projection so a caller cannot
  // withdraw a request belonging to someone else by guessing identifiers.
  const studentProfileIds = context.students.map((student) => student.studentProfileId);
  const request = await findRequestForStudents(reference, studentProfileIds);
  if (request === null) redirect('/requests');

  if (tutorRequestId !== '') {
    const owned = request.tutorRequests.some((entry) => entry.tutorRequestId === tutorRequestId);
    if (!owned) redirect(`/requests/${reference}`);
  }

  await withdrawRequest({
    intendedLessonRequestId: request.intendedLessonRequestId,
    actorUserId: context.studdyUserId,
    correlationId: `cor_${randomUUID()}`,
    ...(tutorRequestId === '' ? {} : { tutorRequestId }),
  });

  revalidatePath('/requests');
  revalidatePath(`/requests/${reference}`);
  redirect(`/requests/${reference}`);
}
