import { and, asc, desc, eq, inArray, sql as raw } from 'drizzle-orm';
import {
  APPLICATION_CHECK_CODES,
  APPLICATION_DECLARATIONS_VERSION,
  DECIDABLE_APPLICATION_STATUSES,
  EDITABLE_APPLICATION_STATUSES,
  EMPTY_TUTOR_APPLICATION,
  TUTOR_APPLICATION_RULE_KEYS,
  approvalReadiness,
  publicLabelForCheck,
  requiredChecksFrom,
  type ApplicationCheckCode,
  type ApplicationCheckStatus,
  type ApprovalReadiness,
  type TutorApplicationInput,
  type TutorApplicationStatus,
  type ValidatedTutorApplication,
} from '@studdy/domain/tutors';
import { createDatabaseClient } from '../client';
import {
  auditEvents,
  authIdentityLinks,
  domainEvents,
  roleDefinitions,
  ruleSettings,
  statusTransitions,
  subjects,
  tutorApplicationChecks,
  tutorApplicationRevisionReferences,
  tutorApplicationRevisions,
  tutorApplicationRevisionSubjects,
  tutorApplications,
  tutorProfiles,
  tutorVerifications,
  userRoleAssignments,
  users,
} from '../schema/index';

/**
 * TUTOR APPLICATIONS — applying, being reviewed, and becoming a tutor.
 *
 * AN APPLICATION IS A WORKFLOW RECORD, NOT A PROFILE. Nothing in here can make
 * anyone visible, bookable or able to enter the tutor workspace except
 * `approveApplication`, which is one controlled transaction and the only place a
 * tutor profile is created from an application.
 *
 * TWO CALLERS, TWO TRUSTS. The applicant functions take the signed-in user's id
 * and are scoped to it in the query itself, so an applicant can only ever reach
 * their own application — there is no application id for them to tamper with.
 * The reviewer functions take an `actorUserId` for the audit trail but DO NOT
 * check that the actor may review: that is the caller's job (the web layer's
 * `requireStaff`, which also re-checks MFA), because a repository that guessed at
 * roles would be a second, divergent source of that decision.
 *
 * Every state change is `UPDATE ... WHERE status_code IN (<what may move to here>)`
 * on a row locked for the decision, so two reviewers acting at once serialise and
 * the loser is told the application is no longer in a state they can decide.
 *
 * Personal data lives here (legal names, a phone, referees' emails). It is read
 * only through the server, and nothing in this file logs it.
 */

// ---------------------------------------------------------------------------
// Draft handling
// ---------------------------------------------------------------------------

const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

/**
 * Coerce a stored working copy into the shape the form uses, tolerating anything.
 *
 * A draft is jsonb written by the application, but it is also the one column an
 * older version of the form may have written differently, so it is read
 * defensively and never trusted to be complete.
 */
export function coerceDraft(value: unknown): TutorApplicationInput {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return EMPTY_TUTOR_APPLICATION;
  }
  const raw_ = value as Record<string, unknown>;
  const referencesRaw = Array.isArray(raw_['references']) ? raw_['references'] : [];
  const references = referencesRaw.slice(0, 3).map((entry) => {
    const record = (entry !== null && typeof entry === 'object' ? entry : {}) as Record<
      string,
      unknown
    >;
    return {
      fullName: str(record['fullName']),
      email: str(record['email']),
      relationship: str(record['relationship']),
    };
  });
  while (references.length < 2) references.push({ fullName: '', email: '', relationship: '' });

  return {
    legalFirstName: str(raw_['legalFirstName']),
    legalFamilyName: str(raw_['legalFamilyName']),
    preferredFirstName: str(raw_['preferredFirstName']),
    phone: str(raw_['phone']),
    headline: str(raw_['headline']),
    teachingApproach: str(raw_['teachingApproach']),
    experienceSummary: str(raw_['experienceSummary']),
    qualificationsSummary: str(raw_['qualificationsSummary']),
    subjectIds: Array.isArray(raw_['subjectIds'])
      ? raw_['subjectIds'].filter((id): id is string => typeof id === 'string')
      : [],
    yearLevelFrom: str(raw_['yearLevelFrom']),
    yearLevelTo: str(raw_['yearLevelTo']),
    offersOnline: bool(raw_['offersOnline'], true),
    offersInPerson: bool(raw_['offersInPerson'], false),
    references,
    // Never carried over from a draft: acceptance is given afresh at submission.
    declarationsAccepted: false,
  };
}

// ---------------------------------------------------------------------------
// Shared reads
// ---------------------------------------------------------------------------

type Db = ReturnType<typeof createDatabaseClient>['db'];
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const LIVE_STATUSES = ['draft', 'submitted', 'under_review', 'changes_requested', 'approved'];

