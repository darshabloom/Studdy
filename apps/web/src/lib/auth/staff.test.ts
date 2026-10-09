import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedIdentity } from '@/lib/identity/resolve';

/**
 * Who counts as staff, and that every way of not being one is a refusal.
 *
 * Mocks stand in for the database-backed identity and the auth service. What is
 * proved is the DECISION: both the role and the MFA level are required, each is
 * read fresh, and anything uncertain — no session, no database, no auth service,
 * no assurance answer — fails closed rather than open.
 */

const resolveIdentity = vi.fn();
const createSupabaseServerClient = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock('@/lib/identity/resolve', () => ({
  resolveIdentity: (...args: unknown[]) => resolveIdentity(...args),
}));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: (...args: unknown[]) => createSupabaseServerClient(...args),
}));
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }));

const { requireStaff } = await import('./staff');

function identity(overrides: Partial<ResolvedIdentity> = {}): ResolvedIdentity {
  return {
    authUserId: 'auth-1',
    email: 'manager@example.test',
    studdyUserId: 'user-1',
    displayName: 'Manager',
    roleAssignments: [],
    pendingRoleCodes: [],
    workspaces: ['platform_manager'],
    lastActiveWorkspaceCode: null,
    needsSetup: false,
    databaseAvailable: true,
    ...overrides,
  };
}

function supabaseAt(currentLevel: 'aal1' | 'aal2', nextLevel: 'aal1' | 'aal2' = 'aal2') {
  return {
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: vi
          .fn()
          .mockResolvedValue({ data: { currentLevel, nextLevel }, error: null }),
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  redirect.mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  });
});

describe('requireStaff', () => {
  it('admits a manager with an MFA session, and says who they are', async () => {
    resolveIdentity.mockResolvedValue(identity());
    createSupabaseServerClient.mockResolvedValue(supabaseAt('aal2'));

    expect(await requireStaff('/manager/x')).toEqual({ studdyUserId: 'user-1' });
  });

  it('admits a platform owner too', async () => {
    resolveIdentity.mockResolvedValue(identity({ workspaces: ['platform_owner'] }));
    createSupabaseServerClient.mockResolvedValue(supabaseAt('aal2'));
    expect(await requireStaff('/manager/x')).toEqual({ studdyUserId: 'user-1' });
  });

  it('sends a signed-out visitor to sign in, remembering where they were going', async () => {
    resolveIdentity.mockResolvedValue(null);
    await expect(requireStaff('/manager/tutor-applications')).rejects.toThrow(
      'REDIRECT:/sign-in?next=%2Fmanager%2Ftutor-applications',
    );
  });

  /** THE POINT: a parent, a tutor or a student can call the action directly. */
  it.each([['parent'], ['tutor'], ['independent_student'], ['dependent_student']])(
    'refuses a signed-in %s, even one with MFA',
    async (workspace) => {
      resolveIdentity.mockResolvedValue(identity({ workspaces: [workspace as never] }));
      createSupabaseServerClient.mockResolvedValue(supabaseAt('aal2'));
      await expect(requireStaff('/manager/x')).rejects.toThrow('REDIRECT:/workspace');
    },
  );

  it('refuses someone with no workspaces at all', async () => {
    resolveIdentity.mockResolvedValue(identity({ workspaces: [] }));
    createSupabaseServerClient.mockResolvedValue(supabaseAt('aal2'));
    await expect(requireStaff('/manager/x')).rejects.toThrow('REDIRECT:/workspace');
  });

  it('refuses a manager who has not completed MFA, and sends them to the challenge', async () => {
    resolveIdentity.mockResolvedValue(identity());
    createSupabaseServerClient.mockResolvedValue(supabaseAt('aal1', 'aal2'));
    await expect(requireStaff('/manager/x')).rejects.toThrow('REDIRECT:/mfa');
  });

  it('sends a manager with no MFA factor to enrol one', async () => {
    resolveIdentity.mockResolvedValue(identity());
    createSupabaseServerClient.mockResolvedValue(supabaseAt('aal1', 'aal1'));
    await expect(requireStaff('/manager/x')).rejects.toThrow('REDIRECT:/mfa/enroll');
  });

  /** A blip must never read as yes. */
  it('fails closed when the database cannot be read', async () => {
    resolveIdentity.mockResolvedValue(identity({ databaseAvailable: false, workspaces: [] }));
    createSupabaseServerClient.mockResolvedValue(supabaseAt('aal2'));
    await expect(requireStaff('/manager/x')).rejects.toThrow('REDIRECT:/workspace');
  });

  it('fails closed when the identity has no Studdy user', async () => {
    resolveIdentity.mockResolvedValue(identity({ studdyUserId: null }));
    createSupabaseServerClient.mockResolvedValue(supabaseAt('aal2'));
    await expect(requireStaff('/manager/x')).rejects.toThrow('REDIRECT:/workspace');
  });

  it('fails closed when the auth service is not configured', async () => {
    resolveIdentity.mockResolvedValue(identity());
    createSupabaseServerClient.mockResolvedValue(null);
    await expect(requireStaff('/manager/x')).rejects.toThrow('REDIRECT:/sign-in');
  });

  it('fails closed when the auth service gives no assurance answer', async () => {
    resolveIdentity.mockResolvedValue(identity());
    createSupabaseServerClient.mockResolvedValue({
      auth: {
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data: null, error: {} }),
        },
      },
    });
    await expect(requireStaff('/manager/x')).rejects.toThrow(/REDIRECT:\/mfa/);
  });

  /** The role is checked before MFA is even asked about, so a non-staff probe learns nothing. */
  it('does not consult MFA for someone who is not staff', async () => {
    resolveIdentity.mockResolvedValue(identity({ workspaces: ['parent'] }));
    await expect(requireStaff('/manager/x')).rejects.toThrow('REDIRECT:/workspace');
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });
});
