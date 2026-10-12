'use server';

import { redirect } from 'next/navigation';
import { listAccessibleStudents, updateDependentStudent } from '@studdy/database';
import { validateStudentProfile } from '@studdy/domain/students';
import type { FormState } from '@/lib/discovery/actions';
import { resolveIdentity } from '@/lib/identity/resolve';

const INITIAL: FormState = { error: null, message: null };

/**
 * A guardian corrects one of their own students.
 *
 * The reference is bound by the page, but it is only ever used to pick a
 * student out of the list this person may already act for — so a reference
 * belonging to another family finds nothing. The update itself is scoped to the
 * family again in the repository, which is the check that counts.
 */
export async function updateStudentAction(
  studentReference: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const identity = await resolveIdentity();
  if (identity === null || identity.studdyUserId === null) redirect('/sign-in?next=%2Fparent');

  const { familyAccountId, students } = await listAccessibleStudents(identity.studdyUserId);
  const student = students.find((entry) => entry.reference === studentReference);
  if (familyAccountId === null || student === undefined) {
    return { ...INITIAL, error: 'You do not have access to that student.' };
  }

  const validated = validateStudentProfile({
    preferredName: String(formData.get('preferredName') ?? ''),
    familyName: String(formData.get('familyName') ?? ''),
    schoolYearCode: String(formData.get('schoolYearCode') ?? ''),
    schoolOrProviderName: String(formData.get('schoolOrProviderName') ?? ''),
  });
  if (!validated.ok) {
    return {
      ...INITIAL,
      error: 'Please check the highlighted fields.',
      issues: (validated.error.details ?? {}) as Record<string, string>,
    };
  }

  const updated = await updateDependentStudent({
    studentProfileId: student.studentProfileId,
    familyAccountId,
    actorUserId: identity.studdyUserId,
    ...validated.value,
  });
  if (!updated) {
    return { ...INITIAL, error: 'Those details could not be saved. Please try again.' };
  }

  /*
   * REPORTS SUCCESS AND NOTHING ELSE; THE FORM REFRESHES AND NAVIGATES.
   *
   * This used to `revalidatePath()` and `redirect()`. In CI the save was written
   * and the server began its reply every time, but on the first save in a
   * session the reply never finished: with a redirect the browser never
   * followed it, and without one the response body stayed open, in both cases
   * leaving the form reading "Saving". What both had in common was the server
   * re-rendering a page inside the action's own response. Why that render
   * stalls is not established. Returning only the destination keeps the reply
   * to a few bytes, and the form asks for fresh pages itself.
   */
  return { ...INITIAL, savedHref: `/parent/students/${student.reference}` };
}
