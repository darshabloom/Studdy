import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  EDITABLE_APPLICATION_STATUSES,
  emptyApplicationV2,
  type TutorApplicationV2Draft,
} from '@studdy/domain/tutors';
import { createDatabaseClient } from '../client';
import { tutorApplications } from '../schema/index';
import { coerceDraft } from './tutor-applications';

/**
 * Versioned Tutor application draft persistence.
 *
 * This is intentionally separate from the active v1 application route.
 * It reuses the private, server-only jsonb working-copy column and does not
 * create a second application/role or a second public tutor profile.
 *
 * A version number prevents simultaneous tabs from silently overwriting each
 * other. The final submission will later be a distinct immutable transaction.
 */

export type V2DraftRead =
  | {
      readonly status: 'ready';
      readonly draft: TutorApplicationV2Draft;
      readonly recordVersion: number;
    }
  | { readonly status: 'legacy_requires_review' | 'not_editable' | 'not_found' };

export type V2DraftSave =
  | { readonly status: 'saved'; readonly recordVersion: number }
  | {
      readonly status:
        | 'conflict'
        | 'invalid_draft'
        | 'too_large'
        | 'legacy_requires_review'
        | 'not_editable'
        | 'not_found';
    };

function isV2Draft(value: unknown): value is TutorApplicationV2Draft {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const draft = value as Record<string, unknown>;
  return (
    draft['schemaVersion'] === 2 &&
    typeof draft['about'] === 'object' &&
    draft['about'] !== null &&
    typeof draft['subjects'] === 'object' &&
    draft['subjects'] !== null &&
    typeof draft['teaching'] === 'object' &&
    draft['teaching'] !== null &&
    typeof draft['qualifications'] === 'object' &&
    draft['qualifications'] !== null &&
    Array.isArray(draft['references']) &&
    typeof draft['declarations'] === 'object' &&
    draft['declarations'] !== null
  );
}

function hasLegacyAnswers(value: unknown): boolean {
  const draft = coerceDraft(value);
  return (
    draft.headline.trim() !== '' ||
    draft.teachingApproach.trim() !== '' ||
    draft.experienceSummary.trim() !== '' ||
    draft.qualificationsSummary.trim() !== '' ||
    draft.subjectIds.length > 0 ||
    draft.yearLevelFrom.trim() !== '' ||
    draft.yearLevelTo.trim() !== '' ||
    draft.references.some(
      (reference) =>
        reference.fullName.trim() !== '' ||
        reference.email.trim() !== '' ||
        reference.relationship.trim() !== '',
    )
  );
}

/** An authenticated applicant reads only their own live application. */
export async function applicationV2DraftForApplicant(userId: string): Promise<V2DraftRead> {
  const { sql: client, db } = createDatabaseClient();
  try {
    const [row] = await db
      .select({
        statusCode: tutorApplications.statusCode,
        draft: tutorApplications.draft,
        recordVersion: tutorApplications.recordVersion,
      })
      .from(tutorApplications)
      .where(eq(tutorApplications.applicantUserId, userId))
      .orderBy(
        sql`case when ${tutorApplications.statusCode} in ('draft', 'changes_requested') then 0 else 1 end`,
      )
      .limit(1);
    if (row === undefined) return { status: 'not_found' };
    if (!(EDITABLE_APPLICATION_STATUSES as readonly string[]).includes(row.statusCode)) {
      return { status: 'not_editable' };
    }
    if (!isV2Draft(row.draft)) return { status: 'legacy_requires_review' };
    return { status: 'ready', draft: row.draft, recordVersion: row.recordVersion };
  } finally {
    await client.end();
  }
}

/**
 * Explicit upgrade for an application that has only identity-prefill fields.
 * Existing v1 answers are never silently discarded: populated drafts are
 * returned for a future guided migration review.
 */
export async function initialiseApplicationV2Draft(input: {
  readonly userId: string;
  readonly expectedRecordVersion: number;
}): Promise<V2DraftRead> {
  const { sql: client, db } = createDatabaseClient();
  try {
    return await db.transaction(async (tx): Promise<V2DraftRead> => {
      const [row] = await tx
        .select()
        .from(tutorApplications)
        .where(eq(tutorApplications.applicantUserId, input.userId))
        .orderBy(
          sql`case when ${tutorApplications.statusCode} in ('draft', 'changes_requested') then 0 else 1 end`,
        )
        .limit(1)
        .for('update');
      if (row === undefined) return { status: 'not_found' };
      if (!(EDITABLE_APPLICATION_STATUSES as readonly string[]).includes(row.statusCode)) {
        return { status: 'not_editable' };
      }
      if (isV2Draft(row.draft)) {
        return { status: 'ready', draft: row.draft, recordVersion: row.recordVersion };
      }
      if (row.recordVersion !== input.expectedRecordVersion || hasLegacyAnswers(row.draft)) {
        return { status: 'legacy_requires_review' };
      }
      const legacy = coerceDraft(row.draft);
      const blank = emptyApplicationV2();
      const draft: TutorApplicationV2Draft = {
        ...blank,
        about: {
          ...blank.about,
          legalFirstName: legacy.legalFirstName,
          legalFamilyName: legacy.legalFamilyName,
          preferredFirstName: legacy.preferredFirstName,
          mobile: legacy.phone,
        },
      };
      const [saved] = await tx
        .update(tutorApplications)
        .set({
          draft,
          recordVersion: sql`${tutorApplications.recordVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tutorApplications.id, row.id),
            eq(tutorApplications.recordVersion, input.expectedRecordVersion),
          ),
        )
        .returning({ recordVersion: tutorApplications.recordVersion });
      if (saved === undefined) return { status: 'legacy_requires_review' };
      return { status: 'ready', draft, recordVersion: saved.recordVersion };
    });
  } finally {
    await client.end();
  }
}

/**
 * Debounced autosave callers must pass the last version they read.
 * A stale tab gets 'conflict' and cannot wipe a newer draft.
 * All consequential operations stay server scoped by the authenticated user.
 */
export async function saveApplicationV2Draft(input: {
  readonly userId: string;
  readonly expectedRecordVersion: number;
  readonly draft: TutorApplicationV2Draft;
}): Promise<V2DraftSave> {
  if (!isV2Draft(input.draft)) return { status: 'invalid_draft' };
  if (JSON.stringify(input.draft).length > 100_000) return { status: 'too_large' };

  const { sql: client, db } = createDatabaseClient();
  try {
    const [saved] = await db
      .update(tutorApplications)
      .set({
        draft: input.draft,
        recordVersion: sql`${tutorApplications.recordVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tutorApplications.applicantUserId, input.userId),
          inArray(tutorApplications.statusCode, [...EDITABLE_APPLICATION_STATUSES]),
          eq(tutorApplications.recordVersion, input.expectedRecordVersion),
          sql`${tutorApplications.draft} ->> 'schemaVersion' = '2'`,
        ),
      )
      .returning({ recordVersion: tutorApplications.recordVersion });
    if (saved !== undefined) return { status: 'saved', recordVersion: saved.recordVersion };

    const state = await applicationV2DraftForApplicant(input.userId);
    if (state.status === 'ready') return { status: 'conflict' };
    return { status: state.status };
  } finally {
    await client.end();
  }
}