/** The latest revision of an application, as the form's input shape. */
async function revisionAsInput(
  reader: Db | Tx,
  applicationId: string,
  revisionNumber: number,
): Promise<TutorApplicationInput | null> {
  const [revision] = await reader
    .select()
    .from(tutorApplicationRevisions)
    .where(
      and(
        eq(tutorApplicationRevisions.applicationId, applicationId),
        eq(tutorApplicationRevisions.revisionNumber, revisionNumber),
      ),
    )
    .limit(1);
  if (revision === undefined) return null;

  const subjectRows = await reader
    .select({ subjectId: tutorApplicationRevisionSubjects.subjectId })
    .from(tutorApplicationRevisionSubjects)
    .where(eq(tutorApplicationRevisionSubjects.revisionId, revision.id));
  const referenceRows = await reader
    .select()
    .from(tutorApplicationRevisionReferences)
    .where(eq(tutorApplicationRevisionReferences.revisionId, revision.id))
    .orderBy(asc(tutorApplicationRevisionReferences.position));

  return {
    legalFirstName: revision.legalFirstName,
    legalFamilyName: revision.legalFamilyName,
    preferredFirstName: revision.preferredFirstName,
    phone: revision.phone ?? '',
    headline: revision.headline,
    teachingApproach: revision.teachingApproach,
    experienceSummary: revision.experienceSummary,
    qualificationsSummary: revision.qualificationsSummary ?? '',
    subjectIds: subjectRows.map((row) => row.subjectId),
    yearLevelFrom: String(revision.yearLevelFrom),
    yearLevelTo: String(revision.yearLevelTo),
    offersOnline: revision.offersOnline,
    offersInPerson: revision.offersInPerson,
    references: referenceRows.map((row) => ({
      fullName: row.fullName,
      email: row.email,
      relationship: row.relationship,
    })),
    declarationsAccepted: false,
  };
}

// ---------------------------------------------------------------------------
// The applicant
// ---------------------------------------------------------------------------

/** What an applicant is shown about their own application. */
export interface ApplicantApplication {
  readonly reference: string;
  readonly status: TutorApplicationStatus;
  /** The working copy, or the last submitted revision when there is no draft. */
  readonly form: TutorApplicationInput;
  readonly currentRevisionNumber: number;
  readonly submittedAt: Date | null;
  /** What Studdy told the applicant with a decision. Never a reviewer's own note. */
  readonly applicantMessage: string | null;
  /** The applicant may still edit and submit. */
  readonly editable: boolean;
}

/**
 * The signed-in user's own application — the live one if there is one, otherwise
 * the most recent. Scoped by user id in the query: there is no id to tamper with.
 */
export async function applicationForApplicant(
  userId: string,
): Promise<ApplicantApplication | null> {
  const { sql: client, db } = createDatabaseClient();
  try {
    const [application] = await db
      .select()
      .from(tutorApplications)
      .where(eq(tutorApplications.applicantUserId, userId))
      .orderBy(
        // A live application beats a historical one, then the newest.
        raw`(${tutorApplications.statusCode} in ('draft','submitted','under_review','changes_requested','approved')) desc`,
        desc(tutorApplications.createdAt),
      )
      .limit(1);
    if (application === undefined) return null;

    const status = application.statusCode as TutorApplicationStatus;
    const editable = (EDITABLE_APPLICATION_STATUSES as readonly string[]).includes(status);

    let form: TutorApplicationInput;
    if (editable && application.draft !== null) {
      form = coerceDraft(application.draft);
    } else if (application.currentRevisionNumber > 0) {
      form =
        (await revisionAsInput(db, application.id, application.currentRevisionNumber)) ??
        EMPTY_TUTOR_APPLICATION;
    } else {
      form = EMPTY_TUTOR_APPLICATION;
    }

    return {
      reference: application.reference,
      status,
      form,
      currentRevisionNumber: application.currentRevisionNumber,
      submittedAt: application.submittedAt,
      applicantMessage:
        status === 'changes_requested' || status === 'rejected'
          ? application.applicantMessage
          : null,
      editable,
    };
  } finally {
    await client.end();
  }
}

export type StartApplicationResult =
  | { readonly status: 'started' | 'existing'; readonly reference: string }
  | { readonly status: 'already_a_tutor' };

/**
 * Begin an application, or return the one already in progress. IDEMPOTENT: the
 * live-application unique index means two clicks cannot make two.
 *
 * Also ensures the applicant holds a PENDING tutor role, so the rest of Studdy
 * recognises "applying" — which grants nothing: a pending role has no workspace.
 * Refused for someone who is already an active tutor.
 */
