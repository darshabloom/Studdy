import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { serve, expiry, handler } = vi.hoisted(() => ({
  serve: vi.fn(),
  expiry: { id: 'expiry' },
  handler: vi.fn(() => new Response(null, { status: 200 })),
}));

vi.mock('inngest/next', () => ({ serve }));
vi.mock('@/inngest/client', () => ({ inngest: {} }));
vi.mock('@/inngest/functions/expire-requests', () => ({
  expireRequestsScheduled: expiry,
}));
vi.mock('@/inngest/functions/drain-outbox', () => ({ drainOutboxScheduled: {} }));
vi.mock('@/inngest/functions/reconcile-payments', () => ({
  reconcilePaymentsScheduled: {},
}));
vi.mock('@/inngest/functions/settle-refunds', () => ({ settleRefundsScheduled: {} }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  serve.mockReturnValue({ GET: handler, POST: handler, PUT: handler });
  vi.stubEnv('STUDDY_ENVIRONMENT', 'development');
  vi.stubEnv('STUDDY_ENABLE_EXPIRY_SCHEDULER', 'true');
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'development');
  vi.stubEnv('INNGEST_SIGNING_KEY', 'test-only');
  vi.stubEnv('INNGEST_DEV', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('development scheduler endpoint', () => {
  it.each([
    ['VERCEL_ENV', 'production'],
    ['VERCEL_ENV', ''],
    ['VERCEL_GIT_COMMIT_REF', 'feature/example'],
    ['VERCEL_GIT_COMMIT_REF', ''],
    ['STUDDY_ENVIRONMENT', 'production'],
    ['STUDDY_ENVIRONMENT', ''],
    ['STUDDY_ENABLE_EXPIRY_SCHEDULER', 'false'],
    ['STUDDY_ENABLE_EXPIRY_SCHEDULER', ''],
    ['INNGEST_SIGNING_KEY', ''],
    ['INNGEST_DEV', '1'],
    ['INNGEST_DEV', 'true'],
  ])('rejects all methods when %s is %s', async (key, value) => {
    vi.stubEnv(key, value);
    const route = await import('./route');
    expect((await route.GET()).status).toBe(404);
    expect((await route.POST()).status).toBe(404);
    expect((await route.PUT()).status).toBe(404);
    expect(serve).not.toHaveBeenCalled();
  });

  it('delegates all methods to the SDK with only expiry registered', async () => {
    const route = await import('./route');
    expect(serve).toHaveBeenCalledExactlyOnceWith({
      client: {},
      functions: [expiry],
    });
    expect(route.GET).toBe(handler);
    expect(route.POST).toBe(handler);
    expect(route.PUT).toBe(handler);
  });

  it('does not register duplicate expiry on the default endpoint', async () => {
    await import('../inngest/route');
    expect(serve).toHaveBeenCalledExactlyOnceWith({ client: {}, functions: [] });
  });
});
