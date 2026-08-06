import { createClient } from '@supabase/supabase-js';
import { and, eq } from 'drizzle-orm';
import { createDatabaseClient } from '../../client';
import {
  authIdentityLinks,
  roleDefinitions,
  userPreferences,
  userRoleAssignments,
  users,
} from '../../schema/index';
import { LOCAL_SYNTHETIC_PASSWORD, SYNTHETIC_USERS } from '../synthetic-users';

/** The nine role definitions (Permissions doc; see @studdy/permissions). */
const ROLE_SEED: ReadonlyArray<{
  code: string;
  displayName: string;
  workspaceCode: string | null;
}> = [
  { code: 'parent_guardian', displayName: 'Parent or guardian', workspaceCode: 'parent' },
  {
    code: 'dependent_student',
    displayName: 'Dependent student',
    workspaceCode: 'dependent_student',
  },
  {
    code: 'independent_student',
    displayName: 'Independent student',
    workspaceCode: 'independent_student',
  },
  { code: 'tutor', displayName: 'Tutor', workspaceCode: 'tutor' },
  { code: 'supporter', displayName: 'Supporter', workspaceCode: null },
  {
    code: 'organisation_member',
    displayName: 'Organisation member',
    workspaceCode: 'organisation',
  },
  {
    code: 'organisation_manager',
    displayName: 'Organisation manager',
    workspaceCode: 'organisation',
  },
  { code: 'platform_manager', displayName: 'Platform Manager', workspaceCode: 'platform_manager' },
  { code: 'platform_owner', displayName: 'Platform Owner', workspaceCode: 'platform_owner' },
];

/**
 * Create or reuse a Supabase Auth user for local development so synthetic
 * accounts can actually sign in. Falls back to the deterministic UUID when
 * Supabase Auth is unavailable (e.g. plain-Postgres CI).
 */
async function resolveAuthId(email: string, deterministicId: string): Promise<string> {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (url === undefined || serviceRoleKey === undefined) return deterministicId;

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const created = await admin.auth.admin.createUser({
    email,
    password: LOCAL_SYNTHETIC_PASSWORD,
    email_confirm: true,
  });
  if (created.data.user !== null) return created.data.user.id;

  // Already exists — find it (synthetic account list is tiny, one page suffices).
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list.data.users.find((candidate) => candidate.email === email);
  if (existing !== undefined) return existing.id;
  throw new Error(
    `Could not create or find Supabase auth user for ${email}: ${created.error?.message ?? 'unknown error'}`,
  );
}

export async function seedCleanRegistration(): Promise<void> {
  const { sql, db } = createDatabaseClient();
  try {
    // Role definitions — idempotent upsert on code.
    for (const role of ROLE_SEED) {
      await db
        .insert(roleDefinitions)
        .values({
          code: role.code,
          displayName: role.displayName,
          workspaceCode: role.workspaceCode,
        })
        .onConflictDoNothing({ target: roleDefinitions.code });
    }

    const roles = await db.select().from(roleDefinitions);
    const roleIdByCode = new Map(roles.map((role) => [role.code, role.id]));

    for (const synthetic of SYNTHETIC_USERS) {
      const authId = await resolveAuthId(synthetic.email, synthetic.deterministicAuthId);

      let [existingLink] = await db
        .select()
        .from(authIdentityLinks)
        .where(eq(authIdentityLinks.providerSubjectId, authId));

      if (existingLink === undefined) {
        // Heal links seeded before Supabase Auth was available: same email,
        // deterministic subject id → repoint at the real auth user.
        const [byEmail] = await db
          .select()
          .from(authIdentityLinks)
          .where(eq(authIdentityLinks.authenticationEmail, synthetic.email));
        if (byEmail !== undefined) {
          await db
            .update(authIdentityLinks)
            .set({ providerSubjectId: authId })
            .where(eq(authIdentityLinks.id, byEmail.id));
          existingLink = { ...byEmail, providerSubjectId: authId };
        }
      }

      let userId: string;
      if (existingLink !== undefined) {
        userId = existingLink.userId;
      } else {
        const [insertedUser] = await db
          .insert(users)
          .values({
            displayName: synthetic.displayName,
            countryCode: 'NZ',
            timeZone: 'Pacific/Auckland',
            locale: 'en-NZ',
          })
          .returning({ id: users.id });
        if (insertedUser === undefined) throw new Error('users insert returned no row');
        userId = insertedUser.id;
        await db.insert(authIdentityLinks).values({
          userId,
          providerSubjectId: authId,
          authenticationEmail: synthetic.email,
        });
      }

      for (const roleCode of synthetic.roleCodes) {
        const roleDefinitionId = roleIdByCode.get(roleCode);
        if (roleDefinitionId === undefined) throw new Error(`Unknown role code ${roleCode}`);
        const statusCode = synthetic.roleStatus?.[roleCode] ?? 'active';
        const existing = await db
          .select({ id: userRoleAssignments.id, statusCode: userRoleAssignments.statusCode })
          .from(userRoleAssignments)
          .where(
            and(
              eq(userRoleAssignments.userId, userId),
              eq(userRoleAssignments.roleDefinitionId, roleDefinitionId),
            ),
          );
        const [current] = existing;
        if (current === undefined) {
          await db.insert(userRoleAssignments).values({
            userId,
            roleDefinitionId,
            statusCode,
            workspaceEnabled: statusCode === 'active',
            assignmentReasonCode: 'development_seed',
          });
        } else if (current.statusCode !== statusCode) {
          await db
            .update(userRoleAssignments)
            .set({ statusCode, workspaceEnabled: statusCode === 'active' })
            .where(eq(userRoleAssignments.id, current.id));
        }
      }
      // clean_registration means clean: no saved workspace preference, so the
      // chooser behaviour is deterministic for multi-role synthetic accounts.
      await db.delete(userPreferences).where(eq(userPreferences.userId, userId));

      console.log(`seeded ${synthetic.email}`);
    }
  } finally {
    await sql.end();
  }
}
