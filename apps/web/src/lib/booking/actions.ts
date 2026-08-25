'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createIntendedLessonRequest,
  NoTutorAvailableError,
  RequestValidationError,
  SlotUnavailableError,
} from '@studdy/database';
import { PLATFORM_TIME_ZONE } from '../time';
import { resolveBooking } from './resolve';
import type { RawSearchParams } from './draft';

export interface BookingFormState {
  error: string | null;
  issues?: Record<string, string>;
}

/**
 * Send the request the wizard has been assembling.
 *
 * THE FORM IS NOT TRUSTED, and neither is the URL it came from. Every answer is
 * resolved again here, through exactly the same code the wizard screens used —
 * so a form replayed an hour later, or edited in the browser, is re-checked
 * against what this user may act on and what this tutor still publishes. Only
 * `serviceVersionId` crosses the boundary as an identifier; the duration and
 * the price attached to it are read from the database.
 *
 * The subject section is passed as a DRAFT rather than created here. Creating
 * it first would mean a send that fails — the tutor's time taken between review
 * and submit, say — left a subject on a child's profile from a request that was
 * never sent. Passing the draft puts the find-or-create inside the same
 * transaction as the request, its time options, the tutor request and the hold.
 */
export async function sendBookingRequestAction(
  _previous: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const raw: RawSearchParams = {
    child: String(formData.get('child') ?? ''),
    subject: String(formData.get('subject') ?? ''),
    tutor: String(formData.get('tutor') ?? ''),
    version: String(formData.get('version') ?? ''),
    format: String(formData.get('format') ?? ''),
    time: formData.getAll('time').map(String),
  };

  const booking = await resolveBooking(raw);
  if (booking === null) return { error: 'Sign in to send a request.' };

  const { student, subject, tutor, version, format, times } = booking;
  if (student === null || subject === null || tutor === null || version === null) {
    return { error: 'Some of your choices are no longer available. Start again to pick afresh.' };
  }
  if (format === null) {
    return { error: null, issues: { format: 'Choose whether the lesson is online or in person.' } };
  }
  if (times.length === 0) {
    return { error: null, issues: { times: 'Choose at least one time that would work for you.' } };
  }

  const notes = String(formData.get('notesForTutors') ?? '').trim();

  let reference: string;
  try {
    const created = await createIntendedLessonRequest({
      // A draft, not an id: the section is a consequence of a sent request.
      // Where one already exists for this child and subject, the repository
      // finds it rather than making a rival.
      subjectSectionDraft: {
        studentProfileId: student.studentProfileId,
        subjectId: subject.subjectId,
        schoolYearCode: booking.existingSection?.schoolYearCode ?? student.schoolYearCode,
        formatPreferenceCode: format,
      },
      requestedByUserId: booking.context.studdyUserId,
      familyAccountId: booking.context.familyAccountId,
      tutorProfileIds: [tutor.tutorProfileId],
      serviceVersionIdByTutor: new Map([[tutor.tutorProfileId, version.serviceVersionId]]),
      proposedStarts: times,
      formatCode: format,
      timeZone: PLATFORM_TIME_ZONE,
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
        error: `${tutor.firstName} is no longer free at any of the times you chose, so nothing was sent. Go back and pick some different times.`,
      };
    }
    if (error instanceof SlotUnavailableError) {
      return {
        error: `${tutor.firstName} is no longer free at those times, so nothing was sent. Pick another time and try again.`,
      };
    }
    throw error;
  }

  revalidatePath('/requests');
  revalidatePath('/parent');
  redirect(`/requests/${reference}`);
}
