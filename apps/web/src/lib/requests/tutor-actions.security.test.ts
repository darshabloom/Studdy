import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedIdentity } from '@/lib/identity/resolve';

const resolveIdentity = vi.fn();
const tutorProfileForUser = vi.fn();
const acceptTutorRequestTime = vi.fn();
const declineTutorRequest = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});

vi.mock('../identity/resolve', () => ({
  resolveIdentity: (...args: unknown[]) => resolveIdentity(...args),
}));
vi.mock('@studdy/database', () => ({
  tutorProfileForUser: (...args: unknown[]) => tutorProfileForUser(...args),
  acceptTutorRequestTime: (...args: unknown[]) => acceptTutorRequestTime(...args),
  declineTutorRequest: (...args: unknown[]) => declineTutorRequest(...args),
  RequestNotOpenError: class extends Error {},
  TimeNoLongerAvailableError: class extends Error {},
}));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirect(path),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { acceptTimeAction, declineRequestAction } = await import('./tutor-actions');

function identity(workspaces: ResolvedIdentity['workspaces']): ResolvedIdentity {
  return {
    authUserId: 'auth-test',
    email: 'fictional@example.test',
    studdyUserId: 'studdy-test',
    displayName: 'Test User',
    roleAssignments: [],
    pendingRoleCodes: [],
    workspaces,
    lastActiveWorkspaceCode: null,
    needsSetup: false,
    databaseAvailable: true,
  };
}

describe('SC-117 direct Tutor request action role checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const workspace of ['parent', 'independent_student'] as const) {
    it(`denies ${workspace} accept and decline before reading tutor records`, async () => {
      resolveIdentity.mockResolvedValue(identity([workspace]));
      const form = new FormData();
      form.set('reference', 'REQ-TEST');
      form.set('tutorRequestTimeOptionId', 'option-test');

      const accepted = await acceptTimeAction({ error: null }, form);
      const declined = await declineRequestAction({ error: null }, form);
      expect(accepted.error).toMatch(/tutor workspace/i);
      expect(declined.error).toMatch(/tutor workspace/i);
      expect(tutorProfileForUser).not.toHaveBeenCalled();
      expect(acceptTutorRequestTime).not.toHaveBeenCalled();
      expect(declineTutorRequest).not.toHaveBeenCalled();
    });
  }

  it('allows an active Tutor role through to its own profile lookup', async () => {
    resolveIdentity.mockResolvedValue(identity(['tutor']));
    tutorProfileForUser.mockResolvedValue(null);
    const form = new FormData();
    form.set('reference', 'REQ-TEST');
    const result = await declineRequestAction({ error: null }, form);
    expect(result.error).toMatch(/profile is not active/i);
    expect(tutorProfileForUser).toHaveBeenCalledWith('studdy-test');
    expect(declineTutorRequest).not.toHaveBeenCalled();
  });
});