export async function startTutorApplication(input: {
  readonly userId: string;
  readonly correlationId: string;
  readonly now?: Date;
}): Promise<StartApplicationResult> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx): Promise<StartApplicationResult> => {
      // Serialise concurrent starts for one person on their user row.
      await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1)
        .for('update');

      const [existing] = await tx
        .select({ reference: tutorApplications.reference })
        .from(tutorApplications)
        .where(
          and(
            eq(tutorApplications.applicantUserId, input.userId),
            inArray(tutorApplications.statusCode, LIVE_STATUSES),
          ),
        )
        .limit(1);
      if (existing !== undefined) return { status: 'existing', reference: existing.reference };

      const [role] = await tx
        .select({ id: roleDefinitions.id })
        .from(roleDefinitions)
        .where(eq(roleDefinitions.code, 'tutor'))
        .limit(1);
      if (role === undefined) throw new Error('The tutor role definition is missing.');

      const [assignment] = await tx
        .select({ id: userRoleAssignments.id, statusCode: userRoleAssignments.statusCode })
        .from(userRoleAssignments)
        .where(
          and(
            eq(userRoleAssignments.userId, input.userId),
            eq(userRoleAssignments.roleDefinitionId, role.id),
            inArray(userRoleAssignments.statusCode, ['active', 'pending']),
          ),
        )
        .limit(1);
      if (assignment?.statusCode === 'active') return { status: 'already_a_tutor' };

      if (assignment === undefined) {
        const [created] = await tx
          .insert(userRoleAssignments)
          .values({
            userId: input.userId,
            roleDefinitionId: role.id,
            statusCode: 'pending',
            workspaceEnabled: false,
            assignmentReasonCode: 'tutor_application_started',
            assignedByUserId: input.userId,
          })
          .returning({ id: userRoleAssignments.id });
        if (created !== undefined) {
          await tx.insert(statusTransitions).values({
            entityType: 'identity.user_role_assignments',
            entityId: created.id,
            fromStatusCode: null,
            toStatusCode: 'pending',
            actorUserId: input.userId,
            reasonCode: 'tutor_application_started',
            correlationId: input.correlationId,
            occurredAt: now,
          });
        }
      }

      // Prefill what Studdy already knows, so the form does not ask twice.
      const [person] = await tx
        .select({ preferredName: users.preferredName, familyName: users.familyName })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      const draft: TutorApplicationInput = {
        ...EMPTY_TUTOR_APPLICATION,
        legalFirstName: person?.preferredName ?? '',
        legalFamilyName: person?.familyName ?? '',
        preferredFirstName: person?.preferredName ?? '',
      };

      const [application] = await tx
        .insert(tutorApplications)
        .values({ applicantUserId: input.userId, statusCode: 'draft', draft })
        .returning({ id: tutorApplications.id, reference: tutorApplications.reference });
      if (application === undefined) throw new Error('application insert returned no row');

      await tx.insert(statusTransitions).values({
        entityType: 'tutor_application',
        entityId: application.id,
        fromStatusCode: null,
        toStatusCode: 'draft',
        actorUserId: input.userId,
        reasonCode: 'application_started',
        correlationId: input.correlationId,
        occurredAt: now,
      });
      await tx.insert(domainEvents).values({
        eventType: 'tutor_application.started',
        entityType: 'tutor_application',
        entityId: application.id,
        payload: { applicationId: application.id },
        correlationId: input.correlationId,
        occurredAt: now,
      });
      return { status: 'started', reference: application.reference };
    });
  } finally {
    await client.end();
  }
}

export type SaveDraftResult = 'saved' | 'not_editable' | 'not_found';

/**
 * Save the applicant's working copy. NOT validated, deliberately: a half-written
 * application must be saveable or the form would lose someone's work. Guarded on
 * the editable statuses, so a submitted application can never be quietly rewritten.
 */
export async function saveApplicationDraft(input: {
  readonly userId: string;
  readonly draft: TutorApplicationInput;
  readonly now?: Date;
}): Promise<SaveDraftResult> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    const [row] = await db
      .update(tutorApplications)
      .set({ draft: { ...input.draft, declarationsAccepted: false }, updatedAt: now })
      .where(
        and(
          eq(tutorApplications.applicantUserId, input.userId),
          inArray(tutorApplications.statusCode, [...EDITABLE_APPLICATION_STATUSES]),
        ),
      )
      .returning({ id: tutorApplications.id });
    if (row !== undefined) return 'saved';

    const [exists] = await db
      .select({ id: tutorApplications.id })
      .from(tutorApplications)
      .where(
        and(
          eq(tutorApplications.applicantUserId, input.userId),
          inArray(tutorApplications.statusCode, LIVE_STATUSES),
        ),
      )
      .limit(1);
    return exists === undefined ? 'not_found' : 'not_editable';
  } finally {
    await client.end();
  }
}

export type SubmitResult =
  | { readonly status: 'submitted'; readonly revisionNumber: number }
  | { readonly status: 'not_editable' | 'not_found' };

/**
 * Submit: freeze what was written as an immutable revision.
 *
 * The caller validates first (`validateTutorApplication`); this writes the
 * revision, its subjects and referees, moves the application to `submitted` and
 * makes sure the four checks exist as `pending`. A resubmission after changes
 * were requested is simply the next revision number.
 */
