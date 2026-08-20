import Link from 'next/link';
import {
  bookableSlotsForTutors,
  listAvailabilityExceptions,
  listAvailabilityRules,
  listRequestsForTutor,
  tutorProfileForUser,
} from '@studdy/database';
import { Alert, Button, Card, EmptyState, RestrictedState } from '@studdy/design-system';
import { formatDeadline } from '@/components/requests/request-status';
import { resolveIdentity } from '@/lib/identity/resolve';

export const metadata = { title: 'Tutor workspace' };

const DEFAULT_TIME_ZONE = 'Pacific/Auckland';
const LOOKAHEAD_DAYS = 14;

/**
 * TUTOR DASHBOARD.
 *
 * Built against the tutor-workspace acceptance criterion in
 * docs/design/multi-time-availability-redesign.md §3.4, which gates the whole
 * slice on this workspace being genuinely useful rather than merely capable.
 *
 * Delivered in this checkpoint: requests needing a response, upcoming held
 * time, the availability summary, and an obvious route into managing it.
 *
 * Deliberately absent until their checkpoints land: per-request offered times,
 * accept and decline, and the accepted-and-holding state. The page says so
 * rather than showing controls that do nothing.
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
  const [rules, exceptions, slotsByTutor, requests] = await Promise.all([
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
  ]);

  const timeZone = rules[0]?.ianaTimeZone ?? DEFAULT_TIME_ZONE;
  const slots = slotsByTutor.get(profile.id) ?? [];
  const awaiting = requests.filter((request) => request.statusCode === 'sent');
  const soonestDeadline = awaiting
    .map((request) => request.respondByAt)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  // Holds exist only once a tutor has accepted (D-1), so this is the accepted
  // work sitting on the calendar while the family chooses.
  const held = requests
    .filter((request) => request.holdExpiresAt !== null && request.offeredTimes.length > 0)
    .sort(
      (a, b) =>
        (a.offeredTimes[0]?.startAt.getTime() ?? 0) - (b.offeredTimes[0]?.startAt.getTime() ?? 0),
    );

  return (
    <>
      <h1 className="font-display text-2xl font-semibold text-brand-purple-deep">
        Your tutoring at a glance
      </h1>

      {/*
        A tutor with no availability receives nothing at all. Saying so loudly
        is the difference between a workspace that looks broken and one that
        tells you what to do next.
      */}
      {rules.length === 0 ? (
        <div className="mt-4">
          <Alert tone="warning" title="Set your availability to start receiving requests">
            Families can only ask you for times you are free. Until you add your regular hours, you
            will not appear as bookable and no request can reach you.
          </Alert>
          <div className="mt-3">
            <Button asChild>
              <Link href="/tutor/availability">Set your availability</Link>
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-text-secondary">Awaiting your response</p>
          <p className="mt-1 text-2xl font-semibold">{awaiting.length}</p>
          {soonestDeadline !== undefined ? (
            <p className="mt-1 text-sm text-text-secondary">
              Soonest reply due {formatDeadline(soonestDeadline, timeZone)}
            </p>
          ) : null}
        </Card>
        <Card>
          <p className="text-sm text-text-secondary">Bookable slots, next {LOOKAHEAD_DAYS} days</p>
          <p className="mt-1 text-2xl font-semibold">{slots.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-secondary">One-off changes ahead</p>
          <p className="mt-1 text-2xl font-semibold">{exceptions.length}</p>
        </Card>
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Requests needing a response</h2>
          <Button asChild variant="secondary" size="sm">
            <Link href="/tutor/requests">View all requests</Link>
          </Button>
        </div>
        {awaiting.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="Nothing waiting on you"
              description="When a family asks you for a lesson, it appears here with the times they have in mind and how long you have to reply."
            />
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {awaiting.slice(0, 5).map((request) => (
              <li key={request.reference}>
                <Card>
                  <p className="font-semibold">
                    {request.subjectDisplayName} with {request.studentPreferredName}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Reply due {formatDeadline(request.respondByAt, request.timeZone)}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">Time currently held in your calendar</h2>
        {held.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="No time held right now"
              description="When a request is holding a slot for you, it shows here with the time it is held until."
            />
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {held.slice(0, 5).map((request) => (
              <li key={request.reference}>
                <Card>
                  <p className="font-semibold">
                    {request.subjectDisplayName} with {request.studentPreferredName}
                  </p>
                  {request.holdExpiresAt !== null ? (
                    <p className="mt-1 text-sm text-text-secondary">
                      Held until {formatDeadline(request.holdExpiresAt, request.timeZone)}
                    </p>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Your availability</h2>
          <Button asChild size="sm">
            <Link href="/tutor/availability">Manage availability</Link>
          </Button>
        </div>
        <p className="mt-1 text-text-secondary">
          {rules.length === 0
            ? 'No regular hours set yet.'
            : `${String(rules.length)} regular weekly ${rules.length === 1 ? 'block' : 'blocks'} in ${timeZone}.`}
        </p>
      </section>

      <div className="mt-10">
        <Alert tone="information" title="Responding to requests opens in the next release">
          Accepting and declining, and the times a family has offered you, arrive with the next part
          of this release. Nothing here affects a request yet.
        </Alert>
      </div>
    </>
  );
}
