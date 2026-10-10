import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@studdy/design-system';
import type { FamilyBookingView, FamilyRequestView } from '@studdy/database';
import {
  BookingRow,
  PageHeader,
  Panel,
  Quiet,
  Section,
  TextLink,
  ViewTabs,
  lessonDay,
  lessonTime,
} from '@/components/parent/kit';
import { FamilyRequestStatus, formatLessonDateTime } from '@/components/requests/request-status';
import { loadFamilyOverview } from '@/lib/parent/load';
import {
  isOpenRequest,
  localDateKey,
  monthKey,
  monthWeeks,
  parseMonth,
  shiftMonth,
  splitBookings,
} from '@/lib/parent/overview';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Bookings' };

const VIEWS = ['upcoming', 'requests', 'calendar', 'recurring', 'past'] as const;
type View = (typeof VIEWS)[number];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function RequestRow({ request }: { request: FamilyRequestView }) {
  const first = request.timeOptions[0];
  const others = request.timeOptions.length - 1;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-text-primary">
          <Link href={`/requests/${request.reference}`} className="hover:underline">
            {request.subjectDisplayName} for {request.studentPreferredName}
          </Link>
        </p>
        <p className="mt-px text-sm text-text-secondary">
          {first === undefined
            ? 'No times recorded'
            : `${formatLessonDateTime(first.startAt, request.timeZone)}${
                others > 0 ? ` and ${String(others)} other ${others === 1 ? 'time' : 'times'}` : ''
              }`}{' '}
          · Sent to {request.tutorRequests.length}{' '}
          {request.tutorRequests.length === 1 ? 'tutor' : 'tutors'}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <FamilyRequestStatus
          statusCode={request.statusCode}
          closeReasonCode={request.closeReasonCode}
        />
        {request.statusCode === 'ready_for_selection' ? (
          <Button size="sm" asChild>
            <Link href={`/requests/${request.reference}/select`}>Choose a tutor</Link>
          </Button>
        ) : request.statusCode === 'awaiting_payment' ? (
          <Button size="sm" asChild>
            <Link href={`/requests/${request.reference}/pay`}>Pay now</Link>
          </Button>
        ) : (
          <TextLink href={`/requests/${request.reference}`}>View request</TextLink>
        )}
      </div>
    </li>
  );
}

/**
 * The family's own lessons on a month.
 *
 * ONLY BOOKINGS, AND ONLY THIS FAMILY'S. A request is not drawn here, because a
 * time a tutor has not agreed to is not a lesson; and nothing of a tutor's
 * wider diary is read at all, so no other student can appear on it.
 */
