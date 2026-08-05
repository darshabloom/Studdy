/**
 * Drizzle schema root. Directory layout follows Database spec §2.2 — twenty
 * module directories; tables land as their slices land. Empty directories
 * carry a placeholder index so the structure is stable from day one.
 */

// shared
export * from './shared/schemas';

// identity
export { users } from './identity/users';
export { authIdentityLinks } from './identity/auth-identity-links';
export { contactPoints } from './identity/contact-points';
export { userRoleAssignments } from './identity/user-role-assignments';

// permissions
export { roleDefinitions } from './permissions/role-definitions';

// audit
export { auditEvents } from './audit/audit-events';
export { statusTransitions } from './audit/status-transitions';
export { domainEvents } from './audit/domain-events';
export { outboxEntries } from './audit/outbox-entries';
