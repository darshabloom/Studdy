'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  archiveAvailabilityException,
  archiveAvailabilityRule,
  createAvailabilityException,
  createAvailabilityRule,
  tutorProfileForUser,
} from '@studdy/database';
import { validateAvailabilityRule, validateBlockedPeriod } from '@studdy/domain/availability';
import { resolveIdentity } from '../identity/resolve';

/**
 * Tutor availability management.
 *
 * Every action resolves the tutor profile from the SESSION and passes that id
 * into the repository, which folds ownership into the WHERE clause. A posted
 * rule or exception id belonging to another tutor therefore matches zero rows
 * — it is never loaded and then refused, so there is no difference in behaviour
 * between "not yours" and "does not exist".
 */

export interface AvailabilityFormState {
  error: string | null;
  message: string | null;
  issues?: Record<string, string>;
}

const INITIAL: AvailabilityFormState = { error: null, message: null };

async function requireTutor(): Promise<{ tutorProfileId: string; studdyUserId: string }> {
  const identity = await resolveIdentity();
  if (identity === null || identity.studdyUserId === null) {
    redirect('/sign-in?next=%2Ftutor%2Favailability');
  }
  const profile = await tutorProfileForUser(identity.studdyUserId);
  if (profile === null) redirect('/tutor');
  return { tutorProfileId: profile.id, studdyUserId: identity.studdyUserId };
}

export async function addAvailabilityRuleAction(
  _previous: AvailabilityFormState,
  formData: FormData,
): Promise<AvailabilityFormState> {
  const { tutorProfileId, studdyUserId } = await requireTutor();

  const validated = validateAvailabilityRule({
    dayOfWeek: String(formData.get('dayOfWeek') ?? ''),
    localStartTime: String(formData.get('localStartTime') ?? ''),
    localEndTime: String(formData.get('localEndTime') ?? ''),
    ianaTimeZone: String(formData.get('ianaTimeZone') ?? 'Pacific/Auckland'),
  });
  if (!validated.ok) {
    return {
      ...INITIAL,
      error: validated.error.message,
      issues: (validated.error.details ?? {}) as Record<string, string>,
    };
  }

  await createAvailabilityRule({
    tutorProfileId,
    createdByUserId: studdyUserId,
    dayOfWeek: validated.value.dayOfWeek,
    localStartTime: validated.value.localStartTime,
    localEndTime: validated.value.localEndTime,
    ianaTimeZone: validated.value.ianaTimeZone,
    // Today: a tutor adding hours means "from now on", not retroactively.
    effectiveFrom: new Date().toISOString().slice(0, 10),
  });

  revalidatePath('/tutor/availability');
  revalidatePath('/tutor');
  return { ...INITIAL, message: 'Availability added.' };
}

export async function removeAvailabilityRuleAction(formData: FormData): Promise<void> {
  const { tutorProfileId, studdyUserId } = await requireTutor();
  const ruleId = String(formData.get('ruleId') ?? '');
  // Archived, not deleted: a rule that produced slots someone was shown is part
  // of the record of what was offered.
  await archiveAvailabilityRule(ruleId, tutorProfileId, studdyUserId);
  revalidatePath('/tutor/availability');
  revalidatePath('/tutor');
}

export async function addBlockedPeriodAction(
  _previous: AvailabilityFormState,
  formData: FormData,
): Promise<AvailabilityFormState> {
  const { tutorProfileId, studdyUserId } = await requireTutor();

  const validated = validateBlockedPeriod({
    startDate: String(formData.get('startDate') ?? ''),
    startTime: String(formData.get('startTime') ?? ''),
    endDate: String(formData.get('endDate') ?? ''),
    endTime: String(formData.get('endTime') ?? ''),
    ianaTimeZone: String(formData.get('ianaTimeZone') ?? 'Pacific/Auckland'),
    effectCode: String(formData.get('effectCode') ?? 'removes'),
  });
  if (!validated.ok) {
    return {
      ...INITIAL,
      error: validated.error.message,
      issues: (validated.error.details ?? {}) as Record<string, string>,
    };
  }

  await createAvailabilityException({
    tutorProfileId,
    createdByUserId: studdyUserId,
    startsAt: validated.value.startsAt,
    endsAt: validated.value.endsAt,
    effectCode: validated.value.effectCode,
    // The reason and note stay server-side. No family-facing projection selects
    // either, and the form tells the tutor so in plain words.
    reasonCode: emptyToNull(String(formData.get('reasonCode') ?? '')),
    privateNote: emptyToNull(String(formData.get('privateNote') ?? '')),
  });

  revalidatePath('/tutor/availability');
  revalidatePath('/tutor');
  return {
    ...INITIAL,
    message: validated.value.effectCode === 'removes' ? 'Time blocked.' : 'Extra time added.',
  };
}

export async function removeBlockedPeriodAction(formData: FormData): Promise<void> {
  const { tutorProfileId, studdyUserId } = await requireTutor();
  const exceptionId = String(formData.get('exceptionId') ?? '');
  await archiveAvailabilityException(exceptionId, tutorProfileId, studdyUserId);
  revalidatePath('/tutor/availability');
  revalidatePath('/tutor');
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
