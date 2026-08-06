import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listSubjects } from '@studdy/database';
import { Button, Card, EmptyState } from '@studdy/design-system';
import { SubjectNeedForm } from '@/components/students/subject-need-form';
import { resolveDiscoveryContext } from '@/lib/discovery/context';

export const metadata = { title: 'Add a subject' };

export default async function AddStudentSubjectPage() {
  const context = await resolveDiscoveryContext();
  if (context === null) redirect('/sign-in?next=%2Fstudent%2Fsubjects%2Fnew');

  if (context.students.length === 0) {
    return (
      <EmptyState
        title="Set up your profile first"
        description="We need your year level before we can match you with tutors."
        action={
          <Button asChild>
            <Link href="/student/setup">Set up my profile</Link>
          </Button>
        }
      />
    );
  }

  const subjects = await listSubjects();

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <h1 className="text-2xl font-semibold text-text-primary">What would you like help with?</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Add a subject and we&rsquo;ll show you tutors who teach it at your level.
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
          <Link href="/student">Back to your learning</Link>
        </Button>
      </div>
    </div>
  );
}
