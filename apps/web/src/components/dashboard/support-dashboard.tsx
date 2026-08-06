import Link from 'next/link';
import { Button, Card, EmptyState, StatusBadge } from '@studdy/design-system';
import { schoolYearLabel } from '@studdy/domain/students';
import type { DiscoveryContext } from '@studdy/domain/discovery';
import type { ReactNode } from 'react';

/**
 * The first useful dashboard, shared by both booking paths. Copy varies by
 * whether the user acts for others; structure and components do not.
 */
export function SupportDashboard({
  context,
  addStudentHref,
  addSubjectHref,
}: {
  context: DiscoveryContext;
  addStudentHref: string;
  addSubjectHref: string;
}): ReactNode {
  const { actsForOthers, students, subjectSections } = context;

  if (students.length === 0) {
    return (
      <EmptyState
        title={actsForOthers ? 'Add your first student' : 'Set up your learning profile'}
        description={
          actsForOthers
            ? 'Tell us who the tutoring is for. You can add more students at any time.'
            : 'Tell us your year level so we can match you with the right tutors.'
        }
        action={
          <Button asChild>
            <Link href={addStudentHref}>
              {actsForOthers ? 'Add a student' : 'Set up my profile'}
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-text-primary">
          {actsForOthers ? 'Your students' : 'Your learning'}
        </h1>
        <div className="flex flex-wrap gap-2">
          {actsForOthers ? (
            <Button variant="secondary" asChild>
              <Link href={addStudentHref}>Add a student</Link>
            </Button>
          ) : null}
          <Button asChild>
            <Link href={addSubjectHref}>Add a subject</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {students.map((student) => {
          const sections = subjectSections.filter(
            (section) => section.studentProfileId === student.studentProfileId,
          );
          return (
            <Card key={student.studentProfileId} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">
                    {student.preferredName}
                  </h2>
                  <p className="text-sm text-text-secondary">
                    {student.schoolYearCode === null
                      ? 'Year level not set'
                      : schoolYearLabel(student.schoolYearCode)}
                  </p>
                </div>
                <span className="text-xs text-text-muted tabular-nums">{student.reference}</span>
              </div>

              {sections.length === 0 ? (
                <div className="rounded-[var(--radius-gentle)] border border-dashed border-surface-border p-4 text-sm text-text-secondary">
                  No subjects yet.{' '}
                  <Link
                    href={addSubjectHref}
                    className="font-medium text-brand-purple hover:underline"
                  >
                    Add a subject need
                  </Link>{' '}
                  to start finding tutors.
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {sections.map((section) => (
                    <li
                      key={section.subjectSectionId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-gentle)] border border-surface-border bg-surface-card-secondary p-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary">
                          {section.subjectDisplayName}
                        </p>
                        <p className="text-sm text-text-secondary">
                          {section.schoolYearCode === null
                            ? 'Year level not set'
                            : schoolYearLabel(section.schoolYearCode)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {section.shortlistCount > 0 ? (
                          <>
                            <StatusBadge family="active">
                              {section.shortlistCount} shortlisted
                            </StatusBadge>
                            <Button variant="secondary" size="sm" asChild>
                              <Link href={`/shortlist/${section.subjectSectionId}`}>
                                Review shortlist
                              </Link>
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" asChild>
                            <Link href={`/tutors?section=${section.subjectSectionId}`}>
                              Find tutors
                            </Link>
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