export async function submitApplication(input: {
  readonly userId: string;
  readonly application: ValidatedTutorApplication;
  readonly correlationId: string;
  readonly now?: Date;
}): Promise<SubmitResult> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx): Promise<SubmitResult> => {
      const [locked] = await tx
        .select()
        .from(tutorApplications)
        .where(
          and(
            eq(tutorApplications.applicantUserId, input.userId),
            inArray(tutorApplications.statusCode, LIVE_STATUSES),
          ),
        )
        .limit(1)
        .for('update');
      if (locked === undefined) return { status: 'not_found' };
      const from = locked.statusCode as TutorApplicationStatus;
      if (!(EDITABLE_APPLICATION_STATUSES as readonly string[]).includes(from)) {
        return { status: 'not_editable' };
      }

      const revisionNumber = locked.currentRevisionNumber + 1;
      const value = input.application;

      const [revision] = await tx
        .insert(tutorApplicationRevisions)
        .values({
          applicationId: locked.id,
          revisionNumber,
          submittedAt: now,
          legalFirstName: value.legalFirstName,
          legalFamilyName: value.legalFamilyName,
          preferredFirstName: value.preferredFirstName,
          phone: value.phone,
          headline: value.headline,
          teachingApproach: value.teachingApproach,
          experienceSummary: value.experienceSummary,
          qualificationsSummary: value.qualificationsSummary,
          yearLevelFrom: value.yearLevelFrom,
          yearLevelTo: value.yearLevelTo,
          offersOnline: value.offersOnline,
          offersInPerson: value.offersInPerson,
          declarationsVersion: APPLICATION_DECLARATIONS_VERSION,
          declarationsAcceptedAt: now,
        })
        .returning({ id: tutorApplicationRevisions.id });
      if (revision === undefined) throw new Error('revision insert returned no row');

      await tx
        .insert(tutorApplicationRevisionSubjects)
        .values(value.subjectIds.map((subjectId) => ({ revisionId: revision.id, subjectId })));
      await tx.insert(tutorApplicationRevisionReferences).values(
        value.references.map((reference, index) => ({
          revisionId: revision.id,
          position: index + 1,
          fullName: reference.fullName,
          email: reference.email,
          relationship: reference.relationship,
        })),
      );

      const [moved] = await tx
        .update(tutorApplications)
        .set({
          statusCode: 'submitted',
          currentRevisionNumber: revisionNumber,
          submittedAt: now,
          draft: null,
          // A previous decision's message answered the previous revision.
          applicantMessage: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(tutorApplications.id, locked.id),
            inArray(tutorApplications.statusCode, [...EDITABLE_APPLICATION_STATUSES]),
          ),
        )
        .returning({ id: tutorApplications.id });
      if (moved === undefined) throw new Error('The application changed during submission.');

      await tx
        .insert(tutorApplicationChecks)
        .values(
          APPLICATION_CHECK_CODES.map((checkCode) => ({
            applicationId: locked.id,
            checkCode,
            statusCode: 'pending',
          })),
        )
        .onConflictDoNothing();

      await tx.insert(statusTransitions).values({
        entityType: 'tutor_application',
        entityId: locked.id,
        fromStatusCode: from,
        toStatusCode: 'submitted',
        actorUserId: input.userId,
        reasonCode: revisionNumber === 1 ? 'application_submitted' : 'application_resubmitted',
        correlationId: input.correlationId,
        occurredAt: now,
      });
      await tx.insert(domainEvents).values({
        eventType: 'tutor_application.submitted',
        entityType: 'tutor_application',
        entityId: locked.id,
        payload: { applicationId: locked.id, revisionNumber },
        correlationId: input.correlationId,
        occurredAt: now,
      });
      return { status: 'submitted', revisionNumber };
    });
  } finally {
    await client.end();
  }
}

export type WithdrawResult = 'withdrawn' | 'not_withdrawable' | 'not_found';

/**
 * The applicant's own exit. Ends their pending tutor role too, so "applying" does
 * not linger as an unexplained pending role on an account that has stopped.
 */
export async function withdrawApplication(input: {
  readonly userId: string;
  readonly correlationId: string;
  readonly now?: Date;
}): Promise<WithdrawResult> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx): Promise<WithdrawResult> => {
      const [locked] = await tx
        .select()
        .from(tutorApplications)
        .where(
          and(
            eq(tutorApplications.applicantUserId, input.userId),
            inArray(tutorApplications.statusCode, LIVE_STATUSES),
          ),
        )
        .limit(1)
        .for('update');
      if (locked === undefined) return 'not_found';
      const from = locked.statusCode as TutorApplicationStatus;
      if (from === 'approved') return 'not_withdrawable';

      const [moved] = await tx
        .update(tutorApplications)
        .set({ statusCode: 'withdrawn', withdrawnAt: now, draft: null, updatedAt: now })
        .where(
          and(
            eq(tutorApplications.id, locked.id),
            inArray(tutorApplications.statusCode, [
              'draft',
              'submitted',
              'under_review',
              'changes_requested',
            ]),
          ),
        )
        .returning({ id: tutorApplications.id });
      if (moved === undefined) return 'not_withdrawable';

      await endPendingTutorRole(
        tx,
        input.userId,
        'tutor_application_withdrawn',
        now,
        input.correlationId,
      );
      await tx.insert(statusTransitions).values({
        entityType: 'tutor_application',
        entityId: locked.id,
        fromStatusCode: from,
        toStatusCode: 'withdrawn',
        actorUserId: input.userId,
        reasonCode: 'application_withdrawn',
        correlationId: input.correlationId,
        occurredAt: now,
      });
      await tx.insert(domainEvents).values({
        eventType: 'tutor_application.withdrawn',
        entityType: 'tutor_application',
        entityId: locked.id,
        payload: { applicationId: locked.id },
        correlationId: input.correlationId,
        occurredAt: now,
      });
      return 'withdrawn';
    });
  } finally {
    await client.end();
  }
}

/** End the applicant's PENDING tutor role (never an active one), with its history. */
async function endPendingTutorRole(
  tx: Tx,
  userId: string,
  reasonCode: string,
  now: Date,
  correlationId: string,
): Promise<void> {
  const [role] = await tx
    .select({ id: roleDefinitions.id })
    .from(roleDefinitions)
    .where(eq(roleDefinitions.code, 'tutor'))
    .limit(1);
  if (role === undefined) return;
  const [ended] = await tx
    .update(userRoleAssignments)
    .set({ statusCode: 'ended', workspaceEnabled: false, effectiveUntil: now, updatedAt: now })
    .where(
      and(
        eq(userRoleAssignments.userId, userId),
        eq(userRoleAssignments.roleDefinitionId, role.id),
        eq(userRoleAssignments.statusCode, 'pending'),
      ),
    )
    .returning({ id: userRoleAssignments.id });
  if (ended === undefined) return;
  await tx.insert(statusTransitions).values({
    entityType: 'identity.user_role_assignments',
    entityId: ended.id,
    fromStatusCode: 'pending',
    toStatusCode: 'ended',
    actorUserId: null,
    reasonCode,
    correlationId,
    occurredAt: now,
  });
}

