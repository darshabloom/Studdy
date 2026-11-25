import Link from 'next/link';
import {
  bookableSlotsForTutors,
  listAvailabilityRules,
  listConfirmedBookingsForTutorWeek,
  listRequestsForTutor,
  listUpcomingConfirmedBookingsForTutor,
  type TutorScheduledBooking,
  tutorProfileForUser,
  tutorSetupFacts,
} from '@studdy/database';
import { Alert, Button, RestrictedState } from '@studdy/design-system';
import { tutorSetupChecklist } from '@studdy/domain/tutors';
import { formatDeadline } from '@/components/requests/request-status';
import { SetupChecklist } from '@/components/tutors/setup-checklist';
import { resolveIdentity } from '@/lib/identity/resolve';
import { mondayOf, weekDays } from '@/lib/availability/calendar-time';
import { zonedDateOnly } from '@studdy/domain/availability';

export const metadata = { title: 'Tutor Home' };

const DEFAULT_TIME_ZONE = 'Pacific/Auckland';
const LOOKAHEAD_DAYS = 14;

/**
 * Tutor Home: approved light v3 dashboard structure, with restrained v0.6
 * decorative accents. Confirmed bookings, requests and availability stay distinct.
 * Earnings will be connected in a separate scoped slice.
 */
export default async function TutorDashboardPage() {
  const identity = await resolveIdentity();
  if (
    identity === null ||
    identity.studdyUserId === null ||
    !identity.databaseAvailable ||
    !identity.workspaces.includes('tutor')
  ) {
    return <RestrictedState title="Sign in to see your tutor workspace" />;
  }

  const profile = await tutorProfileForUser(identity.studdyUserId);
  if (profile === null) {
    return (
      <RestrictedState
        title="Your tutor profile is not active yet"
        description="Your workspace opens once your tutor application is approved."
      />
    );
  }

  const now = new Date();
  const [rules, slotsByTutor, requests, setupFacts, confirmed] = await Promise.all([
    listAvailabilityRules(profile.id),
    bookableSlotsForTutors({
      tutorProfileIds: [profile.id],
      from: now,
      to: new Date(now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000),
      durationMinutes: 60,
      now,
    }),
    listRequestsForTutor(profile.id),
    tutorSetupFacts(profile.id),
    listUpcomingConfirmedBookingsForTutor(profile.id, now),
  ]);

  const currentLesson = confirmed.find((booking) => booking.scheduledStartAt <= now);
  const futureLessons = confirmed.filter((booking) => booking.scheduledStartAt > now);
  const nextLesson = futureLessons[0];
  const setup = setupFacts === null ? null : tutorSetupChecklist(setupFacts);
  const timeZone = rules[0]?.ianaTimeZone ?? DEFAULT_TIME_ZONE;
  const slots = slotsByTutor.get(profile.id) ?? [];
  const awaiting = requests.filter((request) => request.statusCode === 'sent');
  const soonestDeadline = awaiting
    .map((request) => request.respondByAt)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const held = requests
    .filter((request) => request.holdExpiresAt !== null && request.offeredTimes.length > 0)
    .sort(
      (a, b) =>
        (a.offeredTimes[0]?.startAt.getTime() ?? 0) - (b.offeredTimes[0]?.startAt.getTime() ?? 0),
    );

  // Monday–Sunday calendar in the tutor's local time zone. These are real
  // bookable openings, never represented as confirmed lessons.
  const todayKey = zonedDateOnly(now, timeZone);
  const weekStart = mondayOf(now, timeZone);
  const days = weekDays(weekStart, timeZone);
  const dateLabel = new Intl.DateTimeFormat('en-NZ', {
    timeZone,
    month: 'short',
    day: 'numeric',
  });
  const timeLabel = new Intl.DateTimeFormat('en-NZ', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
  const weekLessons = await listConfirmedBookingsForTutorWeek(
    profile.id,
    days[0]!.startAt,
    days[6]!.endAt,
  );
  const calendarDays = days.map((day) => ({
    ...day,
    weekday: day.label.split(' ')[0],
    dayNumber: Number(day.date.slice(-2)),
    isToday: day.date === todayKey,
    lessons: weekLessons.filter(
      (lesson) => lesson.scheduledStartAt < day.endAt && lesson.scheduledEndAt > day.startAt,
    ),
    slots: slots
      .filter((slot) => slot.startAt >= day.startAt && slot.startAt < day.endAt)
      .sort((first, second) => first.startAt.getTime() - second.startAt.getTime()),
  }));
  const weekLabel =
    days.length === 7
      ? `${dateLabel.format(days[0]!.startAt)} – ${dateLabel.format(days[6]!.startAt)}`
      : 'This week';

  return (
    <div className="flex flex-col gap-3 text-text-primary md:gap-4">
      <h1 className="sr-only">Tutor dashboard</h1>

      {setup !== null && !setup.bookable ? <SetupChecklist checklist={setup} /> : null}

      {rules.length === 0 && (setup === null || setup.bookable) ? (
        <Alert tone="warning" title="Set your availability to start receiving requests">
          Families can only request times that you have made available.{' '}
          <Link href="/tutor/availability" className="font-semibold underline">
            Set your availability
          </Link>
          .
        </Alert>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="rounded-xl border border-surface-border bg-surface-card p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">Lessons</h2>
            <Link
              href="/tutor/requests"
              className="text-sm font-semibold text-brand-purple hover:underline"
            >
              View requests →
            </Link>
          </div>
          <div className="mt-2 rounded-lg bg-parent-cream px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Next lesson
            </p>
            {nextLesson === undefined ? (
              <p className="mt-1 font-semibold">No upcoming confirmed lessons</p>
            ) : (
              <BookingSummary booking={nextLesson} />
            )}
          </div>
          {currentLesson === undefined ? null : (
            <div className="mt-3 rounded-lg border border-surface-border px-3 py-2">
              <h3 className="text-sm font-semibold">Scheduled for now</h3>
              <BookingSummary booking={currentLesson} />
            </div>
          )}
          <div className="mt-3">
            <h3 className="text-sm font-semibold">Upcoming lessons</h3>
            {futureLessons.length <= 1 ? (
              <p className="mt-1 text-sm text-text-secondary">No further confirmed lessons.</p>
            ) : (
              <ul className="mt-1 divide-y divide-surface-border">
                {futureLessons.slice(1, 3).map((booking) => (
                  <li key={booking.reference} className="py-2">
                    <BookingSummary booking={booking} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-3">
            <h3 className="text-sm font-semibold">Upcoming request holds</h3>
            {held.length === 0 ? (
              <p className="mt-1 text-sm text-text-secondary">No upcoming request holds.</p>
            ) : (
              <ul className="mt-1 divide-y divide-surface-border">
                {held.slice(0, 2).map((request) => (
                  <li key={request.reference} className="py-2 text-sm">
                    <span className="font-semibold">{request.subjectDisplayName}</span>
                    {' with '}
                    {request.studentPreferredName}
                    <span className="block text-xs text-text-secondary">
                      Request on hold
                      {request.holdExpiresAt !== null
                        ? ` · Until ${formatDeadline(request.holdExpiresAt, request.timeZone)}`
                        : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <section aria-label="Tutor actions" className="flex flex-col gap-2">
          <Link
            href="/tutor/requests"
            className="flex min-h-20 items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface-card px-4 py-3 hover:bg-surface-card-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
          >
            <span>
              <span className="block font-semibold">Booking requests</span>
              <span className="text-xs text-text-secondary">
                {awaiting.length} awaiting your response
              </span>
              {soonestDeadline !== undefined ? (
                <span className="block text-xs text-text-muted">
                  Due {formatDeadline(soonestDeadline, timeZone)}
                </span>
              ) : null}
            </span>
            <span className="text-xl font-semibold tabular-nums">
              {awaiting.length} <span aria-hidden="true">→</span>
            </span>
          </Link>
          <div className="flex min-h-16 items-center justify-between rounded-xl border border-surface-border bg-surface-card px-4 py-3">
            <span className="font-semibold">Lesson summaries</span>
            <span className="text-xs text-text-secondary">Coming soon</span>
          </div>
          <div className="flex min-h-16 items-center justify-between rounded-xl border border-surface-border bg-surface-card px-4 py-3">
            <span className="font-semibold">Homework submissions</span>
            <span className="text-xs text-text-secondary">Coming soon</span>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-surface-border bg-surface-card p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Earnings</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Verified earnings will appear when payment reporting is connected.
            </p>
          </div>
          <Button asChild size="sm" variant="secondary">
            <Link href="/tutor/payments">Getting paid</Link>
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-surface-border bg-surface-card p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Your calendar</h2>
            <p className="text-xs text-text-secondary">
              {weekLabel} · {timeZone}
            </p>
          </div>
          <Link
            href="/tutor/calendar"
            className="text-sm font-semibold text-brand-purple hover:underline"
          >
            Open full calendar →
          </Link>
        </div>
        <div
          className="mt-2 grid grid-cols-7 overflow-hidden rounded-lg border border-surface-border"
          aria-label="Monday to Sunday calendar showing confirmed lessons and bookable times"
        >
          {calendarDays.map((day) => (
            <div key={day.date} className="min-w-0 border-r border-surface-border last:border-r-0">
              <div
                className={
                  day.isToday
                    ? 'bg-parent-gold-pale px-1 py-2 text-center'
                    : 'bg-surface-card-secondary px-1 py-2 text-center'
                }
              >
                <p className="text-xs font-semibold">{day.weekday}</p>
                <p className="font-display text-lg font-semibold tabular-nums">{day.dayNumber}</p>
              </div>
              <div className="flex min-h-24 flex-col gap-1 border-t border-surface-border p-1 sm:min-h-28 sm:p-2">
                {day.lessons.map((lesson) => (
                  <span
                    key={lesson.reference}
                    className="block min-w-0 overflow-hidden rounded-md bg-parent-gold-pale px-0.5 py-1 text-center text-[10px] font-semibold leading-tight sm:px-1 sm:text-xs"
                    title={`${timeLabel.format(lesson.scheduledStartAt)} · Confirmed`}
                    aria-label={`${timeLabel.format(lesson.scheduledStartAt)} · Confirmed lesson`}
                  >
                    <span className="block truncate">{timeLabel.format(lesson.scheduledStartAt)}</span>
                    <span className="hidden sm:block">Confirmed</span>
                  </span>
                ))}
                {day.slots.length === 0 && day.lessons.length === 0 ? (
                  <span className="py-2 text-center text-xs text-text-muted">—</span>
                ) : (
                  <>
                    {day.slots.slice(0, 3).map((slot) => (
                      <span
                        key={slot.startAt.toISOString()}
                        className="rounded-md bg-parent-sky px-1 py-1 text-center text-[10px] font-medium text-brand-purple-deep sm:text-xs"
                      >
                        {timeLabel.format(slot.startAt)}
                      </span>
                    ))}
                    {day.slots.length > 3 ? (
                      <span className="text-center text-[10px] text-text-secondary sm:text-xs">
                        +{day.slots.length - 3} more
                      </span>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-text-secondary">
          Gold shows confirmed lessons; blue shows available one-hour openings. Open the full
          calendar for your schedule.
        </p>
        {rules.length === 0 ? (
          <p className="mt-1 text-xs text-text-secondary">
            Your available times will appear once regular hours are set.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function BookingSummary({ booking }: { booking: TutorScheduledBooking }) {
  const date = new Intl.DateTimeFormat('en-NZ', {
    timeZone: booking.timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  return (
    <div className="mt-1">
      <p className="font-semibold">
        {booking.subjectDisplayName} with {booking.studentPreferredName}
      </p>
      <p className="text-sm text-text-secondary">{date.format(booking.scheduledStartAt)}</p>
      <p className="text-xs text-text-secondary">
        {booking.lessonFormatCode === 'in_person' ? 'In person' : 'Online'} · Confirmed
      </p>
    </div>
  );
}
