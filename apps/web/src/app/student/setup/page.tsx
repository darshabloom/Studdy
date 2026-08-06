import Link from 'next/link';
import { Button, Card } from '@studdy/design-system';
import { setUpOwnProfileAction } from '@/lib/discovery/actions';
import { StudentForm } from '@/components/students/student-form';

export const metadata = { title: 'Set up your learning profile' };

export default function StudentSetupPage() {
  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <h1 className="text-2xl font-semibold text-text-primary">Set up your learning profile</h1>
        <p className="mt-1 text-sm text-text-secondary">
          A few details so we can match you with tutors at the right level.
        </p>
        <div className="mt-6">
          <StudentForm
            action={setUpOwnProfileAction}
            variant="self"
            submitLabel="Save my profile"
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
