import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedIdentity } from '@/lib/identity/resolve';

/**
 * Regression coverage for the dependent-student role/conversion bug (Week 1
 * item 2): setUpOwnProfileAction must never create an independent student
 * profile for an account that only holds the dependent_student workspace —
 * that would silently bypass the 18+ declaration captured at /welcome.
 */

const resolveIdentity = vi.fn();
const ensureIndependentStudentProfile = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock('@/lib/identity/resolve', () => ({
  resolveIdentity: (...args: unknown[]) => resolveIdentity(...args),
}));

vi.mock('@studdy/database', () => ({
  addToShortlist: vi.fn(),
  createDependentStudent: vi.fn(),
  createSubjectSection: vi.fn(),
  ensureFamilyAccountForGuardian: vi.fn(),
  ensureIndependentStudentProfile: (...args: unknown[]) => ensureIndependentStudentProfile(...args),
  removeFromShortlist: vi.fn(),
  subjectSectionBelongsToUser: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => redirect(url),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const { setUpOwnProfileAction } = await import('./actions');

function identity(overrides: Partial<ResolvedIdentity> = {}): ResolvedIdentity {
  return {
    authUserId: 'user-1',
    email: 'student@example.test',
    studdyUserId: 'studdy-1',
    displayName: 'Test Student',
    roleAssignments: [],
    pendingRoleCodes: [],
    workspaces: [],
    lastActiveWorkspaceCode: null,
    needsSetup: false,
    databaseAvailable: true,
    ...overrides,
  };
}

function validFormData(): FormData {
  const data = new FormData();
  data.set('preferredName', 'Ari');
  data.set('familyName', 'Ngata');
  data.set('schoolYearCode', 'year_9');
  data.set('schoolOrProviderName', '');
  return data;
}

describe('setUpOwnProfileAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirect.mockImplementation((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    });
  });

  it('blocks a dependent-student-only account and never writes a profile', async () => {
    resolveIdentity.mockResolvedValue(identity({ workspaces: ['dependent_student'] }));

    const result = await setUpOwnProfileAction({ error: null, message: null }, validFormData());

    expect(result.error).not.toBeNull();
    expect(ensureIndependentStudentProfile).not.toHaveBeenCalled();
  });

  it('proceeds for an independent-student account', async () => {
    resolveIdentity.mockResolvedValue(identity({ workspaces: ['independent_student'] }));
    ensureIndependentStudentProfile.mockResolvedValue('profile-1');

    await expect(
      setUpOwnProfileAction({ error: null, message: null }, validFormData()),
    ).rejects.toThrow('REDIRECT:/student');

    expect(ensureIndependentStudentProfile).toHaveBeenCalledWith(
      expect.objectContaining({ studdyUserId: 'studdy-1', preferredName: 'Ari' }),
    );
  });

  it('proceeds when the account holds both roles, because independent access is present', async () => {
    resolveIdentity.mockResolvedValue(
      identity({ workspaces: ['dependent_student', 'independent_student'] }),
    );
    ensureIndependentStudentProfile.mockResolvedValue('profile-1');

    await expect(
      setUpOwnProfileAction({ error: null, message: null }, validFormData()),
    ).rejects.toThrow('REDIRECT:/student');

    expect(ensureIndependentStudentProfile).toHaveBeenCalledTimes(1);
  });
});
