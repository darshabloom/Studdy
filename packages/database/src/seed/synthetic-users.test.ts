import { describe, expect, it } from 'vitest';
import { SYNTHETIC_USERS, assertUniqueSyntheticUsers, type SyntheticUser } from './synthetic-users';

/**
 * Guard against reintroducing the duplicate `deterministicAuthId` that
 * `parent.requests@` and `parent.tutor@` once shared.
 *
 * The bug was invisible in normal use: with `SUPABASE_SERVICE_ROLE_KEY` set,
 * Supabase Auth assigns real ids and the deterministic value is never read. It
 * only applies on the plain-Postgres fallback path, where two accounts holding
 * different roles would silently collapse into one.
 */
describe('synthetic users', () => {
  it('gives every user a unique deterministic auth id', () => {
    const ids = SYNTHETIC_USERS.map((user) => user.deterministicAuthId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every user a unique email', () => {
    const emails = SYNTHETIC_USERS.map((user) => user.email);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it('keeps the two lesson-request accounts distinct from every other account', () => {
    // These two are dedicated to the lesson-request journeys precisely so no
    // other spec can mutate them. Sharing an id with another account would
    // defeat that at the seed layer rather than the test layer.
    const requestAccounts = SYNTHETIC_USERS.filter((user) => user.email.includes('.requests@'));
    expect(requestAccounts).toHaveLength(2);

    for (const account of requestAccounts) {
      const sharing = SYNTHETIC_USERS.filter(
        (other) =>
          other.email !== account.email &&
          other.deterministicAuthId === account.deterministicAuthId,
      );
      expect(sharing).toEqual([]);
    }
  });

  it('rejects a duplicate id rather than seeding two accounts as one', () => {
    const withDuplicate: SyntheticUser[] = [
      { email: 'a@local.studdy.test', displayName: 'A', roleCodes: [], deterministicAuthId: 'dup' },
      { email: 'b@local.studdy.test', displayName: 'B', roleCodes: [], deterministicAuthId: 'dup' },
    ];
    expect(() => {
      assertUniqueSyntheticUsers(withDuplicate);
    }).toThrow(/Duplicate deterministicAuthId/);
  });

  it('rejects a duplicate email', () => {
    const withDuplicate: SyntheticUser[] = [
      {
        email: 'same@local.studdy.test',
        displayName: 'A',
        roleCodes: [],
        deterministicAuthId: '1',
      },
      {
        email: 'same@local.studdy.test',
        displayName: 'B',
        roleCodes: [],
        deterministicAuthId: '2',
      },
    ];
    expect(() => {
      assertUniqueSyntheticUsers(withDuplicate);
    }).toThrow(/Duplicate email/);
  });

  it('accepts the real list', () => {
    expect(() => {
      assertUniqueSyntheticUsers();
    }).not.toThrow();
  });
});
