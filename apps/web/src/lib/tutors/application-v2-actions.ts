'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import {
  applicationV2DraftForApplicant,
  initialiseApplicationV2Draft,
  saveApplicationV2Draft,
  startTutorApplication,
  type V2DraftSave,
} from '@studdy/database';
import type { TutorApplicationV2Draft } from '@studdy/domain/tutors';
import { resolveIdentity } from '@/lib/identity/resolve';

const ROUTE = '/apply/tutor/v2';

async function applicantId(): Promise<string> {
  const identity = await resolveIdentity();
  if (identity === null) redirect('/sign-in?next=%2Fapply%2Ftutor%2Fv2');
  if (!identity.databaseAvailable || identity.studdyUserId === null) {
    throw new Error('Your application is temporarily unavailable.');
  }
  if (identity.roleAssignments.some((role) => role.roleCode === 'tutor')) {
    redirect('/tutor');
  }
  return identity.studdyUserId;
}

/** Explicit click only: initiating an application changes the account's pending tutor role. */
export async function startV2ApplicationAction(): Promise<void> {
  if (process.env.STUDDY_APPLICATION_V2_ENABLED !== 'true') redirect(ROUTE);
  const userId = await applicantId();
  const result = await startTutorApplication({ userId, correlationId: randomUUID() });
  if (result.status === 'already_a_tutor') redirect('/tutor');
  const workingCopy = await applicationV2DraftForApplicant(userId);
  if (workingCopy.status === 'legacy_requires_review') {
    await initialiseApplicationV2Draft({ userId });
  }
  redirect(ROUTE);
}

/** Called by the browser after debouncing changes. No browser-supplied account ID is trusted. */
export async function saveV2DraftAction(
  draft: TutorApplicationV2Draft,
  version: number,
): Promise<V2DraftSave> {
  if (process.env.STUDDY_APPLICATION_V2_ENABLED !== 'true') return { status: 'not_editable' };
  const userId = await applicantId();
  if (!Number.isSafeInteger(version) || version < 1) return { status: 'invalid_draft' };
  return saveApplicationV2Draft({ userId, expectedRecordVersion: version, draft });
}
