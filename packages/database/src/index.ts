export {
  createDatabaseClient,
  databaseUrl,
  LOCAL_DATABASE_URL,
  type DatabaseClient,
} from './client';
export * as schema from './schema/index';
export {
  ensureIdentityForAuthUser,
  completeAccountSetup,
  setLastActiveWorkspace,
  recordAuthAuditEvent,
  type CompleteAccountSetupInput,
  type EnsureIdentityInput,
  type IdentityResolutionRecord,
  type IdentityRoleAssignmentRecord,
} from './repositories/identity';
export {
  listSubjects,
  ensureFamilyAccountForGuardian,
  createDependentStudent,
  ensureIndependentStudentProfile,
  listAccessibleStudents,
  listSubjectSections,
  createSubjectSection,
  subjectSectionBelongsToUser,
  type StudentRecord,
  type SubjectSectionRecord,
  type SubjectOption,
} from './repositories/students';
export {
  searchPublicTutors,
  findPublicTutorByReference,
  listShortlist,
  addToShortlist,
  removeFromShortlist,
  type PublicTutorRow,
  type TutorSearchQuery,
  type ShortlistEntryRow,
  type ShortlistAddOutcome,
} from './repositories/discovery';