// ---------------------------------------------------------------------------
// The reviewer
// ---------------------------------------------------------------------------

export interface ReviewQueueEntry {
  readonly reference: string;
  readonly status: TutorApplicationStatus;
  readonly preferredFirstName: string;
  readonly headline: string;
  readonly revisionNumber: number;
  readonly submittedAt: Date | null;
  readonly verifiedChecks: number;
}

/**
 * Applications waiting on a person, or on the applicant after changes were
 * requested, oldest first. Names the applicant by the first name they chose to be
 * known by, not their legal name: the queue is a list, and a list is looked over.
 */
export async function reviewQueue(
  input: { readonly limit?: number } = {},
): Promise<readonly ReviewQueueEntry[]> {
  const { sql: client, db } = createDatabaseClient();
  try {
    const rows = await db
      .select({
        reference: tutorApplications.reference,
        statusCode: tutorApplications.statusCode,
        preferredFirstName: tutorApplicationRevisions.preferredFirstName,
        headline: tutorApplicationRevisions.headline,
        revisionNumber: tutorApplications.currentRevisionNumber,
        submittedAt: tutorApplications.submittedAt,
        verifiedChecks: raw<number>`(
          select count(*)::int from tutors.tutor_application_checks c
          where c.application_id = ${tutorApplications.id} and c.status_code = 'verified'
        )`,
      })
      .from(tutorApplications)
      .innerJoin(
        tutorApplicationRevisions,
        and(
          eq(tutorApplicationRevisions.applicationId, tutorApplications.id),
          eq(tutorApplicationRevisions.revisionNumber, tutorApplications.currentRevisionNumber),
        ),
      )
      .where(
        inArray(tutorApplications.statusCode, ['submitted', 'under_review', 'changes_requested']),
      )
      .orderBy(asc(tutorApplications.submittedAt), asc(tutorApplications.id))
      .limit(input.limit ?? 100);

    return rows.map((row) => ({
      reference: row.reference,
      status: row.statusCode as TutorApplicationStatus,
      preferredFirstName: row.preferredFirstName,
      headline: row.headline,
      revisionNumber: row.revisionNumber,
      submittedAt: row.submittedAt,
      verifiedChecks: row.verifiedChecks,
    }));
  } finally {
    await client.end();
  }
}

export interface ReviewDetail {
  readonly reference: string;
  readonly status: TutorApplicationStatus;
  readonly revisionNumber: number;
  readonly submittedAt: Date | null;
  readonly applicantMessage: string | null;
  readonly internalNote: string | null;
  readonly decidedAt: Date | null;
  readonly tutorProfileReference: string | null;
  /** The applicant's sign-in email, so a reviewer can reach them. Staff only. */
  readonly applicantEmail: string | null;
  readonly form: TutorApplicationInput;
  readonly subjectNames: readonly string[];
  readonly checks: readonly {
    readonly code: ApplicationCheckCode;
    readonly status: ApplicationCheckStatus;
    readonly note: string | null;
    readonly checkedAt: Date | null;
  }[];
  readonly requiredChecks: readonly ApplicationCheckCode[];
  readonly readiness: ApprovalReadiness;
}

/** The versioned rule for which checks approval demands, failing closed. */
async function loadRequiredChecks(reader: Db | Tx): Promise<readonly ApplicationCheckCode[]> {
  const [row] = await reader
    .select({ value: ruleSettings.value })
    .from(ruleSettings)
    .where(
      and(
        eq(ruleSettings.settingKey, TUTOR_APPLICATION_RULE_KEYS.requiredChecks),
        eq(ruleSettings.statusCode, 'current'),
      ),
    )
    .limit(1);
  return requiredChecksFrom(row?.value);
}

/** Everything a reviewer needs to decide, for one application. */
export async function applicationForReview(reference: string): Promise<ReviewDetail | null> {
  const { sql: client, db } = createDatabaseClient();
  try {
    const [application] = await db
      .select()
      .from(tutorApplications)
      .where(eq(tutorApplications.reference, reference))
      .limit(1);
    if (application === undefined || application.currentRevisionNumber < 1) return null;

    const form =
      (await revisionAsInput(db, application.id, application.currentRevisionNumber)) ??
      EMPTY_TUTOR_APPLICATION;

    const subjectNames = (
      await db
        .select({ name: subjects.displayName })
        .from(tutorApplicationRevisionSubjects)
        .innerJoin(subjects, eq(subjects.id, tutorApplicationRevisionSubjects.subjectId))
        .innerJoin(
          tutorApplicationRevisions,
          eq(tutorApplicationRevisions.id, tutorApplicationRevisionSubjects.revisionId),
        )
        .where(
          and(
            eq(tutorApplicationRevisions.applicationId, application.id),
            eq(tutorApplicationRevisions.revisionNumber, application.currentRevisionNumber),
          ),
        )
        .orderBy(asc(subjects.displayName))
    ).map((row) => row.name);

    const checkRows = await db
      .select()
      .from(tutorApplicationChecks)
      .where(eq(tutorApplicationChecks.applicationId, application.id));
    const checks = APPLICATION_CHECK_CODES.map((code) => {
      const row = checkRows.find((candidate) => candidate.checkCode === code);
      return {
        code,
        status: (row?.statusCode ?? 'pending') as ApplicationCheckStatus,
        note: row?.note ?? null,
        checkedAt: row?.checkedAt ?? null,
      };
    });

    const [identity] = await db
      .select({ email: authIdentityLinks.authenticationEmail })
      .from(authIdentityLinks)
      .where(eq(authIdentityLinks.userId, application.applicantUserId))
      .limit(1);

    let tutorProfileReference: string | null = null;
    if (application.tutorProfileId !== null) {
      const [profile] = await db
        .select({ reference: tutorProfiles.reference })
        .from(tutorProfiles)
        .where(eq(tutorProfiles.id, application.tutorProfileId))
        .limit(1);
      tutorProfileReference = profile?.reference ?? null;
    }

    const requiredChecks = await loadRequiredChecks(db);
    return {
      reference: application.reference,
      status: application.statusCode as TutorApplicationStatus,
      revisionNumber: application.currentRevisionNumber,
      submittedAt: application.submittedAt,
      applicantMessage: application.applicantMessage,
      internalNote: application.internalNote,
      decidedAt: application.decidedAt,
      tutorProfileReference,
      applicantEmail: identity?.email ?? null,
      form,
      subjectNames,
      checks,
      requiredChecks,
      readiness: approvalReadiness(
        checks.map((check) => ({ code: check.code, status: check.status })),
        requiredChecks,
      ),
    };
  } finally {
    await client.end();
  }
}

