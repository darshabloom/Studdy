'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  addToShortlist,
  createDependentStudent,
  createSubjectSection,
  ensureFamilyAccountForGuardian,
  ensureIndependentStudentProfile,
  removeFromShortlist,
  subjectSectionBelongsToUser,
} from '@studdy/database';
import { validateStudentProfile, validateSubjectSection } from '@studdy/domain/students';
import { resolveDiscoveryContext } from './context';
import { resolveIdentity } from '../identity/resolve';

export interface FormState {
  error: string | null;
  message: string | null;
  issues?: Record<string, string>;
}

const INITIAL: FormState = { error: null, message: null };

/** Guardian adds a dependent student; the Family Account is created on first use. */
export async function addStudentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const identity = await resolveIdentity();
  if (identity === null || identity.studdyUserId === null) redirect('/sign-in?next=%2Fparent');

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

  const familyAccountId = await ensureFamilyAccountForGuardian({
    studdyUserId: identity.studdyUserId,
    displayName: `${validated.value.familyName ?? identity.displayName ?? 'Studdy'} family`,
    countryCode: 'NZ',
    currencyCode: 'NZD',
  });

  await createDependentStudent({
    familyAccountId,
    actorUserId: identity.studdyUserId,
    preferredName: validated.value.preferredName,
    familyName: validated.value.familyName,
    schoolYearCode: validated.value.schoolYearCode,
    schoolOrProviderName: validated.value.schoolOrProviderName,
  });

  revalidatePath('/parent');
  redirect('/parent');
}

/** Independent student creates their own learning profile. Idempotent. */
export async function setUpOwnProfileAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const identity = await resolveIdentity();
  if (identity === null || identity.studdyUserId === null) redirect('/sign-in?next=%2Fstudent');

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

  await ensureIndependentStudentProfile({
    studdyUserId: identity.studdyUserId,
    preferredName: validated.value.preferredName,
    familyName: validated.value.familyName,
    schoolYearCode: validated.value.schoolYearCode,
    schoolOrProviderName: validated.value.schoolOrProviderName,
  });

  revalidatePath('/student');
  redirect('/student');
}

/** Add a subject need to a student this user may act for. */
export async function addSubjectNeedAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await resolveDiscoveryContext();
  if (context === null) redirect('/sign-in');

  const studentProfileId = String(formData.get('studentProfileId') ?? '');
  // Server-authoritative: never trust the posted student id.
  if (!context.students.some((student) => student.studentProfileId === studentProfileId)) {
    return { ...INITIAL, error: 'You do not have access to that student.' };
  }

  const validated = validateSubjectSection({
    subjectId: String(formData.get('subjectId') ?? ''),
    schoolYearCode: String(formData.get('schoolYearCode') ?? ''),
    formatPreferenceCode: String(formData.get('formatPreferenceCode') ?? 'either'),
    goals: String(formData.get('goals') ?? ''),
  });
  if (!validated.ok) {
    return {
      ...INITIAL,
      error: 'Please check the highlighted fields.',
      issues: (validated.error.details ?? {}) as Record<string, string>,
    };
  }

  const { subjectSectionId } = await createSubjectSection({
    studentProfileId,
    actorUserId: context.studdyUserId,
    subjectId: validated.value.subjectId,
    schoolYearCode: validated.value.schoolYearCode,
    formatPreferenceCode: validated.value.formatPreferenceCode,
    goals: validated.value.goals,
  });

  redirect(`/tutors?section=${subjectSectionId}`);
}

/** Add a tutor to a subject section's shortlist. */
export async function addToShortlistAction(formData: FormData): Promise<void> {
  const context = await resolveDiscoveryContext();
  if (context === null) redirect('/sign-in');

  const subjectSectionId = String(formData.get('subjectSectionId') ?? '');
  const tutorReference = String(formData.get('tutorReference') ?? '');
  const returnTo = String(formData.get('returnTo') ?? '/tutors');

  const permitted = await subjectSectionBelongsToUser(subjectSectionId, context.studdyUserId);
  if (!permitted) redirect('/tutors');

  const outcome = await addToShortlist({
    subjectSectionId,
    tutorReference,
    actorUserId: context.studdyUserId,
  });

  const separator = returnTo.includes('?') ? '&' : '?';
  const suffix = outcome.kind === 'full' ? `${separator}shortlist=full` : '';
  revalidatePath(returnTo);
  redirect(`${returnTo}${suffix}`);
}

export async function removeFromShortlistAction(formData: FormData): Promise<void> {
  const context = await resolveDiscoveryContext();
  if (context === null) redirect('/sign-in');

  const subjectSectionId = String(formData.get('subjectSectionId') ?? '');
  const entryId = String(formData.get('entryId') ?? '');
  const returnTo = String(formData.get('returnTo') ?? `/shortlist/${subjectSectionId}`);

  const permitted = await subjectSectionBelongsToUser(subjectSectionId, context.studdyUserId);
  if (!permitted) redirect('/tutors');

  await removeFromShortlist({ subjectSectionId, entryId });
  revalidatePath(returnTo);
  redirect(returnTo);
}
