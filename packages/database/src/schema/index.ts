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
export { userPreferences } from './identity/user-preferences';

// permissions
export { roleDefinitions } from './permissions/role-definitions';

// audit
export { auditEvents } from './audit/audit-events';
export { statusTransitions } from './audit/status-transitions';
export { domainEvents } from './audit/domain-events';
export { outboxEntries } from './audit/outbox-entries';

// platform
export { globalReferenceSeq } from './platform/index';

// families
export { familyAccounts } from './families/family-accounts';
export { familyMemberships } from './families/family-memberships';

// students
export { studentProfiles } from './students/student-profiles';
export { studentSubjectSections } from './students/student-subject-sections';
export { subjectSectionShortlistEntries } from './students/subject-section-shortlist-entries';

// tutors
export { tutorProfiles } from './tutors/tutor-profiles';
export { tutorVerifications } from './tutors/tutor-verifications';

// services
export { services, serviceVersions } from './services/services';

// platform reference data
export { subjects } from './platform/subjects';

// requests and holds (feat/intended-lesson-request)
export { ruleSettings } from './platform/rule-settings';
export { intendedLessonRequests } from './bookings/intended-lesson-requests';
export { tutorRequests } from './bookings/tutor-requests';
export { tutorTimeReservations } from './availability/tutor-time-reservations';

// tutor availability (feat/availability-and-multi-time-requests)
export { availabilityRules } from './availability/availability-rules';
export { availabilityExceptions } from './availability/availability-exceptions';

// multi-time requests (feat/availability-and-multi-time-requests)
export { requestTimeOptions } from './bookings/request-time-options';
export { tutorRequestTimeOptions } from './bookings/tutor-request-time-options';

// payment ledger and pricing (feat/payments-schema-and-pricing)
export { payments } from './payments/payments';
export { paymentEvents } from './payments/payment-events';
export { tutorTransfers } from './payments/tutor-transfers';
