import Link from 'next/link';
import {
  bookableSlotsForTutors,
  listAvailabilityExceptions,
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
  const [rules, exceptions, slotsByTutor, requests, setupFacts] = await Promise.all([
    listAvailabilityRules(profile.id),
    listAvailabilityExceptions(profile.id, now),
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
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Next lesson</h2>
            <Link href="/tutor/requests" className="text-sm font-semibold text-brand-purple">
              Lesson requests →
            </Link>
          </div>
          <div className="mt-6 rounded-xl bg-parent-cream p-5">
            <p className="font-semibold">Your next confirmed lesson</p>
            <p className="mt-2 text-sm text-text-secondary">
              Confirmed lesson details will appear here when the lesson schedule is connected. You
              can manage incoming requests today.
            </p>
            <div className="mt-4">
              <Button asChild size="sm">
                <Link href="/tutor/requests">View booking requests</Link>
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Needs action</h2>
            <Link href="/tutor/requests" className="text-sm font-semibold text-brand-purple">
              View all →
            </Link>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            <Link
              href="/tutor/requests"
              className="flex items-center justify-between rounded-xl border border-surface-border bg-surface-card px-4 py-4 hover:bg-surface-card-secondary"
            >
              <span>
                <span className="block font-semibold">Booking requests</span>
                <span className="text-sm text-text-secondary">
                  {awaiting.length} awaiting your response
                </span>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
            {soonestDeadline !== undefined ? (
              <p className="text-sm text-text-secondary">
                Next response due {formatDeadline(soonestDeadline, timeZone)}
              </p>
            ) : null}
            <Link
              href="/tutor/availability"
              className="flex items-center justify-between rounded-xl border border-surface-border bg-surface-card px-4 py-4 hover:bg-surface-card-secondary"
            >
              <span>
                <span className="block font-semibold">Availability</span>
                <span className="text-sm text-text-secondary">
                  {slots.length} bookable slots in the next {LOOKAHEAD_DAYS} days
                </span>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </Card>

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
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-surface-border bg-surface-card p-4">
            <p className="text-sm text-text-secondary">Regular weekly blocks</p>
            <p className="mt-1 text-2xl font-semibold">{rules.length}</p>
          </div>
          <div className="rounded-xl border border-surface-border bg-surface-card p-4">
            <p className="text-sm text-text-secondary">Upcoming one-off changes</p>
            <p className="mt-1 text-2xl font-semibold">{exceptions.length}</p>
          </div>
          <div className="rounded-xl border border-surface-border bg-surface-card p-4">
            <p className="text-sm text-text-secondary">
              Bookable slots, next {LOOKAHEAD_DAYS} days
            </p>
            <p className="mt-1 text-2xl font-semibold">{slots.length}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-text-muted">
          Availability is shown in {timeZone}. The weekly lesson calendar will follow once confirmed
          lesson data is connected.
        </p>
      </Card>
    </div>
  );
}
