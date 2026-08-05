import { text } from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { permissionsSchema } from '../shared/schemas';

/**
 * `permissions.role_definitions` — roles are data, never boolean columns
 * (Database spec §4.3). Seeded with the nine role definitions from the
 * Permissions doc; capabilities attach in later slices.
 */
export const roleDefinitions = permissionsSchema.table('role_definitions', {
  ...standardColumns,
  code: text('code').notNull().unique(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  /** Workspace granted by this role, null when none (e.g. supporter). */
  workspaceCode: text('workspace_code'),
  statusCode: text('status_code').notNull().default('active'),
});