export type ReviewActionResult =
  { readonly status: 'done' } | { readonly status: 'not_found' | 'not_decidable' };

/** Lock an application for a decision, returning it only if it can still be decided. */
async function lockDecidable(tx: Tx, reference: string) {
  const [locked] = await tx
    .select()
    .from(tutorApplications)
    .where(eq(tutorApplications.reference, reference))
    .limit(1)
    .for('update');
  if (locked === undefined) return { kind: 'not_found' as const };
  if (!(DECIDABLE_APPLICATION_STATUSES as readonly string[]).includes(locked.statusCode)) {
    return { kind: 'not_decidable' as const };
  }
  return { kind: 'locked' as const, application: locked };
}

/**
 * Record what a reviewer found for one check. A reviewer working an application
 * moves it from `submitted` to `under_review` in the same step, so the queue shows
 * it is being looked at.
 *
 * Failing a check is HIGH risk in the audit trail: it is a finding against a
 * person. The reviewer's note is staff-only and never reaches the applicant.
 */
export async function recordApplicationCheck(input: {
  readonly reference: string;
  readonly checkCode: ApplicationCheckCode;
  readonly status: ApplicationCheckStatus;
  readonly note: string | null;
  readonly actorUserId: string;
  readonly correlationId: string;
  readonly now?: Date;
}): Promise<ReviewActionResult> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx): Promise<ReviewActionResult> => {
      const found = await lockDecidable(tx, input.reference);
      if (found.kind !== 'locked') return { status: found.kind };
      const application = found.application;

      const attributed =
        input.status === 'pending'
          ? { checkedByUserId: null, checkedAt: null }
          : { checkedByUserId: input.actorUserId, checkedAt: now };
      await tx
        .insert(tutorApplicationChecks)
        .values({
          applicationId: application.id,
          checkCode: input.checkCode,
          statusCode: input.status,
          note: input.note,
          ...attributed,
        })
        .onConflictDoUpdate({
          target: [tutorApplicationChecks.applicationId, tutorApplicationChecks.checkCode],
          set: { statusCode: input.status, note: input.note, ...attributed, updatedAt: now },
        });

      if (application.statusCode === 'submitted') {
        await tx
          .update(tutorApplications)
          .set({ statusCode: 'under_review', updatedAt: now })
          .where(
            and(
              eq(tutorApplications.id, application.id),
              eq(tutorApplications.statusCode, 'submitted'),
            ),
          );
        await tx.insert(statusTransitions).values({
          entityType: 'tutor_application',
          entityId: application.id,
          fromStatusCode: 'submitted',
          toStatusCode: 'under_review',
          actorUserId: input.actorUserId,
          reasonCode: 'review_started',
          correlationId: input.correlationId,
          occurredAt: now,
        });
      }

      await tx.insert(auditEvents).values({
        category: 'sensitive_access',
        action: 'tutor_application.check_recorded',
        entityType: 'tutor_application',
        entityId: application.id,
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        occurredAt: now,
        // The outcome, never the note: the note is the reviewer's own words about a person.
        newValue: { checkCode: input.checkCode, status: input.status },
        riskLevel:
          input.status === 'failed' ? 'high' : input.status === 'verified' ? 'medium' : 'low',
      });
      return { status: 'done' };
    });
  } finally {
    await client.end();
  }
}

