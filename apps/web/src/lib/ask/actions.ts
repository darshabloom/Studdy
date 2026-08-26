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
// Answers arrive as form fields and are re-parsed through the same rules the
// screens use, so the form cannot smuggle in a shape they would have rejected.
import { resolveAsk } from './resolve';

export interface AskFormState {
  error: string | null;
}

/**
 * Send one multi-tutor request.
 *
 * NOTHING IN THE FORM IS TRUSTED. The section, the shortlist, the duration, the
 * format and the resulting eligibility are all re-resolved here from the
 * signed-in user, exactly as the screens resolved them — so a crafted form
 * cannot add a tutor who is not on the shortlist, pin one to another's price,
 * or ask for a lesson nobody published. The form carries answers, never
 * identifiers of things it wants included.
 *
 * The duration is asserted to `createIntendedLessonRequest` as well, which
 * refuses the whole request if any resolved version disagrees. That is
 * belt-and-braces on purpose: this action decides eligibility, and the
 * repository refuses to write a request that is not one coherent lesson
 * whatever a caller believes.
 */
export async function sendAskRequestAction(
  _previous: AskFormState,
  formData: FormData,
): Promise<AskFormState> {
  const subjectSectionId = String(formData.get('subjectSectionId') ?? '');
  const notes = String(formData.get('notesForTutors') ?? '').trim();

  const ask = await resolveAsk(subjectSectionId, parseAskParamsFromForm(formData));
  if (ask === null) return { error: 'You do not have access to that subject.' };

  const { params, eligibility, times } = ask;
  if (params.duration === null || params.format === null || eligibility === null) {
    return { error: 'Choose a lesson length and format before sending.' };
  }
  if (eligibility.included.length === 0) {
    return { error: 'None of your shortlisted tutors can take this request.' };
  }
  if (times.length === 0) {
    return { error: 'Choose at least one time that works for you.' };
  }

  const included = eligibility.included;

  try {
    const created = await createIntendedLessonRequest({
      studentSubjectSectionId: ask.section.subjectSectionId,
      requestedByUserId: ask.context.studdyUserId,
      familyAccountId: ask.context.familyAccountId,
      tutorProfileIds: included.map((entry) => entry.tutorProfileId),
      // Each tutor pinned to their OWN version at the shared duration, which is
      // what makes one chosen start mean one interval for all of them.
      serviceVersionIdByTutor: new Map(
        included.map((entry) => [entry.tutorProfileId, entry.serviceVersionId]),
      ),
      proposedStarts: [...times],
      requestedDurationMinutes: params.duration,
      formatCode: params.format,
      timeZone: 'Pacific/Auckland',
      notesForTutors: notes === '' ? null : notes,
      // No payment work in this slice; the gate stays disabled.
      hasPaymentMethodOnFile: false,
      paymentExemptionCode: null,
      correlationId: `cor_${randomUUID()}`,
    });

    revalidatePath('/requests');
    revalidatePath(`/shortlist/${subjectSectionId}`);
    redirect(`/requests/${created.reference}`);
  } catch (error) {
    if (error instanceof NoTutorAvailableError) {
      return {
        error:
          'None of these tutors can do the times you chose any more. Go back and pick another.',
      };
    }
    if (error instanceof SlotUnavailableError) {
      return { error: 'One of those times has just been taken. Go back and pick another.' };
    }
    if (error instanceof RequestValidationError) {
      return { error: 'That request could not be sent. Check your answers and try again.' };
    }
    throw error;
  }
}

/**
 * The answers the review form carries back, in the shape `resolveAsk` reads.
 *
 * NOT EXPORTED. A `'use server'` file may only export async functions, and
 * exporting a helper from one passes typecheck and fails at `pnpm build` —
 * which is a long way from here to find out.
 */
function parseAskParamsFromForm(formData: FormData): Record<string, string | string[]> {
  const duration = String(formData.get('duration') ?? '');
  const format = String(formData.get('format') ?? '');
  const times = formData.getAll('time').map(String).filter(Boolean);
  return { duration, format, time: times };
}
