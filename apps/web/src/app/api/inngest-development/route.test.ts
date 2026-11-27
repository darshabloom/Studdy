import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { serve, expiry, handler, createFunction, probe } = vi.hoisted(() => ({
  serve: vi.fn(),
  createFunction: vi.fn(),
  probe: { id: 'probe' },
  expiry: { id: 'expiry' },
  handler: vi.fn(() => new Response(null, { status: 200 })),
}));

vi.mock('inngest/next', () => ({ serve }));
vi.mock('@/inngest/client', () => ({ inngest: { createFunction } }));
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
  createFunction.mockReturnValue(probe);
  serve.mockReturnValue({ GET: handler, POST: handler, PUT: handler });
  vi.stubEnv('STUDDY_ENVIRONMENT', 'development');
  vi.stubEnv('STUDDY_ENABLE_EXPIRY_SCHEDULER', 'true');
  vi.stubEnv('STUDDY_ENABLE_SCHEDULER_PROBE', '');
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
    ['INNGEST_DEV', 'https://example.test'],
    ['STUDDY_ENABLE_SCHEDULER_PROBE', 'true'],
  ])('rejects all methods when %s is %s', async (key, value) => {
    vi.stubEnv(key, value);
    const route = await import('./route');
    for (const method of ['GET', 'POST', 'PUT'] as const) {
      const request = new NextRequest('https://example.test/api/inngest-development', { method });
      const response = await route[method](request, {} as Parameters<typeof route.GET>[1]);
      expect(response.status).toBe(404);
    }
    expect(serve).not.toHaveBeenCalled();
  });

  it('delegates all methods to the SDK with only expiry registered', async () => {
    const route = await import('./route');
    expect(serve).toHaveBeenCalledExactlyOnceWith({
      client: { createFunction },
      functions: [expiry],
    });
    expect(createFunction).not.toHaveBeenCalled();
    expect(route.GET).toBe(handler);
    expect(route.POST).toBe(handler);
    expect(route.PUT).toBe(handler);
  });

  it('registers only a harmless event-triggered probe when expiry is disabled', async () => {
    vi.stubEnv('STUDDY_ENABLE_EXPIRY_SCHEDULER', '');
    vi.stubEnv('STUDDY_ENABLE_SCHEDULER_PROBE', 'true');
    await import('./route');
    expect(serve).toHaveBeenCalledExactlyOnceWith({
      client: { createFunction },
      functions: [probe],
    });
    expect(createFunction).toHaveBeenCalledExactlyOnceWith(
      {
        id: 'scheduler-connectivity-probe',
        triggers: [{ event: 'studdy/scheduler.probe' }],
      },
      expect.any(Function),
    );
    const callback = createFunction.mock.calls[0]?.[1] as () => Promise<{ ok: boolean }>;
    await expect(callback()).resolves.toEqual({ ok: true });
  });

  it('rejects probe registration on feature branches', async () => {
    vi.stubEnv('STUDDY_ENABLE_EXPIRY_SCHEDULER', '');
    vi.stubEnv('STUDDY_ENABLE_SCHEDULER_PROBE', 'true');
    vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'feature/example');
    await import('./route');
    expect(serve).not.toHaveBeenCalled();
    expect(createFunction).not.toHaveBeenCalled();
  });

  it('does not register duplicate expiry on the default endpoint', async () => {
    await import('../inngest/route');
    expect(serve).toHaveBeenCalledExactlyOnceWith({ client: { createFunction }, functions: [] });
  });
});
