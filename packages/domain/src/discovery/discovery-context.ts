import type { WorkspaceCode } from '@studdy/permissions';

/**
 * The shared access context for student support and tutor discovery.
 *
 * Deliberately NOT named after booking: this slice creates no Intended Lesson
 * Requests, Tutor Requests, holds or Bookings. It answers only "which student
 * and subject am I acting on, and may I?".
 *
 * Both booking paths resolve to the same shape, so no page needs to ask
 * "am I a parent?":
 *   * guardian — a family account with one or more dependent students;
 *   * independent student — exactly one student, themselves, no family required.
 */
export interface DiscoveryStudent {
  readonly studentProfileId: string;
  readonly reference: string;
  readonly preferredName: string;
  readonly schoolYearCode: string | null;
  readonly independenceStatusCode: 'dependent' | 'independent';
}

export interface DiscoverySubjectSection {
  readonly subjectSectionId: string;
  readonly studentProfileId: string;
  readonly subjectId: string;
  readonly subjectCode: string;
  readonly subjectDisplayName: string;
  readonly schoolYearCode: string | null;
  readonly formatPreferenceCode: string;
  readonly shortlistCount: number;
}

export interface DiscoveryContext {
  readonly studdyUserId: string;
  readonly workspace: WorkspaceCode;
  /** Null for an independent student acting alone. */
  readonly familyAccountId: string | null;
  /** Every student this user may act for. */
  readonly students: readonly DiscoveryStudent[];
  readonly subjectSections: readonly DiscoverySubjectSection[];
  /** True when the user manages others' learning rather than their own. */
  readonly actsForOthers: boolean;
}

/** Does this context permit acting on the given student? */
export function canActForStudent(context: DiscoveryContext, studentProfileId: string): boolean {
  return context.students.some((student) => student.studentProfileId === studentProfileId);
}

/** Does this context permit acting on the given subject section? */
export function canActForSubjectSection(
  context: DiscoveryContext,
  subjectSectionId: string,
): boolean {
  return context.subjectSections.some((section) => section.subjectSectionId === subjectSectionId);
}

export function findSubjectSection(
  context: DiscoveryContext,
  subjectSectionId: string,
): DiscoverySubjectSection | null {
  return (
    context.subjectSections.find((section) => section.subjectSectionId === subjectSectionId) ?? null
  );
}

export function findStudent(
  context: DiscoveryContext,
  studentProfileId: string,
): DiscoveryStudent | null {
  return context.students.find((student) => student.studentProfileId === studentProfileId) ?? null;
}
