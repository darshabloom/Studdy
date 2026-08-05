import { eq } from 'drizzle-orm';
import { createDatabaseClient } from '../client';
import { authIdentityLinks, roleDefinitions, userRoleAssignments, users } from '../schema/index';

/**
 * Identity repository — the database implementation behind the domain's
 * IdentityRepository interface (Blueprint §14). Server-only.
 */

export interface IdentityRoleAssignmentRecord {
  readonly id: string;
  readonly roleCode: string;
  readonly workspaceEnabled: boolean;
  readonly scopeType: string | null;
  readonly scopeId: string | null;
}

export interface IdentityResolutionRecord {
  readonly studdyUserId: string;
  readonly displayName: string;
  readonly created: boolean;
  readonly roleAssignments: readonly IdentityRoleAssignmentRecord[];
}

export interface EnsureIdentityInput {
  readonly authUserId: string;
  readonly authenticationEmail: string;
  readonly fallbackDisplayName: string;
  readonly countryCode: string;
  readonly timeZone: string;
  readonly locale: string;
}

/**
 * Resolve the permanent Studdy User for a Supabase auth id, creating the
 * user + auth identity link on first authenticated visit (idempotent on the
 * active provider-subject link).
 */
export async function ensureIdentityForAuthUser(
  input: EnsureIdentityInput,
): Promise<IdentityResolutionRecord> {
  const { sql, db } = createDatabaseClient();
  try {
    const [link] = await db
      .select()
      .from(authIdentityLinks)
      .where(eq(authIdentityLinks.providerSubjectId, input.authUserId));

    let studdyUserId: string;
    let displayName: string;
    let created = false;

    if (link !== undefined) {
      studdyUserId = link.userId;
      const [record] = await db.select().from(users).where(eq(users.id, link.userId));
      displayName = record?.displayName ?? 'Studdy user';
    } else {
      const [inserted] = await db
        .insert(users)
        .values({
          displayName: input.fallbackDisplayName,
          countryCode: input.countryCode,
          timeZone: input.timeZone,
          locale: input.locale,
        })
        .returning({ id: users.id });
      if (inserted === undefined) throw new Error('identity.users insert returned no row');
      studdyUserId = inserted.id;
      displayName = input.fallbackDisplayName;
      created = true;
      await db.insert(authIdentityLinks).values({
        userId: studdyUserId,
        providerSubjectId: input.authUserId,
        authenticationEmail: input.authenticationEmail,
      });
    }

    const assignments = await db
      .select({
        id: userRoleAssignments.id,
        statusCode: userRoleAssignments.statusCode,
        workspaceEnabled: userRoleAssignments.workspaceEnabled,
        scopeType: userRoleAssignments.scopeType,
        scopeId: userRoleAssignments.scopeId,
        roleCode: roleDefinitions.code,
      })
      .from(userRoleAssignments)
      .innerJoin(roleDefinitions, eq(userRoleAssignments.roleDefinitionId, roleDefinitions.id))
      .where(eq(userRoleAssignments.userId, studdyUserId));

    return {
      studdyUserId,
      displayName,
      created,
      roleAssignments: assignments
        .filter((assignment) => assignment.statusCode === 'active')
        .map((assignment) => ({
          id: assignment.id,
          roleCode: assignment.roleCode,
          workspaceEnabled: assignment.workspaceEnabled,
          scopeType: assignment.scopeType,
          scopeId: assignment.scopeId,
        })),
    };
  } finally {
    await sql.end();
  }
}
