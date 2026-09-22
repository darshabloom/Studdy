import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactNode } from 'react';
import { RestrictedState } from '@studdy/design-system';
import type { WorkspaceCode } from '@studdy/permissions';
import type { ResolvedIdentity } from '@/lib/identity/resolve';

/**
 * Regression coverage for the Week 1 fail-open access bug: a database blip
 * must never grant workspace access, and the MFA gate must never be
 * skippable by any access-check outcome, including that blip.
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

vi.mock('next/navigation', () => ({
  redirect: (url: string) => redirect(url),
}));

const { WorkspaceChrome } = await import('./chrome');

function baseIdentity(overrides: Partial<ResolvedIdentity> = {}): ResolvedIdentity {
  return {
    authUserId: 'user-1',
    email: 'user@example.test',
    studdyUserId: 'studdy-1',
    displayName: 'Test User',
    roleAssignments: [],
    pendingRoleCodes: [],
    workspaces: [],
    lastActiveWorkspaceCode: null,
    needsSetup: false,
    databaseAvailable: true,
    ...overrides,
  };
}

function supabaseWithAal(currentLevel: 'aal1' | 'aal2', nextLevel: 'aal1' | 'aal2' = 'aal2') {
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

/** The two expression children chrome.tsx puts inside <WorkspaceShell>. */
function mainContent(element: ReactNode): readonly ReactNode[] {
  if (!isValidElement(element)) return [];
  const kids = (element.props as { children?: ReactNode }).children;
  return Array.isArray(kids) ? kids : [kids];
}

function rendersChildren(element: ReactNode, marker: ReactNode): boolean {
  return mainContent(element).includes(marker);
}

function rendersRestricted(element: ReactNode): boolean {
  return mainContent(element).some((kid) => isValidElement(kid) && kid.type === RestrictedState);
}

const PARENT: readonly WorkspaceCode[] = ['parent'];
const OWNER: readonly WorkspaceCode[] = ['platform_owner'];

describe('WorkspaceChrome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirect.mockImplementation((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    });
  });

  it('renders children when the user has access', async () => {
    resolveIdentity.mockResolvedValue(baseIdentity({ workspaces: ['parent'] }));
    const secret = <div>SECRET</div>;

    const result = await WorkspaceChrome({
      accepts: PARENT,
      navItems: [],
      homeHref: '/parent',
      children: secret,
    });

    expect(rendersChildren(result, secret)).toBe(true);
    expect(rendersRestricted(result)).toBe(false);
  });

  it('denies access when the user has no matching workspace', async () => {
    resolveIdentity.mockResolvedValue(baseIdentity({ workspaces: [] }));
    const secret = <div>SECRET</div>;

    const result = await WorkspaceChrome({
      accepts: PARENT,
      navItems: [],
      homeHref: '/parent',
      children: secret,
    });

    expect(rendersChildren(result, secret)).toBe(false);
    expect(rendersRestricted(result)).toBe(true);
  });

  it('denies access — never renders children — when the database is unavailable (regression)', async () => {
    resolveIdentity.mockResolvedValue(baseIdentity({ databaseAvailable: false, workspaces: [] }));
    const secret = <div>SECRET</div>;

    const result = await WorkspaceChrome({
      accepts: PARENT,
      navItems: [],
      homeHref: '/parent',
      children: secret,
    });

    expect(rendersChildren(result, secret)).toBe(false);
    expect(rendersRestricted(result)).toBe(true);
  });

  it('redirects to sign-in when there is no identity at all', async () => {
    resolveIdentity.mockResolvedValue(null);

    await expect(
      WorkspaceChrome({ accepts: PARENT, navItems: [], homeHref: '/parent', children: null }),
    ).rejects.toThrow('REDIRECT:/sign-in?next=%2Fparent');
  });

  it('requires MFA even when the database is unavailable (regression: MFA no longer gated on hasAccess)', async () => {
    resolveIdentity.mockResolvedValue(baseIdentity({ databaseAvailable: false, workspaces: [] }));
    createSupabaseServerClient.mockResolvedValue(supabaseWithAal('aal1', 'aal2'));

    await expect(
      WorkspaceChrome({
        accepts: OWNER,
        navItems: [],
        homeHref: '/owner',
        requireMfa: true,
        children: <div>SECRET</div>,
      }),
    ).rejects.toThrow('REDIRECT:/mfa');
  });

  it('still denies access on MFA success if the database remains unavailable', async () => {
    resolveIdentity.mockResolvedValue(baseIdentity({ databaseAvailable: false, workspaces: [] }));
    createSupabaseServerClient.mockResolvedValue(supabaseWithAal('aal2'));
    const secret = <div>SECRET</div>;

    const result = await WorkspaceChrome({
      accepts: OWNER,
      navItems: [],
      homeHref: '/owner',
      requireMfa: true,
      children: secret,
    });

    expect(rendersChildren(result, secret)).toBe(false);
    expect(rendersRestricted(result)).toBe(true);
  });

  it('renders children once access and MFA both pass', async () => {
    resolveIdentity.mockResolvedValue(baseIdentity({ workspaces: ['platform_owner'] }));
    createSupabaseServerClient.mockResolvedValue(supabaseWithAal('aal2'));
    const secret = <div>SECRET</div>;

    const result = await WorkspaceChrome({
      accepts: OWNER,
      navItems: [],
      homeHref: '/owner',
      requireMfa: true,
      children: secret,
    });

    expect(rendersChildren(result, secret)).toBe(true);
  });

  it('sends a signed-in user without a matching role to MFA before ever showing the access decision (deliberate: MFA is fully independent of hasAccess)', async () => {
    resolveIdentity.mockResolvedValue(baseIdentity({ databaseAvailable: true, workspaces: [] }));
    createSupabaseServerClient.mockResolvedValue(supabaseWithAal('aal1', 'aal1'));

    await expect(
      WorkspaceChrome({
        accepts: OWNER,
        navItems: [],
        homeHref: '/owner',
        requireMfa: true,
        children: <div>SECRET</div>,
      }),
    ).rejects.toThrow('REDIRECT:/mfa/enroll');
  });
});
