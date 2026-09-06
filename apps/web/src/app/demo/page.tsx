import Link from 'next/link';
import { Button, Card } from '@studdy/design-system';
import { DEMO_FAMILY, DEMO_TUTORS } from '@/lib/demo/fixtures';
import { demoStory } from '@/lib/demo/story';

export const metadata = { title: 'Demo' };

/**
 * THE WAY IN.
 *
 * A reviewer arriving here has thirty seconds of patience and no context. So
 * the page answers, in order: what is Studdy, whose side do you want to see,
 * and how long will it take. The two cards are the only decision, and both
 * lead somewhere immediately.
 */
export default function DemoHomePage() {
  const story = demoStory();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-purple">
        Interactive demo
      </p>
      <h1 className="mt-2 font-display text-4xl font-semibold text-brand-purple-deep md:text-5xl">
        Studdy, end to end
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-text-secondary">
        Studdy is a two-sided tutoring marketplace: families ask for a lesson at times that suit
        them, tutors accept the one that fits their week, and the lesson is only booked once it is
        paid for. Follow the same lesson from either side.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <Card className="flex flex-col">
          <h2 className="font-display text-2xl font-semibold text-brand-purple-deep">
            View as Parent
          </h2>
          <p className="mt-2 text-text-secondary">
            {DEMO_FAMILY.parentName} is looking for {DEMO_FAMILY.subjectDetail} Maths help for{' '}
            {DEMO_FAMILY.studentPreferredName}. Find a tutor, offer two times, choose the one the
            tutor accepts, pay, and see the lesson confirmed.
          </p>
          <ul className="mt-4 flex-1 space-y-1.5 text-sm text-text-secondary">
            <Beat>Compare tutors by price, level and the shape of their week</Beat>
            <Beat>Offer more than one time, so a full diary is not the end of it</Beat>
            <Beat>Review, pay, and watch the request become a booking</Beat>
          </ul>
          <div className="mt-6">
            <Button size="lg" asChild>
              <Link href="/demo/parent/tutors">Start the parent journey</Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-text-muted">Nine screens · about two minutes</p>
        </Card>

        <Card className="flex flex-col">
          <h2 className="font-display text-2xl font-semibold text-brand-purple-deep">
            View as Tutor
          </h2>
          <p className="mt-2 text-text-secondary">
            The same lesson from {story.tutor.firstName}&rsquo;s side. See the request arrive,
            inspect what the family asked for, accept a time, and watch it land on the calendar as a
            confirmed lesson.
          </p>
          <ul className="mt-4 flex-1 space-y-1.5 text-sm text-text-secondary">
            <Beat>A workspace built around what needs answering today</Beat>
            <Beat>Accepting holds the time — it does not book it</Beat>
            <Beat>The confirmed lesson, on the same week calendar families see</Beat>
          </ul>
          <div className="mt-6">
            <Button size="lg" variant="secondary" asChild>
              <Link href="/demo/tutor">Start the tutor journey</Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-text-muted">Five screens · about one minute</p>
        </Card>
      </div>

      <div className="mt-10 rounded-[var(--radius-medium)] border border-surface-border bg-surface-card p-5">
        <h2 className="text-sm font-semibold text-text-primary">About this demo</h2>
        <p className="mt-2 max-w-3xl text-sm text-text-secondary">
          Every person, price and lesson here is invented for the demo. There is no database behind
          it, no payment is taken, no email is sent and nothing you click changes any real state —
          the screens are the product&rsquo;s own, driven by fixed sample data. {DEMO_TUTORS.length}{' '}
          tutors, one family, one lesson.
        </p>
      </div>
    </div>
  );
}

function Beat({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden className="text-brand-purple">
        ·
      </span>
      <span>{children}</span>
    </li>
  );
}
