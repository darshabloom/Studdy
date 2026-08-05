import Link from 'next/link';
import { Button } from '@studdy/design-system';

export const metadata = { title: 'For Tutors' };

export default function ForTutorsPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-4xl font-semibold text-brand-purple-deep">
        Run your tutoring on Studdy
      </h1>
      <p className="mt-4 text-text-secondary">
        Studdy is a tutor operating system: bookings, availability, payments, lesson summaries,
        homework and student progress in one place. Join for free — Studdy earns when tutors earn.
      </p>
      <ul className="mt-6 list-disc space-y-2 pl-6 text-text-secondary">
        <li>Set your own rates, services and availability.</li>
        <li>Applications are reviewed — tutors are interviewed and verified before approval.</li>
        <li>Keep a professional record of every student&rsquo;s progress.</li>
      </ul>
      <p className="mt-6 text-sm text-text-secondary">
        Tutor applications open with the onboarding release. Create an account now and we will let
        you know when applications open.
      </p>
      <div className="mt-6">
        <Button asChild>
          <Link href="/sign-up">Create an account</Link>
        </Button>
      </div>
    </section>
  );
}
