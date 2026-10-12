'use server';

import { revalidatePath } from 'next/cache';
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

  revalidatePath('/parent');
  /*
   * REPORTS SUCCESS; THE FORM NAVIGATES. This used to `redirect()` here. In CI
   * the server answered the save every time (a 303), yet on the first save in
   * a session the browser stayed on the form reading "Saving" and never
   * followed it. Why the redirect was dropped is not established. Returning
   * where to go and letting the form push there does not depend on it.
   */
  return { ...INITIAL, savedHref: `/parent/students/${student.reference}` };
}
