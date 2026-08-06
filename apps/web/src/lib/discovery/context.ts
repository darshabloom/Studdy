import 'server-only';
import { listAccessibleStudents, listSubjectSections } from '@studdy/database';
import type { DiscoveryContext } from '@studdy/domain/discovery';
import type { WorkspaceCode } from '@studdy/permissions';
import { resolveIdentity } from '../identity/resolve';

/**
 * Resolve the shared student-support and discovery context for the signed-in
 * user. Deliberately not named after booking: this slice creates no requests,
 * holds or bookings.
 *
 * Both booking paths produce the same shape, so no page below this needs to
 * ask "am I a parent?" — it asks "which student and subject am I acting on?".
 */
export async function resolveDiscoveryContext(): Promise<DiscoveryContext | null> {
  const identity = await resolveIdentity();
  if (identity === null || identity.studdyUserId === null) return null;

  const workspace: WorkspaceCode =
    identity.workspaces.find((code) => code === 'parent') ??
    identity.workspaces.find((code) => code === 'independent_student') ??
    identity.workspaces[0] ??
    'independent_student';

  const { familyAccountId, students } = await listAccessibleStudents(identity.studdyUserId);
  const sections = await listSubjectSections(students.map((student) => student.studentProfileId));

  return {
    studdyUserId: identity.studdyUserId,
    workspace,
    familyAccountId,
    students: students.map((student) => ({
      studentProfileId: student.studentProfileId,
      reference: student.reference,
      preferredName: student.preferredName,
      schoolYearCode: student.schoolYearCode,
      independenceStatusCode: student.independenceStatusCode,
    })),
    subjectSections: sections.map((section) => ({
      subjectSectionId: section.subjectSectionId,
      studentProfileId: section.studentProfileId,
      subjectId: section.subjectId,
      subjectCode: section.subjectCode,
      subjectDisplayName: section.subjectDisplayName,
      schoolYearCode: section.schoolYearCode,
      formatPreferenceCode: section.formatPreferenceCode,
      shortlistCount: section.shortlistCount,
    })),
    actsForOthers: workspace === 'parent',
  };
}