/** Common tail of a negative decision: guarded status move, history, audit, event. */
async function applyDecision(
  tx: Tx,
  application: typeof tutorApplications.$inferSelect,
  to: 'changes_requested' | 'rejected',
  input: {
    readonly message: string;
    readonly internalNote: string | null;
    readonly actorUserId: string;
    readonly correlationId: string;
    readonly now: Date;
  },
): Promise<boolean> {
  const from = application.statusCode as TutorApplicationStatus;
  const [moved] = await tx
    .update(tutorApplications)
    .set({
      statusCode: to,
      applicantMessage: input.message,
      internalNote: input.internalNote ?? application.internalNote,
      decidedAt: input.now,
      decidedByUserId: input.actorUserId,
      // The applicant edits from the last submitted revision.
      draft: null,
      updatedAt: input.now,
    })
    .where(
      and(
        eq(tutorApplications.id, application.id),
        inArray(tutorApplications.statusCode, [...DECIDABLE_APPLICATION_STATUSES]),
      ),
    )
    .returning({ id: tutorApplications.id });
  if (moved === undefined) return false;

  await tx.insert(statusTransitions).values({
    entityType: 'tutor_application',
    entityId: application.id,
    fromStatusCode: from,
    toStatusCode: to,
    actorUserId: input.actorUserId,
    reasonCode: to === 'rejected' ? 'application_rejected' : 'changes_requested',
    correlationId: input.correlationId,
    occurredAt: input.now,
  });
  await tx.insert(auditEvents).values({
    category: 'sensitive_access',
    action: `tutor_application.${to}`,
    entityType: 'tutor_application',
    entityId: application.id,
    actorUserId: input.actorUserId,
    correlationId: input.correlationId,
    occurredAt: input.now,
    newValue: { revisionNumber: application.currentRevisionNumber },
    riskLevel: 'high',
  });
  await tx.insert(domainEvents).values({
    eventType: `tutor_application.${to}`,
    entityType: 'tutor_application',
    entityId: application.id,
    payload: { applicationId: application.id, revisionNumber: application.currentRevisionNumber },
    correlationId: input.correlationId,
    occurredAt: input.now,
  });
  return true;
}

/** Ask the applicant to change something. They edit and resubmit as a new revision. */
export async function requestApplicationChanges(input: {
  readonly reference: string;
  /** Shown to the APPLICANT, so it is required and written for them. */
  readonly message: string;
  readonly internalNote?: string | null;
  readonly actorUserId: string;
  readonly correlationId: string;
  readonly now?: Date;
}): Promise<ReviewActionResult> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx): Promise<ReviewActionResult> => {
      const found = await lockDecidable(tx, input.reference);
      if (found.kind !== 'locked') return { status: found.kind };
      const moved = await applyDecision(tx, found.application, 'changes_requested', {
        message: input.message,
        internalNote: input.internalNote ?? null,
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        now,
      });
      return moved ? { status: 'done' } : { status: 'not_decidable' };
    });
  } finally {
    await client.end();
  }
}

/** Decline the application. Ends the applicant's pending tutor role. */
export async function rejectApplication(input: {
  readonly reference: string;
  readonly message: string;
  readonly internalNote?: string | null;
  readonly actorUserId: string;
  readonly correlationId: string;
  readonly now?: Date;
}): Promise<ReviewActionResult> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx): Promise<ReviewActionResult> => {
      const found = await lockDecidable(tx, input.reference);
      if (found.kind !== 'locked') return { status: found.kind };
      const moved = await applyDecision(tx, found.application, 'rejected', {
        message: input.message,
        internalNote: input.internalNote ?? null,
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        now,
      });
      if (!moved) return { status: 'not_decidable' };
      await endPendingTutorRole(
        tx,
        found.application.applicantUserId,
        'tutor_application_rejected',
        now,
        input.correlationId,
      );
      return { status: 'done' };
    });
  } finally {
    await client.end();
  }
}

export type ApproveResult =
  | {
      readonly status: 'approved';
      readonly tutorProfileId: string;
      readonly tutorReference: string;
    }
  | { readonly status: 'not_found' | 'not_decidable' | 'profile_exists' }
  | {
      readonly status: 'checks_incomplete';
      readonly missing: readonly ApplicationCheckCode[];
      readonly failed: readonly ApplicationCheckCode[];
    };

/**
 * APPROVE — the one controlled transaction that makes someone a tutor.
 *
 * Under a lock on the application it: confirms it can still be decided, confirms
 * every REQUIRED check is verified (read here, under the lock, not trusted from
 * the screen that sent the click), creates the tutor profile from the exact
 * revision being approved, activates the applicant's tutor role and workspace,
 * writes the public labels the verified checks earned, and records the transition,
 * the audit event and the domain event. All of it or none of it: there is no state
 * in which someone has a role but no profile, or a profile but no review behind it.
 *
 * The profile is created `approved` and visible by status, but is NOT listed in
 * discovery until the tutor has a published service, which has its own review.
 * Approval makes a person a tutor; it does not put anything on sale.
 */
