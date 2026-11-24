import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedIdentity } from '@/lib/identity/resolve';

const resolveIdentity = vi.fn();
const ensureFamilyAccountForGuardian = vi.fn();
const createDependentStudent = vi.fn();
const listAccessibleStudents = vi.fn();
const updateDependentStudent = vi.fn();
const redirect = vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); });

vi.mock('@/lib/identity/resolve', () => ({
  resolveIdentity: (...args: unknown[]) => resolveIdentity(...args),
}));
vi.mock('@studdy/database', () => ({
  ensureFamilyAccountForGuardian: (...args: unknown[]) => ensureFamilyAccountForGuardian(...args),
  createDependentStudent: (...args: unknown[]) => createDependentStudent(...args),
  listAccessibleStudents: (...args: unknown[]) => listAccessibleStudents(...args),
  updateDependentStudent: (...args: unknown[]) => updateDependentStudent(...args),
  addToShortlist: vi.fn(), createSubjectSection: vi.fn(),
  ensureIndependentStudentProfile: vi.fn(), removeFromShortlist: vi.fn(),
  subjectSectionBelongsToUser: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirect(path),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { addStudentAction } = await import('../discovery/actions');
const { updateStudentAction } = await import('./actions');

const state = { error: null, message: null };
function identity(workspaces: ResolvedIdentity['workspaces']): ResolvedIdentity {
  return {
    authUserId: 'auth-test', email: 'fictional@example.test',
    studdyUserId: 'studdy-test', displayName: 'Test User',
    roleAssignments: [], pendingRoleCodes: [], workspaces,
    lastActiveWorkspaceCode: null, needsSetup: false, databaseAvailable: true,
  };
}
function form(): FormData {
  const data = new FormData();
  data.set('preferredName', 'Charlie');
  data.set('familyName', 'Test');
  data.set('schoolYearCode', 'year_8');
  data.set('schoolOrProviderName', '');
  return data;
}

describe('SC-117 direct server action authorisation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureFamilyAccountForGuardian.mockResolvedValue('family-1');
    createDependentStudent.mockResolvedValue('student-1');
    listAccessibleStudents.mockResolvedValue({
      familyAccountId: 'family-1',
      students: [{ studentProfileId: 'student-1', reference: 'STU-1' }],
    });
    updateDependentStudent.mockResolvedValue(true);
  });

  for (const workspace of ['tutor', 'independent_student'] as const) {
    it(`denies ${workspace} from adding a dependent student before database access`, async () => {
      resolveIdentity.mockResolvedValue(identity([workspace]));
      const result = await addStudentAction(state, form());
      expect(result.error).toMatch(/parent|guardian/i);
      expect(ensureFamilyAccountForGuardian).not.toHaveBeenCalled();
      expect(createDependentStudent).not.toHaveBeenCalled();
    });

    it(`denies ${workspace} from updating a dependent student before database access`, async () => {
      resolveIdentity.mockResolvedValue(identity([workspace]));
      const result = await updateStudentAction('STU-1', state, form());
      expect(result.error).toMatch(/parent|guardian/i);
      expect(listAccessibleStudents).not.toHaveBeenCalled();
      expect(updateDependentStudent).not.toHaveBeenCalled();
    });
  }

  it('permits parent dependent creation using the authenticated actor', async () => {
    resolveIdentity.mockResolvedValue(identity(['parent']));
    await expect(addStudentAction(state, form())).rejects.toThrow('REDIRECT:/parent');
    expect(ensureFamilyAccountForGuardian).toHaveBeenCalledWith(
      expect.objectContaining({ studdyUserId: 'studdy-test' }),
    );
    expect(createDependentStudent).toHaveBeenCalledWith(
      expect.objectContaining({ familyAccountId: 'family-1', actorUserId: 'studdy-test' }),
    );
  });

  it('permits parent update scoped to its own student', async () => {
    resolveIdentity.mockResolvedValue(identity(['parent']));
    const result = await updateStudentAction('STU-1', state, form());
    expect(result.savedHref).toBe('/parent/students/STU-1');
    expect(updateDependentStudent).toHaveBeenCalledWith(
      expect.objectContaining({ studentProfileId: 'student-1', familyAccountId: 'family-1', actorUserId: 'studdy-test' }),
    );
  });

  it('denies a parent an unknown or other-family reference before update', async () => {
    resolveIdentity.mockResolvedValue(identity(['parent']));
    const result = await updateStudentAction('STU-OTHER', state, form());
    expect(result.error).toMatch(/access/i);
    expect(updateDependentStudent).not.toHaveBeenCalled();
  });

  it('denies unauthenticated add and update before repository access', async () => {
    resolveIdentity.mockResolvedValue(null);
    await expect(addStudentAction(state, form())).rejects.toThrow('REDIRECT:/sign-in');
    await expect(updateStudentAction('STU-1', state, form())).rejects.toThrow('REDIRECT:/sign-in');
    expect(createDependentStudent).not.toHaveBeenCalled();
    expect(updateDependentStudent).not.toHaveBeenCalled();
  });
});
