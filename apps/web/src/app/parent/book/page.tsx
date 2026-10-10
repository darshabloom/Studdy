import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@studdy/design-system';
import { PageHeader, Panel, Section, TextLink } from '@/components/parent/kit';
import { loadFamilyOverview } from '@/lib/parent/load';
import { tutorRelationships } from '@/lib/parent/overview';

export const metadata = { title: 'Book a lesson' };

/**
 * Where booking starts: a tutor you already have, or a new one.
 *
 * Both lead into the same request journey. Nothing is booked by it — the tutor
 * is asked, accepts or declines, and the lesson is confirmed only once it has
 * been paid for — so this page says "request" wherever a promise would be made.
 */
export default async function BookALessonPage() {
  const overview = await loadFamilyOverview();
  if (overview === null) redirect('/sign-in?next=%2Fparent%2Fbook');

  const tutors = tutorRelationships(overview.bookings, new Date());

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Book a lesson"
        description="You send a request with times that suit you. The tutor accepts one or declines, and you pay only after choosing a tutor who has accepted."
      />

      <Section title="With a tutor you already have">
        {tutors.length === 0 ? (
          <Panel className="px-4 py-5 text-sm text-text-secondary">
            You have no tutors yet. Once a lesson is booked, that tutor is listed here for next
            time.
          </Panel>
        ) : (
          <Panel>
            <ul className="divide-y divide-surface-border">
              {tutors.map((tutor) => (
                <li
                  key={tutor.tutorReference}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-text-primary">{tutor.tutorFirstName}</p>
                    <p className="text-sm text-text-secondary">
                      {tutor.teaching
                        .map(
                          (entry) =>
                            `${entry.subjectDisplayName} for ${entry.studentPreferredName}`,
                        )
                        .join(', ')}
                    </p>
                  </div>
                  <Button size="sm" asChild>
                    <Link href={`/book?tutor=${tutor.tutorReference}`}>
                      Request a lesson with {tutor.tutorFirstName}
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </Section>

      <Section title="With a new tutor">
        <Panel className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
          <p className="max-w-xl text-sm text-text-secondary">
            Browse tutors by subject and year level, see when they are free, and ask up to three at
            once.
          </p>
          <Button variant="secondary" asChild>
            <Link href="/parent/tutors?view=find">Find a tutor</Link>
          </Button>
        </Panel>
      </Section>

      <div>
        <TextLink href="/parent/bookings?view=requests">
          See requests you have already sent
        </TextLink>
      </div>
    </div>
  );
}
