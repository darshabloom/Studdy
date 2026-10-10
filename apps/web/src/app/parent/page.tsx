import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button, EmptyState } from '@studdy/design-system';
import { schoolYearLabel } from '@studdy/domain/students';
import { formatDeadline, formatMoney } from '@/components/requests/request-status';
import {
  Panel,
  Quiet,
  Section,
  TextLink,
  lessonDay,
  lessonTimeRange,
  shortDate,
} from '@/components/parent/kit';
import { loadFamilyOverview } from '@/lib/parent/load';
import { formatLabel, paymentsDue, recentUpdates, splitBookings } from '@/lib/parent/overview';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

/**
 * Parent Home: what is next, what is owed, who the tutoring is for, and what
 * has changed. Each part is a short view with a route into the page that owns
 * it — nothing here is a second copy of Bookings or Payments.
 */
export default async function ParentHomePage() {
  const overview = await loadFamilyOverview();
  if (overview === null) redirect('/sign-in?next=%2Fparent');

  const { context, requests, bookings, payments } = overview;
  const { students, subjectSections } = context;

  if (students.length === 0) {
    return (
      <EmptyState
        title="Add your first student"
        description="Tell us who the tutoring is for. You can add more students at any time."
        action={
          <Button asChild>
            <Link href="/parent/students/new">Add a student</Link>
          </Button>
        }
      />
    );
  }

  const now = new Date();
  const nextLesson = splitBookings(bookings, now).upcoming[0] ?? null;
  const due = paymentsDue(requests, now);
  const updates = recentUpdates({ requests, bookings, payments });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel className="flex flex-col gap-3 p-5">
          <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">
            Next lesson
          </p>
          {nextLesson === null ? (
            <>
              <p className="text-lg font-semibold text-text-primary">No lessons booked yet</p>
              <p className="text-sm text-text-secondary">
                A lesson appears here once a tutor has accepted your request and it has been paid
                for.
              </p>
              <div>
                <Button asChild>
                  <Link href="/parent/book">Book a lesson</Link>
                </Button>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="font-display text-2xl font-semibold text-brand-purple-deep">
                  {lessonDay(nextLesson.scheduledStartAt, nextLesson.timeZone)}
                </p>
                <p className="text-lg text-text-primary">{lessonTimeRange(nextLesson)}</p>
              </div>
              <p className="text-sm text-text-secondary">
                {nextLesson.subjectDisplayName} with {nextLesson.tutorFirstName} for{' '}
                {nextLesson.studentPreferredName} · {formatLabel(nextLesson.lessonFormatCode)}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" asChild>
                  <Link href={`/parent/bookings/${nextLesson.reference}`}>View booking</Link>
                </Button>
                <Button variant="quiet" size="sm" asChild>
                  <Link href="/parent/bookings">All bookings</Link>
                </Button>
              </div>
            </>
          )}
        </Panel>

        <Panel className="flex flex-col gap-3 p-5">
          <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">
            Payments due
          </p>
          {due.length === 0 ? (
            <>
              <p className="text-lg font-semibold text-text-primary">Nothing to pay</p>
              <p className="text-sm text-text-secondary">
                You pay only after you choose a tutor who has accepted.
              </p>
              <div>
                <TextLink href="/parent/payments">Payments</TextLink>
              </div>
            </>
          ) : (
            <ul className="flex flex-col gap-3">
              {due.map((item) => (
                <li key={item.requestReference} className="flex flex-col gap-1">
                  <p className="text-lg font-semibold text-text-primary tabular-nums">
                    {formatMoney(item.amountMinor, item.currencyCode)}
                  </p>
                  <p className="text-sm text-text-secondary">
                    {item.subjectDisplayName} with {item.tutorFirstName} for{' '}
                    {item.studentPreferredName}
                  </p>
                  <p className="text-sm text-status-warning">
                    Pay by {formatDeadline(item.dueAt, item.timeZone)}
                  </p>
                  <div>
                    <Button size="sm" asChild>
                      <Link href={`/requests/${item.requestReference}/pay`}>Pay now</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Section
        title="Your students"
        action={<TextLink href="/parent/students/new">Add a student</TextLink>}
      >
        <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
          {students.map((student) => {
            const sections = subjectSections.filter(
              (section) => section.studentProfileId === student.studentProfileId,
            );
            return (
              <li
                key={student.studentProfileId}
                className="flex w-[17rem] shrink-0 flex-col gap-3 rounded-[var(--radius-medium)] border border-surface-border bg-surface-card p-4"
              >
                <div>
                  <Link
                    href={`/parent/students/${student.reference}`}
                    className="text-base font-semibold text-text-primary hover:underline"
                  >
                    {student.preferredName}
                  </Link>
                  <p className="text-sm text-text-secondary">
                    {student.schoolYearCode === null
                      ? 'Year level not set'
                      : schoolYearLabel(student.schoolYearCode)}
                  </p>
                </div>
                <ul className="flex flex-col gap-2 border-t border-surface-border pt-3">
                  {sections.map((section) => (
                    <li
                      key={section.subjectSectionId}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="min-w-0 truncate text-text-primary">
                        {section.subjectDisplayName}
                      </span>
                      {section.shortlistCount > 0 ? (
                        <TextLink href={`/shortlist/${section.subjectSectionId}`}>
                          Review shortlist
                        </TextLink>
                      ) : (
                        <TextLink href={`/tutors?section=${section.subjectSectionId}`}>
                          Find tutors
                        </TextLink>
                      )}
                    </li>
                  ))}
                  <li>
                    <TextLink href="/parent/subjects/new">Add a subject</TextLink>
                  </li>
                </ul>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Recent updates">
        {updates.length === 0 ? (
          <Quiet>
            Nothing yet. Requests you send, bookings that are confirmed and refunds will show here.
          </Quiet>
        ) : (
          <Panel>
            <ul className="divide-y divide-surface-border">
              {updates.map((update) => (
                <li
                  key={update.key}
                  className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={update.href}
                      className="font-medium text-text-primary hover:underline"
                    >
                      {update.title}
                    </Link>
                    <p className="text-sm text-text-secondary">{update.detail}</p>
                  </div>
                  <span className="text-sm text-text-muted tabular-nums">
                    {shortDate(update.at, PLATFORM_TIME_ZONE)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </Section>
    </div>
  );
}
