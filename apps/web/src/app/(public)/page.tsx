import Link from 'next/link';
import { Button, Card, StatusBadge } from '@studdy/design-system';

/**
 * Homepage foundation (brief §5; doc 14 §4–§5): hero, Find a Tutor / Join as
 * a Tutor actions, trust statement, example tutor preview (clearly labelled),
 * student progress preview. Production-compatible, deliberately minimal.
 */

const EXAMPLE_TUTORS = [
  {
    name: 'Aroha',
    subjects: 'Mathematics · Years 7–10',
    format: 'Online',
    price: 'From $35 per hour',
    availability: 'Accepting new students',
    badge: 'New to Studdy',
  },
  {
    name: 'James',
    subjects: 'Mathematics and Calculus · Years 10–13',
    format: 'Online and in person',
    price: 'From $55 per hour',
    availability: 'Limited availability',
    badge: 'Identity verified',
  },
  {
    name: 'Mei',
    subjects: 'English · Years 7–12',
    format: 'Online',
    price: 'From $40 per hour',
    availability: 'Available this week',
    badge: 'Studdy interviewed',
  },
] as const;

const TRUST_POINTS = [
  'Tutors are interviewed and approved before joining Studdy.',
  'Identity and claimed qualifications are verified where applicable.',
  'Pricing is visible before you request a lesson.',
  'Progress, homework and lesson summaries stay organised in one place.',
] as const;

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center md:py-24">
        <h1 className="font-display mx-auto max-w-3xl text-4xl font-semibold text-brand-purple-deep md:text-6xl">
          Find the right tutor. Understand every step of their progress.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-text-secondary">
          Studdy helps families find trusted tutors and gives tutors, parents and students a clearer
          view of lessons, homework and learning progress.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/tutors">Find a Tutor</Link>
          </Button>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/for-tutors">Join as a Tutor</Link>
          </Button>
        </div>
      </section>

      {/* Trust statement */}
      <section
        aria-labelledby="trust-heading"
        className="border-y border-surface-border bg-surface-card"
      >
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 id="trust-heading" className="text-2xl font-semibold">
            Why families can trust Studdy
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {TRUST_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3 text-text-secondary">
                <span aria-hidden="true" className="mt-1 text-brand-green">
                  ✓
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Example tutor preview — clearly labelled, never presented as real */}
      <section aria-labelledby="tutors-heading" className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="tutors-heading" className="text-2xl font-semibold">
            Meet the kind of tutors you will find
          </h2>
          <p className="text-sm font-medium text-text-muted">
            Example profiles for illustration — not real tutors.
          </p>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {EXAMPLE_TUTORS.map((tutor) => (
            <Card key={tutor.name}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-lg font-semibold">{tutor.name}</p>
                <StatusBadge family="pending">Example profile</StatusBadge>
              </div>
              <p className="mt-2 text-sm text-text-secondary">{tutor.subjects}</p>
              <p className="text-sm text-text-secondary">{tutor.format}</p>
              <p className="mt-3 text-sm font-medium">{tutor.price}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge family="active">{tutor.availability}</StatusBadge>
                <StatusBadge family="complete">{tutor.badge}</StatusBadge>
              </div>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-sm text-text-secondary">
          Tutoring from $30 per hour. Tutors set their own rates.
        </p>
      </section>

      {/* Student progress preview */}
      <section
        aria-labelledby="progress-heading"
        className="border-t border-surface-border bg-brand-green-pale/40"
      >
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 id="progress-heading" className="text-2xl font-semibold">
            See progress, not just bookings
          </h2>
          <p className="mt-2 max-w-2xl text-text-secondary">
            Every lesson adds to a continuous learning record — lesson summaries, homework and goals
            that parents, students and tutors can all follow.
          </p>
          <Card tone="progress" className="mt-6 max-w-xl">
            <p className="text-sm font-semibold text-brand-green-deep">
              Example progress snapshot — illustrative data
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt>Algebra — solving linear equations</dt>
                <dd>
                  <StatusBadge family="complete">Secure</StatusBadge>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Fractions and ratios</dt>
                <dd>
                  <StatusBadge family="active">Developing</StatusBadge>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Word problems</dt>
                <dd>
                  <StatusBadge family="awaiting_action">Homework due Friday</StatusBadge>
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </section>

      {/* Final call to action */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h2 className="font-display text-3xl font-semibold text-brand-purple-deep">
          Ready to get started?
        </h2>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/tutors">Find the right tutor</Link>
          </Button>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/for-tutors">Join the tutor network</Link>
          </Button>
        </div>
        <p className="mt-4 text-sm text-text-secondary">
          Join for free. Studdy earns when tutors earn.
        </p>
      </section>
    </>
  );
}
