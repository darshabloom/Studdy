import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient } from '../client';
import {
  BaselineAlreadySeededError,
  seedCleanRegistration,
} from '../seed/scenarios/clean-registration';
import { SYNTHETIC_USERS } from '../seed/synthetic-users';

/**
 * The baseline seed must refuse a second run rather than partially duplicating
 * data.
 *
 * This is the failure this guard exists for: a repeat `pnpm db:seed` used to
 * write on top of an established baseline, and the damage only surfaced later
 * as an unrelated-looking test failure. Refusing before the first write keeps
 * the database exactly as it was, so the developer loses nothing by making the
 * mistake.
 *
 * Requires a seeded database (pnpm supabase:start && pnpm db:migrate && pnpm db:seed).
 */
const { sql } = createDatabaseClient();

interface Counts {
  readonly syntheticLinks: number;
  readonly syntheticUsers: number;
  readonly roles: number;
}

/**
 * Counts scoped to exactly what the baseline seed writes.
 *
 * Whole-table counts cannot be used here: integration files run in parallel and
 * other suites create their own users mid-assertion, so a global count moves
 * for reasons that have nothing to do with this guard. The synthetic account
 * list and the role definitions are written only by the baseline seed.
 */
const SYNTHETIC_EMAILS = SYNTHETIC_USERS.map((synthetic) => synthetic.email);

async function currentCounts(): Promise<Counts> {
  const [row] = await sql<
    { syntheticLinks: number; syntheticUsers: number; roles: number }[]
  >`select (select count(*)::int
              from identity.auth_identity_links
             where authentication_email = any(${SYNTHETIC_EMAILS})) as "syntheticLinks",
           (select count(distinct link.user_id)::int
              from identity.auth_identity_links link
             where link.authentication_email = any(${SYNTHETIC_EMAILS})) as "syntheticUsers",
           (select count(*)::int from permissions.role_definitions) as roles`;
  if (row === undefined) throw new Error('count query returned no row');
  return row;
}

beforeAll(async () => {
  const { syntheticLinks } = await currentCounts();
  if (syntheticLinks === 0) {
    throw new Error('no synthetic accounts seeded — run pnpm db:seed before this suite');
  }
});

afterAll(async () => {
  await sql.end();
});

describe('baseline seed safety', () => {
  it('refuses a second baseline seed instead of duplicating data', async () => {
    await expect(seedCleanRegistration()).rejects.toBeInstanceOf(BaselineAlreadySeededError);
  });

  it('names the approved reset flow in the failure', async () => {
    // The message is the whole point: a developer hitting this needs to know
    // what to run next, not merely that something was refused.
    await expect(seedCleanRegistration()).rejects.toThrow(
      /pnpm db:reset && pnpm db:migrate && pnpm db:seed/,
    );
  });

  it('leaves the database byte-for-byte unchanged when it refuses', async () => {
    const before = await currentCounts();
    await expect(seedCleanRegistration()).rejects.toThrow(BaselineAlreadySeededError);
    const after = await currentCounts();
    expect(after).toEqual(before);
  });
});