export async function approveApplication(input: {
  readonly reference: string;
  readonly actorUserId: string;
  readonly correlationId: string;
  readonly internalNote?: string | null;
  readonly now?: Date;
}): Promise<ApproveResult> {
  const { sql: client, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx): Promise<ApproveResult> => {
      const found = await lockDecidable(tx, input.reference);
      if (found.kind !== 'locked') return { status: found.kind };
      const application = found.application;
      const from = application.statusCode as TutorApplicationStatus;

      // THE GATE, read under the lock.
      const required = await loadRequiredChecks(tx);
      const checkRows = await tx
        .select({
          code: tutorApplicationChecks.checkCode,
          status: tutorApplicationChecks.statusCode,
        })
        .from(tutorApplicationChecks)
        .where(eq(tutorApplicationChecks.applicationId, application.id));
      const readiness = approvalReadiness(checkRows, required);
      if (!readiness.ready) {
        return {
          status: 'checks_incomplete',
          missing: readiness.missing,
          failed: readiness.failed,
        };
      }

      const [existingProfile] = await tx
        .select({ id: tutorProfiles.id })
        .from(tutorProfiles)
        .where(eq(tutorProfiles.userId, application.applicantUserId))
        .limit(1);
      if (existingProfile !== undefined) return { status: 'profile_exists' };

      const [revision] = await tx
        .select()
        .from(tutorApplicationRevisions)
        .where(
          and(
            eq(tutorApplicationRevisions.applicationId, application.id),
            eq(tutorApplicationRevisions.revisionNumber, application.currentRevisionNumber),
          ),
        )
        .limit(1);
      if (revision === undefined) throw new Error('The application has no current revision.');

      const [profile] = await tx
        .insert(tutorProfiles)
        .values({
          userId: application.applicantUserId,
          publicFirstName: revision.preferredFirstName,
          headline: revision.headline,
          teachingApproach: revision.teachingApproach,
          statusCode: 'approved',
          visibilityStateCode: 'public_recommended',
          sourceTypeCode: 'tutor_application',
          yearLevelFrom: revision.yearLevelFrom,
          yearLevelTo: revision.yearLevelTo,
          offersOnline: revision.offersOnline,
          offersInPerson: revision.offersInPerson,
          availabilityLabelCode: 'accepting_new',
          isNewToStuddy: true,
        })
        .returning({ id: tutorProfiles.id, reference: tutorProfiles.reference });
      if (profile === undefined) throw new Error('tutor profile insert returned no row');

      // Public labels, only for the checks that were required and verified.
      for (const code of required) {
        const label = publicLabelForCheck(code);
        if (label === null) continue;
        await tx
          .insert(tutorVerifications)
          .values({
            tutorProfileId: profile.id,
            labelCode: label,
            verifiedAt: now,
            statusCode: 'active',
          })
          .onConflictDoNothing();
      }

      // The role and workspace. A pending role becomes active; with none, one is made.
      const [role] = await tx
        .select({ id: roleDefinitions.id })
        .from(roleDefinitions)
        .where(eq(roleDefinitions.code, 'tutor'))
        .limit(1);
      if (role === undefined) throw new Error('The tutor role definition is missing.');
      const [activated] = await tx
        .update(userRoleAssignments)
        .set({
          statusCode: 'active',
          workspaceEnabled: true,
          assignmentReasonCode: 'tutor_application_approved',
          assignedByUserId: input.actorUserId,
          updatedAt: now,
        })
        .where(
          and(
            eq(userRoleAssignments.userId, application.applicantUserId),
            eq(userRoleAssignments.roleDefinitionId, role.id),
            eq(userRoleAssignments.statusCode, 'pending'),
          ),
        )
        .returning({ id: userRoleAssignments.id });
      let assignmentId = activated?.id;
      if (assignmentId === undefined) {
        const [created] = await tx
          .insert(userRoleAssignments)
          .values({
            userId: application.applicantUserId,
            roleDefinitionId: role.id,
            statusCode: 'active',
            workspaceEnabled: true,
            assignmentReasonCode: 'tutor_application_approved',
            assignedByUserId: input.actorUserId,
          })
          .returning({ id: userRoleAssignments.id });
        assignmentId = created?.id;
      }
      if (assignmentId !== undefined) {
        await tx.insert(statusTransitions).values({
          entityType: 'identity.user_role_assignments',
          entityId: assignmentId,
          fromStatusCode: activated === undefined ? null : 'pending',
          toStatusCode: 'active',
          actorUserId: input.actorUserId,
          reasonCode: 'tutor_application_approved',
          correlationId: input.correlationId,
          occurredAt: now,
        });
      }

      const [moved] = await tx
        .update(tutorApplications)
        .set({
          statusCode: 'approved',
          decidedAt: now,
          decidedByUserId: input.actorUserId,
          approvedRevisionNumber: application.currentRevisionNumber,
          tutorProfileId: profile.id,
          internalNote: input.internalNote ?? application.internalNote,
          applicantMessage: null,
          draft: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(tutorApplications.id, application.id),
            inArray(tutorApplications.statusCode, [...DECIDABLE_APPLICATION_STATUSES]),
          ),
        )
        .returning({ id: tutorApplications.id });
      if (moved === undefined) throw new Error('The application stopped being decidable.');

      await tx.insert(statusTransitions).values({
        entityType: 'tutor_application',
        entityId: application.id,
        fromStatusCode: from,
        toStatusCode: 'approved',
        actorUserId: input.actorUserId,
        reasonCode: 'application_approved',
        correlationId: input.correlationId,
        occurredAt: now,
      });
      await tx.insert(auditEvents).values({
        category: 'sensitive_access',
        action: 'tutor_application.approved',
        entityType: 'tutor_application',
        entityId: application.id,
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        occurredAt: now,
        newValue: {
          revisionNumber: application.currentRevisionNumber,
          tutorProfileId: profile.id,
          requiredChecks: [...required],
        },
        riskLevel: 'high',
      });
      await tx.insert(domainEvents).values({
        eventType: 'tutor.approved',
        entityType: 'tutor_application',
        entityId: application.id,
        payload: {
          applicationId: application.id,
          tutorProfileId: profile.id,
          revisionNumber: application.currentRevisionNumber,
        },
        correlationId: input.correlationId,
        occurredAt: now,
      });

      return { status: 'approved', tutorProfileId: profile.id, tutorReference: profile.reference };
    });
  } finally {
    await client.end();
  }
}
