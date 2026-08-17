'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createIntendedLessonRequest,
  findRequestForStudents,
  NoTutorAvailableError,
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
 * The zone lesson times are entered and stored in.
 *
 * The form collects a wall-clock date and time, which is meaningless without a
 * zone. Constructing `new Date('2026-09-01T16:00:00')` would read it in the
 * *server's* zone — 16:00 on a developer's machine in Auckland, but 16:00 UTC
 * on a CI runner or a deployed host, i.e. a different lesson four in the
 * morning. Availability rules are stored against this zone, so the entered time
 * has to be resolved against it too or a request lands outside the hours the
 * tutor actually offered.
 */
const REQUEST_TIME_ZONE = 'Pacific/Auckland';

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

  const formatCode = String(formData.get('formatCode') ?? 'online');
  const notes = String(formData.get('notesForTutors') ?? '').trim();

  // The times the family chose on the availability grid. They arrive as
  // instants rather than a wall-clock date and time, because they were picked
  // from real bookable slots — there is no wall clock left to interpret, and
  // nothing for a zone mismatch to shift.
  const proposedStarts: Date[] = [];
  for (const raw of formData.getAll('time').map(String)) {
    const at = new Date(raw);
    if (Number.isNaN(at.getTime())) {
      return { error: null, issues: { times: 'One of those times could not be understood.' } };
    }
    proposedStarts.push(at);
  }
  if (proposedStarts.length === 0) {
    return { error: null, issues: { times: 'Choose the times that would suit you.' } };
  }

  let reference: string;
  try {
    const created = await createIntendedLessonRequest({
      studentSubjectSectionId: subjectSectionId,
      requestedByUserId: context.studdyUserId,
      familyAccountId: context.familyAccountId,
      tutorProfileIds,
      proposedStarts,
      formatCode,
      timeZone: REQUEST_TIME_ZONE,
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
    if (error instanceof NoTutorAvailableError) {
      return {
        error:
          'None of the tutors you chose are free at any of those times any more, so nothing was sent. Go back and choose some different times.',
      };
    }
    if (error instanceof SlotUnavailableError) {
      return {
        error:
          'One of the tutors you chose is no longer free at those times, so nothing was sent. Choose another time, or a different tutor, and try again.',
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
