import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  EXPIRE_REQUESTS_CRON,
  EXPIRE_REQUESTS_FUNCTION_ID,
  expireRequestsRun,
} from './expire-requests';
import type { ExpirySweepOutcome } from '@/lib/jobs/expire-requests';

/**
 * The scheduler's wiring, without a database and without Inngest.
 *
 * What these prove is narrow on purpose: that the scheduled function DELEGATES
 * rather than reimplementing expiry, that its cadence is the one the design
 * document approved, and that its keys cannot reach a browser. What actually
 * expires, and what must not be expired, is the repository's job and is proved
 * against a real database in the integration suite.
 */

const OUTCOME: ExpirySweepOutcome = {
  correlationId: 'cor_test',
  expiredTutorRequests: 3,
  closedIntendedLessonRequests: 2,
  releasedHolds: 4,
  durationMs: 12,
};

describe('the scheduled expiry function', () => {
  it('calls the existing sweep rather than doing any expiry of its own', async () => {
    const runner = vi.fn<() => Promise<ExpirySweepOutcome>>().mockResolvedValue(OUTCOME);

    const result = await expireRequestsRun(runner);

    expect(runner).toHaveBeenCalledTimes(1);
    expect(result).toEqual(OUTCOME);
  });

  /**
   * A retry, an overlapping tick or a manual run in the middle of a scheduled
   * one must all be ordinary. The safety itself lives in the repository — the
   * sweep is one status-guarded transaction over `FOR UPDATE SKIP LOCKED` rows
   * — so what is asserted here is that the scheduler adds no state of its own
   * between invocations that a second call could trip over.
   */
  it('is safe to invoke repeatedly', async () => {
    const runner = vi.fn<() => Promise<ExpirySweepOutcome>>().mockResolvedValue(OUTCOME);

    const results = await Promise.all([
      expireRequestsRun(runner),
      expireRequestsRun(runner),
      expireRequestsRun(runner),
    ]);

    expect(runner).toHaveBeenCalledTimes(3);
    expect(results).toEqual([OUTCOME, OUTCOME, OUTCOME]);
  });

  it('reports a run that found nothing to do, rather than treating it as a failure', async () => {
    const quiet: ExpirySweepOutcome = {
      correlationId: 'cor_quiet',
      expiredTutorRequests: 0,
      closedIntendedLessonRequests: 0,
      releasedHolds: 0,
      durationMs: 3,
    };
    const runner = vi.fn<() => Promise<ExpirySweepOutcome>>().mockResolvedValue(quiet);

    await expect(expireRequestsRun(runner)).resolves.toEqual(quiet);
  });

  /**
   * A failure must propagate so Inngest retries it. Swallowing it would make a
   * broken sweep look like a quiet one for as long as nobody read the logs.
   */
  it('lets a failure escape so the scheduler can retry it', async () => {
    const runner = vi
      .fn<() => Promise<ExpirySweepOutcome>>()
      .mockRejectedValue(new Error('database unreachable'));

    await expect(expireRequestsRun(runner)).rejects.toThrow('database unreachable');
  });
});

describe('the cadence', () => {
  /**
   * Every minute, and pinned because it is a product promise rather than a
   * preference: the payment window is sixty minutes and the tutor is told when
   * their hold ends, so the sweep's period is the error bar on that. At five
   * minutes a family could be told 5:00 and the slot stay held until 5:05.
   */
  it('runs once a minute', () => {
    expect(EXPIRE_REQUESTS_CRON).toBe('* * * * *');
  });

  it('has a stable function id, which is how Inngest tracks the schedule', () => {
    expect(EXPIRE_REQUESTS_FUNCTION_ID).toBe('expire-overdue-requests');
  });
});

/**
 * Walk `src`, returning every file's path and contents.
 *
 * Cheap enough at this repository's size, and worth more than a targeted check:
 * the failure being guarded against is somebody adding an exposure in a file
 * nobody thought to list.
 */
function sourceFiles(): { path: string; text: string }[] {
  const root = join(process.cwd(), 'src');
  const found: { path: string; text: string }[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry)) continue;
      found.push({ path: full, text: readFileSync(full, 'utf8') });
    }
  };
  walk(root);
  return found;
}

describe('scheduler configuration never reaches the browser', () => {
  const files = sourceFiles();

  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  /**
   * `NEXT_PUBLIC_` is inlined into the client bundle at build time. An Inngest
   * signing key there would let anyone invoke Studdy's scheduled work, and a
   * cron secret there would do the same for the manual route.
   */
  it('never prefixes a scheduler secret with NEXT_PUBLIC_', () => {
    const offenders = files.filter((file) =>
      /NEXT_PUBLIC_[A-Z_]*(INNGEST|CRON|SIGNING)/.test(file.text),
    );
    expect(offenders.map((file) => file.path)).toEqual([]);
  });

  /**
   * The keys are read by the SDK from the server environment. No Studdy file
   * should name them at all outside the Inngest client, and none may sit in a
   * file marked `'use client'`.
   */
  it('never names a scheduler secret in a client component', () => {
    const offenders = files.filter(
      (file) =>
        /^['"]use client['"]/m.test(file.text) &&
        /INNGEST_SIGNING_KEY|INNGEST_EVENT_KEY|CRON_SECRET/.test(file.text),
    );
    expect(offenders.map((file) => file.path)).toEqual([]);
  });

  /**
   * The Inngest client and the serve route are server-side by construction.
   * Marking either `'use client'` would be a quiet way to bundle the SDK — and
   * its environment reads — into the browser.
   */
  it('keeps the Inngest client and endpoint off the client', () => {
    const inngestFiles = files.filter((file) => /[\\/]inngest[\\/]/.test(file.path));
    expect(inngestFiles.length).toBeGreaterThan(0);
    for (const file of inngestFiles) {
      expect(/^['"]use client['"]/m.test(file.text)).toBe(false);
    }
  });
});
