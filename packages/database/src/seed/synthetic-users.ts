/**
 * Synthetic local-only accounts (brief §12). Deterministic, no real inbox,
 * never real personal data. Passwords are synthetic and documented in
 * documentation/implementation/development-test-accounts.md.
 */
export interface SyntheticUser {
  readonly email: string;
  readonly displayName: string;
  readonly roleCodes: readonly string[];
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
    deterministicAuthId: '00000000-0000-4000-9000-000000000010',
  },
] as const;