function MonthCalendar({
  bookings,
  year,
  month,
  todayKey,
}: {
  bookings: readonly FamilyBookingView[];
  year: number;
  month: number;
  todayKey: string;
}) {
  const live = bookings.filter((booking) => booking.statusCode !== 'cancelled');
  const byDay = new Map<string, FamilyBookingView[]>();
  for (const booking of live) {
    const key = localDateKey(booking.scheduledStartAt, booking.timeZone);
    byDay.set(key, [...(byDay.get(key) ?? []), booking]);
  }
  const inMonth = live.filter(
    (booking) =>
      localDateKey(booking.scheduledStartAt, booking.timeZone).slice(0, 7) ===
      monthKey(year, month),
  );
  const previous = shiftMonth(year, month, -1);
  const following = shiftMonth(year, month, 1);
  const title = new Intl.DateTimeFormat('en-NZ', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        <div className="flex items-center gap-3">
          <TextLink
            href={`/parent/bookings?view=calendar&month=${monthKey(previous.year, previous.month)}`}
          >
            ← Previous
          </TextLink>
          <TextLink href="/parent/bookings?view=calendar">This month</TextLink>
          <TextLink
            href={`/parent/bookings?view=calendar&month=${monthKey(following.year, following.month)}`}
          >
            Next →
          </TextLink>
        </div>
      </div>

      {/* Wide screens: the month as a grid. */}
      <Panel className="hidden overflow-hidden md:block">
        <div className="grid grid-cols-7 border-b border-surface-border bg-surface-card-secondary text-xs font-semibold text-text-muted">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-2 py-2">
              {day}
            </div>
          ))}
        </div>
        {monthWeeks(year, month).map((week, index) => (
          <div
            key={index}
            className="grid grid-cols-7 border-b border-surface-border last:border-b-0"
          >
            {week.map((day, column) => (
              <div
                key={column}
                className="min-h-[6rem] border-r border-surface-border p-2 last:border-r-0"
              >
                {day.dateKey === null ? null : (
                  <>
                    <p
                      className={
                        day.dateKey === todayKey
                          ? 'text-sm font-semibold text-brand-purple'
                          : 'text-sm text-text-secondary'
                      }
                    >
                      {day.dayOfMonth}
                    </p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {(byDay.get(day.dateKey) ?? []).map((booking) => (
                        <li key={booking.reference}>
                          <Link
                            href={`/parent/bookings/${booking.reference}`}
                            className="block rounded-[var(--radius-gentle)] border border-brand-purple/20 bg-brand-lavender px-2 py-1 text-xs text-brand-purple-deep hover:border-brand-purple"
                          >
                            <span className="font-semibold tabular-nums">
                              {lessonTime(booking.scheduledStartAt, booking.timeZone)}
                            </span>{' '}
                            {booking.studentPreferredName} · {booking.subjectDisplayName}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </Panel>

      {/* Phones: the same lessons as a dated list. A seven-column grid at 375px
          leaves no room for a lesson's name. */}
      <div className="md:hidden">
        {inMonth.length === 0 ? (
          <Quiet>No lessons this month.</Quiet>
        ) : (
          <Panel>
            <ul className="divide-y divide-surface-border">
              {inMonth.map((booking) => (
                <li key={booking.reference} className="px-4 py-3">
                  <Link
                    href={`/parent/bookings/${booking.reference}`}
                    className="font-medium text-text-primary hover:underline"
                  >
                    {lessonDay(booking.scheduledStartAt, booking.timeZone)},{' '}
                    {lessonTime(booking.scheduledStartAt, booking.timeZone)}
                  </Link>
                  <p className="text-sm text-text-secondary">
                    {booking.subjectDisplayName} with {booking.tutorFirstName} for{' '}
                    {booking.studentPreferredName}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string }>;
}) {
  const params = await searchParams;
  const overview = await loadFamilyOverview();
  if (overview === null) redirect('/sign-in?next=%2Fparent%2Fbookings');

  const view: View = (VIEWS as readonly string[]).includes(params.view ?? '')
    ? (params.view as View)
    : 'upcoming';
  const now = new Date();
  const { upcoming, past } = splitBookings(overview.bookings, now);
  const openRequests = overview.requests.filter(isOpenRequest);
  const closedRequests = overview.requests.filter(
    (request) => !isOpenRequest(request) && request.statusCode !== 'fulfilled',
  );

  const todayKey = localDateKey(now, PLATFORM_TIME_ZONE);
  const shown = parseMonth(params.month) ?? {
    year: Number(todayKey.slice(0, 4)),
    month: Number(todayKey.slice(5, 7)),
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Bookings"
        description="Confirmed lessons, and the requests that are not bookings yet."
        action={
          <Button asChild>
            <Link href="/parent/book">Book a lesson</Link>
          </Button>
        }
      />

      <ViewTabs
        label="Booking views"
        current={view}
        tabs={[
          { key: 'upcoming', label: 'Upcoming', href: '/parent/bookings', count: upcoming.length },
          {
            key: 'requests',
            label: 'Requests',
            href: '/parent/bookings?view=requests',
            count: openRequests.length,
          },
          { key: 'calendar', label: 'Calendar', href: '/parent/bookings?view=calendar' },
          { key: 'recurring', label: 'Recurring', href: '/parent/bookings?view=recurring' },
          { key: 'past', label: 'Past', href: '/parent/bookings?view=past' },
        ]}
      />

      {view === 'upcoming' ? (
        upcoming.length === 0 ? (
          <Quiet>
            No upcoming lessons.{' '}
            {openRequests.length > 0 ? (
              <>
                You have {openRequests.length === 1 ? 'a request' : 'requests'} still open —{' '}
                <TextLink href="/parent/bookings?view=requests">see requests</TextLink>.
              </>
            ) : (
              <TextLink href="/parent/book">Book a lesson</TextLink>
            )}
          </Quiet>
        ) : (
          <Panel>
            <ul className="divide-y divide-surface-border">
              {upcoming.map((booking) => (
                <BookingRow key={booking.reference} booking={booking} now={now} />
              ))}
            </ul>
          </Panel>
        )
      ) : null}

      {view === 'requests' ? (
        <>
          <p className="text-sm text-text-secondary">
            A request is a question to a tutor, not a booking. It becomes a booking once a tutor
            accepts, you choose them, and the lesson is paid for.
          </p>
          <Section title="Open requests">
            {openRequests.length === 0 ? (
              <Quiet>No open requests.</Quiet>
            ) : (
              <Panel>
                <ul className="divide-y divide-surface-border">
                  {openRequests.map((request) => (
                    <RequestRow key={request.reference} request={request} />
                  ))}
                </ul>
              </Panel>
            )}
          </Section>
          {closedRequests.length > 0 ? (
            <Section title="Closed requests">
              <Panel>
                <ul className="divide-y divide-surface-border">
                  {closedRequests.map((request) => (
                    <RequestRow key={request.reference} request={request} />
                  ))}
                </ul>
              </Panel>
            </Section>
          ) : null}
        </>
      ) : null}

      {view === 'calendar' ? (
        <MonthCalendar
          bookings={overview.bookings}
          year={shown.year}
          month={shown.month}
          todayKey={todayKey}
        />
      ) : null}

      {view === 'recurring' ? (
        <Quiet>
          Recurring lessons are not available yet. For now each lesson is requested on its own — to
          keep a regular time with a tutor, request the next lesson from{' '}
          <TextLink href="/parent/tutors">your tutors</TextLink>.
        </Quiet>
      ) : null}

      {view === 'past' ? (
        past.length === 0 ? (
          <Quiet>No past lessons.</Quiet>
        ) : (
          <Panel>
            <ul className="divide-y divide-surface-border">
              {past.map((booking) => (
                <BookingRow key={booking.reference} booking={booking} now={now} />
              ))}
            </ul>
          </Panel>
        )
      ) : null}
    </div>
  );
}
