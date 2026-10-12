import { notFound, redirect } from 'next/navigation';
import { listAccessibleStudents } from '@studdy/database';
import { Card } from '@studdy/design-system';
import { TextLink } from '@/components/parent/kit';
import { StudentForm } from '@/components/students/student-form';
import { resolveIdentity } from '@/lib/identity/resolve';
import { updateStudentAction } from '@/lib/parent/actions';

export const metadata = { title: 'Edit student' };

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const identity = await resolveIdentity();
  if (identity === null || identity.studdyUserId === null) {
    redirect('/sign-in?next=%2Fparent%2Fstudents');
  }

  const { students } = await listAccessibleStudents(identity.studdyUserId);
  const student = students.find((entry) => entry.reference === reference);
  // An independent student's details are theirs to change, not a guardian's.
  if (student === undefined || student.independenceStatusCode !== 'dependent') notFound();

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <h1 className="text-2xl font-semibold text-text-primary">
          Edit {student.preferredName}&rsquo;s details
        </h1>
        <div className="mt-6">
          <StudentForm
            action={updateStudentAction.bind(null, student.reference)}
            variant="dependent"
            submitLabel="Save changes"
            initial={{
              preferredName: student.preferredName,
              familyName: student.familyName,
              schoolYearCode: student.schoolYearCode,
              schoolOrProviderName: student.schoolOrProviderName,
            }}
          />
        </div>
      </Card>
      <div className="mt-4">
        <TextLink href={`/parent/students/${student.reference}`}>
          ← Back to {student.preferredName}
        </TextLink>
      </div>
    </div>
  );
}
