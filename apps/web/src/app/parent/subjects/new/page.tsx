import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listSubjects } from '@studdy/database';
import { Button, Card, EmptyState } from '@studdy/design-system';
import { SubjectNeedForm } from '@/components/students/subject-need-form';
import { resolveDiscoveryContext } from '@/lib/discovery/context';

export const metadata = { title: 'Add a subject need' };

export default async function AddSubjectNeedPage() {
  const context = await resolveDiscoveryContext();
  if (context === null) redirect('/sign-in?next=%2Fparent%2Fsubjects%2Fnew');

  if (context.students.length === 0) {
    return (
      <EmptyState
        title="Add a student first"
        description="Subject needs belong to a student, so start by adding one."
        action={
          <Button asChild>
            <Link href="/parent/students/new">Add a student</Link>
          </Button>
        }
      />
    );
  }

  const subjects = await listSubjects();

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <h1 className="text-2xl font-semibold text-text-primary">What do they need help with?</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Add a subject and we&rsquo;ll show you tutors who teach it at that level.
        </p>
        <div className="mt-6">
          <SubjectNeedForm
            subjects={subjects}
            students={context.students.map((student) => ({
              studentProfileId: student.studentProfileId,
              preferredName: student.preferredName,
              schoolYearCode: student.schoolYearCode,
            }))}
            actsForOthers={context.actsForOthers}
          />
        </div>
      </Card>
      <div className="mt-4">
        <Button variant="quiet" asChild>
          <Link href="/parent">Back to your students</Link>
        </Button>
      </div>
    </div>
  );
}
