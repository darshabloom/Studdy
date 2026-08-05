import Link from 'next/link';
import { Button, EmptyState } from '@studdy/design-system';

export const metadata = { title: 'Find a Tutor' };

export default function TutorsPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="font-display text-4xl font-semibold text-brand-purple-deep">Find a Tutor</h1>
      <p className="mt-4 max-w-2xl text-text-secondary">
        Tutor discovery is coming next. You will answer a few questions about the student, see
        several suitable tutors, and send a request to more than one tutor at once — then choose who
        to book once they respond.
      </p>
      <div className="mt-10">
        <EmptyState
          title="Tutor discovery is not open yet"
          description="We are building the marketplace foundation right now. Join Studdy to be ready when tutor matching opens."
          action={
            <Button asChild>
              <Link href="/sign-up">Join Studdy</Link>
            </Button>
          }
        />
      </div>
    </section>
  );
}
