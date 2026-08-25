/**
 * Synthetic local-only accounts (brief §12). Deterministic, no real inbox,
 * never real personal data. Passwords are synthetic and documented in
 * documentation/implementation/development-test-accounts.md.
 */
export interface SyntheticUser {
  readonly email: string;
  readonly displayName: string;
  readonly roleCodes: readonly string[];
  /** Assignment status per role code; defaults to active. */
  readonly roleStatus?: Readonly<Record<string, 'active' | 'pending' | 'suspended'>>;
  /** Deterministic auth UUID used when Supabase Auth is not seeding (CI plain Postgres). */
  readonly deterministicAuthId: string;
}

export const LOCAL_SYNTHETIC_PASSWORD = 'Studdy-local-only-1';

export const SYNTHETIC_USERS: readonly SyntheticUser[] = [
  {
    email: 'owner@local.studdy.test',
    displayName: 'Synthetic Owner',
    roleCodes: ['platform_owner'],
    deterministicAuthId: '00000000-0000-4000-9000-000000000001',
  },
  {
    email: 'manager@local.studdy.test',
    displayName: 'Synthetic Manager',
    roleCodes: ['platform_manager'],
    deterministicAuthId: '00000000-0000-4000-9000-000000000002',
  },
  {
    email: 'parent.one@local.studdy.test',
    displayName: 'Synthetic Parent One',
    roleCodes: ['parent_guardian'],
    deterministicAuthId: '00000000-0000-4000-9000-000000000003',
  },
  {
    email: 'parent.two@local.studdy.test',
    displayName: 'Synthetic Parent Two',
    roleCodes: ['parent_guardian'],
    deterministicAuthId: '00000000-0000-4000-9000-000000000004',
  },
  {
    email: 'student.independent@local.studdy.test',
    displayName: 'Synthetic Independent Student',
    roleCodes: ['independent_student'],
    deterministicAuthId: '00000000-0000-4000-9000-000000000005',
  },
  {
    email: 'student.dependent@local.studdy.test',
    displayName: 'Synthetic Dependent Student',
    roleCodes: ['dependent_student'],
    deterministicAuthId: '00000000-0000-4000-9000-000000000006',
  },
  // Dedicated to the lesson-request journeys. Playwright runs spec FILES in
  // parallel, so a journey spec that mutates a shared account races other
  // specs; these accounts belong to one spec only.
  {
    email: 'parent.requests@local.studdy.test',
    displayName: 'Synthetic Request Parent',
    roleCodes: ['parent_guardian'],
    deterministicAuthId: '00000000-0000-4000-9000-000000000011',
  },
  {
    email: 'student.requests@local.studdy.test',
    displayName: 'Synthetic Request Student',
    roleCodes: ['independent_student'],
    deterministicAuthId: '00000000-0000-4000-9000-000000000012',
  },
  /**
   * Dedicated to the booking journey, for the same reason and one step further.
   *
   * That spec walks the whole wizard and SENDS real requests, so it mutates a
   * family and takes real calendar holds. Run on `parent.one@` it raced
   * `discovery-presentation` and `family-students-discovery`, which sign that
   * account in and out — the session dropped mid-journey and the failure looked
   * like a broken wizard.
   */
  {
    email: 'parent.booking@local.studdy.test',
    displayName: 'Synthetic Booking Parent',
    roleCodes: ['parent_guardian'],
    deterministicAuthId: '00000000-0000-4000-9000-000000000014',
  },
  {
    email: 'tutor.a@local.studdy.test',
    displayName: 'Synthetic Tutor A',
    roleCodes: ['tutor'],
    deterministicAuthId: '00000000-0000-4000-9000-000000000007',
  },
  {
    email: 'tutor.b@local.studdy.test',
    displayName: 'Synthetic Tutor B',
    roleCodes: ['tutor'],
    deterministicAuthId: '00000000-0000-4000-9000-000000000008',
  },
  {
    email: 'tutor.c@local.studdy.test',
    displayName: 'Synthetic Tutor C',
    roleCodes: ['tutor'],
    deterministicAuthId: '00000000-0000-4000-9000-000000000009',
  },
  {
    email: 'restricted.tutor@local.studdy.test',
    displayName: 'Synthetic Restricted Tutor',
    roleCodes: ['tutor'],
    roleStatus: { tutor: 'suspended' },
    deterministicAuthId: '00000000-0000-4000-9000-000000000010',
  },
  {
    // Multi-role account exercising the workspace chooser (documented
    // extension of the brief §12 list).
    email: 'parent.tutor@local.studdy.test',
    displayName: 'Synthetic Parent-Tutor',
    roleCodes: ['parent_guardian', 'tutor'],
    // Was …011, colliding with parent.requests@. See
    // assertUniqueSyntheticUsers below for why that mattered.
    deterministicAuthId: '00000000-0000-4000-9000-000000000013',
  },
] as const;

/**
 * Two synthetic users once shared a `deterministicAuthId`
 * (`parent.requests@` and `parent.tutor@`, both `…011`).
 *
 * It never bit locally, which is exactly why it survived: when
 * `SUPABASE_SERVICE_ROLE_KEY` is present Supabase Auth assigns real ids and
 * this value goes unused. It is the fallback for the plain-Postgres path, where
 * a collision would silently merge two accounts holding different roles — a
 * multi-role account appearing where a single-role one was seeded, and
 * workspace resolution behaving unlike every developer's machine.
 *
 * Called at module load so seeding fails loudly rather than producing quietly
 * wrong data, and asserted again by unit test.
 */
export function assertUniqueSyntheticUsers(
  users: readonly SyntheticUser[] = SYNTHETIC_USERS,
): void {
  const firstDuplicate = (field: 'email' | 'deterministicAuthId'): string | undefined => {
    const seen = new Set<string>();
    for (const user of users) {
      if (seen.has(user[field])) return user[field];
      seen.add(user[field]);
    }
    return undefined;
  };

  const duplicateId = firstDuplicate('deterministicAuthId');
  if (duplicateId !== undefined) {
    throw new Error(
      `Duplicate deterministicAuthId in SYNTHETIC_USERS: ${duplicateId}. Every synthetic ` +
        'user needs its own fallback id, or the plain-Postgres seed path merges two ' +
        'accounts into one.',
    );
  }

  const duplicateEmail = firstDuplicate('email');
  if (duplicateEmail !== undefined) {
    throw new Error(`Duplicate email in SYNTHETIC_USERS: ${duplicateEmail}.`);
  }
}

assertUniqueSyntheticUsers();
