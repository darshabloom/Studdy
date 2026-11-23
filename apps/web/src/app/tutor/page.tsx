import Link from 'next/link';
import {
  bookableSlotsForTutors,
  listAvailabilityRules,
  listRequestsForTutor,
  tutorProfileForUser,
  tutorSetupFacts,
} from '@studdy/database';
import { Alert, Button, Card, RestrictedState } from '@studdy/design-system';
import { tutorSetupChecklist } from '@studdy/domain/tutors';
import { formatDeadline } from '@/components/requests/request-status';
import { SetupChecklist } from '@/components/tutors/setup-checklist';
import { resolveIdentity } from '@/lib/identity/resolve';

export const metadata = { title: 'Tutor Home' };

const DEFAULT_TIME_ZONE = 'Pacific/Auckland';
const LOOKAHEAD_DAYS = 14;

/**
 * Tutor Home: approved light v3 dashboard structure, with restrained v0.6
 * decorative accents. Only live request/availability data is displayed.
 * Lesson schedules and earnings will be connected in separate scoped slices.
 */
export default async function TutorDashboardPage() {
  const identity = await resolveIdentity();
  if (identity === null || identity.studdyUserId === null) {
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
  const [rules, slotsByTutor, requests, setupFacts] = await Promise.all([
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
  ]);

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

  const greeting = identity.displayName?.split(' ')[0] ?? 'tutor';
  // Seven days from today, with real bookable slots. Slots are possible
  // appointments, not scheduled lessons; never present them as bookings.
  const localDateKey = (date: Date) =>
    new Intl.DateTimeFormat('sv-SE', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  const nextSevenDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now.getTime() + index * 24 * 60 * 60 * 1000);
    const key = localDateKey(day);
    return {
      key,
      day: new Intl.DateTimeFormat('en-NZ', { timeZone, weekday: 'short' }).format(day),
      date: new Intl.DateTimeFormat('en-NZ', { timeZone, day: 'numeric' }).format(day),
      count: slots.filter((slot) => localDateKey(slot.startAt) === key).length,
    };
  });

  return (
    <div className="relative flex flex-col gap-5 text-brand-purple-deep md:gap-6">
      {/* The accent sits behind the greeting, away from interactive content. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-4 -top-4 -z-10 h-24 w-44 rounded-bl-[90%] bg-parent-sky opacity-45 md:h-32 md:w-72"
      />
      <header className="py-2">
        <h1 className="font-display text-2xl font-bold md:text-3xl">Welcome back, {greeting}</h1>
        <p className="mt-1 text-sm text-text-secondary md:text-base">
          Here&rsquo;s what&rsquo;s happening with your tutoring.
        </p>
      </header>

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

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        <Card>
          <h2 className="font-display text-lg font-semibold">Next lesson</h2>
          <div className="mt-5 flex min-h-44 flex-col justify-between rounded-xl bg-parent-cream p-5">
            <div>
              <p className="text-lg font-semibold">Your next confirmed lesson</p>
              <p className="mt-2 max-w-md text-sm text-text-secondary">
                Your next lesson will appear here when confirmed lesson records are connected.
                Until then, you can review your current booking requests.
              </p>
            </div>
            <div className="mt-5">
              <Button asChild size="sm">
                <Link href="/tutor/requests">View booking requests</Link>
              </Button>
            </div>
          </div>
        </Card>

        <section aria-label="Tutor actions" className="flex flex-col gap-3">
          <Link
            href="/tutor/requests"
            className="flex min-h-24 items-center justify-between gap-4 rounded-xl border border-surface-border bg-surface-card px-5 py-4 transition-colors hover:bg-surface-card-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
          >
            <span>
              <span className="block text-lg font-semibold">Booking requests</span>
              <span className="mt-1 block text-sm text-text-secondary">
                {awaiting.length} awaiting your response
              </span>
              {soonestDeadline !== undefined ? (
                <span className="mt-1 block text-xs text-text-muted">
                  Next reply due {formatDeadline(soonestDeadline, timeZone)}
                </span>
              ) : null}
            </span>
            <span className="text-2xl font-semibold tabular-nums" aria-label={`${awaiting.length} awaiting booking requests`}>
              {awaiting.length} <span aria-hidden="true">→</span>
            </span>
          </Link>
          <div className="flex min-h-20 items-center justify-between gap-4 rounded-xl border border-surface-border bg-surface-card px-5 py-4">
            <span className="text-lg font-semibold">Lesson summaries</span>
            <span className="text-sm text-text-secondary">Coming soon</span>
          </div>
          <div className="flex min-h-20 items-center justify-between gap-4 rounded-xl border border-surface-border bg-surface-card px-5 py-4">
            <span className="text-lg font-semibold">Homework submissions</span>
            <span className="text-sm text-text-secondary">Coming soon</span>
          </div>
        </section>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Upcoming lessons</h2>
            <Link href="/tutor/requests" className="text-sm font-semibold text-brand-purple">
              View requests →
            </Link>
          </div>
          {held.length === 0 ? (
            <p className="mt-4 text-sm text-text-secondary">
              No booking-request times are currently on hold. Confirmed lessons will appear here
              when scheduling is connected.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-surface-border">
              {held.slice(0, 3).map((request) => (
                <li key={request.reference} className="py-3 first:pt-0">
                  <p className="font-semibold">
                    {request.subjectDisplayName} with {request.studentPreferredName}
                  </p>
                  <p className="text-sm text-text-secondary">
                    Request on hold
                    {request.holdExpiresAt !== null
                      ? ` · Held until ${formatDeadline(request.holdExpiresAt, request.timeZone)}`
                      : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-text-muted">
            Booking-request holds are shown separately from confirmed lessons.
          </p>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-semibold">Earnings</h2>
          <div className="mt-4 rounded-xl bg-parent-sky p-5">
            <p className="font-semibold">Earnings summary</p>
            <p className="mt-2 text-sm text-text-secondary">
              Earnings totals will appear here once verified payment and lesson data is connected.
              No estimated figures are displayed.
            </p>
            <div className="mt-4">
              <Button asChild size="sm" variant="secondary">
                <Link href="/tutor/payments">Getting paid</Link>
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Your week</h2>
          <Link href="/tutor/availability" className="text-sm font-semibold text-brand-purple">
            Manage availability →
          </Link>
        </div>
        <div className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-3" aria-label="Available one-hour slots for the next seven days">
          {nextSevenDays.map((day) => (
            <div
              key={day.key}
              className="min-w-0 rounded-xl border border-surface-border bg-surface-card-secondary px-1 py-3 text-center sm:p-4"
            >
              <p className="text-xs font-semibold text-text-secondary">{day.day}</p>
              <p className="mt-1 font-display text-xl font-semibold tabular-nums">{day.date}</p>
              <p className="mt-3 text-base font-semibold tabular-nums">{day.count}</p>
              <p className="text-[10px] leading-tight text-text-secondary sm:text-xs">
                {day.count === 1 ? 'slot' : 'slots'}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-text-secondary">
          Bookable one-hour slots over the next seven days, in {timeZone}. These show available
          times, not confirmed lessons. Confirmed lessons will appear once scheduling is connected.
        </p>
        {rules.length === 0 ? (
          <p className="mt-2 text-sm text-text-secondary">
            Set your regular hours to make times available to families.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
