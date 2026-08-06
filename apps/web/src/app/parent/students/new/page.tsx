import Link from 'next/link';
import { Button, Card } from '@studdy/design-system';
import { addStudentAction } from '@/lib/discovery/actions';
import { StudentForm } from '@/components/students/student-form';

export const metadata = { title: 'Add a student' };

export default function AddStudentPage() {
  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <h1 className="text-2xl font-semibold text-text-primary">Add a student</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Who is the tutoring for? You can add more students later.
        </p>
        <div className="mt-6">
          <StudentForm action={addStudentAction} variant="dependent" submitLabel="Add student" />
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
