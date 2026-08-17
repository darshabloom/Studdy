import {
  bookableSlotsForTutors,
  listAvailabilityExceptions,
  listAvailabilityRules,
  tutorProfileForUser,
} from '@studdy/database';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  RestrictedState,
  StatusBadge,
} from '@studdy/design-system';
import { WEEKDAY_LABELS } from '@studdy/domain/availability';
import { resolveIdentity } from '@/lib/identity/resolve';
import {
  removeAvailabilityRuleAction,
  removeBlockedPeriodAction,
} from '@/lib/availability/actions';
import { AddAvailabilityRuleForm, AddBlockedPeriodForm } from './availability-forms';

export const metadata = { title: 'Your availability' };

const DEFAULT_TIME_ZONE = 'Pacific/Auckland';
const PREVIEW_DAYS = 14;

function formatTimeRange(start: string, end: string): string {
  return `${start.slice(0, 5)} – ${end.slice(0, 5)}`;
}

function formatDateTime(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-NZ', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value);
}

/**
 * TUTOR AVAILABILITY MANAGEMENT.
 *
 * This is the tutor's own workspace, so it shows everything: the recurring
 * rules, the one-off changes, and the private notes attached to blocked time.
 * None of it leaves this page — families receive only derived bookable slots
 * through `bookableSlotsForTutors`, which never loads a reason in the first
 * place.
 *
 * The preview at the bottom deliberately runs the SAME calculation families
 * will, so a tutor can see what they are actually offering rather than having
 * to infer it from rules.
 */
export default async function TutorAvailabilityPage() {
  const identity = await resolveIdentity();
  if (identity === null || identity.studdyUserId === null) {
    return <RestrictedState title="Sign in to manage your availability" />;
  }

  const profile = await tutorProfileForUser(identity.studdyUserId);
  if (profile === null) {
    return (
      <RestrictedState
        title="Your tutor profile is not active yet"
        description="Availability opens once your tutor application is approved."
      />
    );
  }

  const now = new Date();
  const [rules, exceptions, slotsByTutor] = await Promise.all([
    listAvailabilityRules(profile.id),
    listAvailabilityExceptions(profile.id, now),
    bookableSlotsForTutors({
      tutorProfileIds: [profile.id],
      from: now,
      to: new Date(now.getTime() + PREVIEW_DAYS * 24 * 60 * 60 * 1000),
      durationMinutes: 60,
      now,
    }),
  ]);

  const timeZone = rules[0]?.ianaTimeZone ?? DEFAULT_TIME_ZONE;
  const slots = slotsByTutor.get(profile.id) ?? [];
  const weeklyHours = rules.reduce((total, rule) => {
    const start =
      Number(rule.localStartTime.slice(0, 2)) * 60 + Number(rule.localStartTime.slice(3, 5));
    const end = Number(rule.localEndTime.slice(0, 2)) * 60 + Number(rule.localEndTime.slice(3, 5));
    return total + (end - start) / 60;
  }, 0);

  return (
    <>
      <h1 className="font-display text-2xl font-semibold text-brand-purple-deep">
        Your availability
      </h1>
      <p className="mt-2 text-text-secondary">
        Families can only ask you for times you are free. Set your regular hours here, then block
        out anything one-off.
      </p>

      {rules.length === 0 ? (
        <div className="mt-4">
          <Alert tone="warning" title="Families cannot request you yet">
            You have no availability set, so you will not appear as bookable and no family can send
            you a lesson request. Adding your regular hours below is all it takes.
          </Alert>
        </div>
      ) : null}

      {/* Summary — item 7 of the tutor-workspace acceptance criterion. */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-text-secondary">Regular hours each week</p>
          <p className="mt-1 text-2xl font-semibold">{weeklyHours.toFixed(1)}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-secondary">Bookable hours, next {PREVIEW_DAYS} days</p>
          <p className="mt-1 text-2xl font-semibold">{slots.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-secondary">One-off changes ahead</p>
          <p className="mt-1 text-2xl font-semibold">{exceptions.length}</p>
        </Card>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">Your regular weekly hours</h2>
        {rules.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="No regular hours yet"
              description="Add the times you normally teach. They repeat every week until you change them."
            />
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {rules.map((rule) => (
              <li key={rule.id}>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{WEEKDAY_LABELS[rule.dayOfWeek] ?? 'Day'}</p>
                      <p className="text-sm text-text-secondary">
                        {formatTimeRange(rule.localStartTime, rule.localEndTime)} ·{' '}
                        {rule.ianaTimeZone}
                      </p>
                    </div>
                    <form action={removeAvailabilityRuleAction}>
                      <input type="hidden" name="ruleId" value={rule.id} />
                      <Button type="submit" variant="secondary" size="sm">
                        Remove
                      </Button>
                    </form>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}

        <Card className="mt-4">
          <h3 className="font-semibold">Add regular hours</h3>
          <div className="mt-4">
            <AddAvailabilityRuleForm timeZone={timeZone} />
          </div>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">One-off changes</h2>
        <p className="mt-1 text-text-secondary">
          Holidays, appointments, or extra hours you can offer just once.
        </p>

        {exceptions.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="Nothing one-off coming up"
              description="Block time when you are away, or add extra hours for a single week."
            />
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {exceptions.map((exception) => (
              <li key={exception.id}>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <StatusBadge family={exception.effectCode === 'adds' ? 'active' : 'paused'}>
                          {exception.effectCode === 'adds' ? 'Extra time' : 'Blocked'}
                        </StatusBadge>
                      </div>
                      <p className="mt-1 text-sm text-text-secondary">
                        {formatDateTime(exception.startsAt, timeZone)} –{' '}
                        {formatDateTime(exception.endsAt, timeZone)}
                      </p>
                      {/* Private, and only ever rendered here. */}
                      {exception.privateNote !== null ? (
                        <p className="mt-1 text-sm text-text-muted">
                          Private note: {exception.privateNote}
                        </p>
                      ) : null}
                    </div>
                    <form action={removeBlockedPeriodAction}>
                      <input type="hidden" name="exceptionId" value={exception.id} />
                      <Button type="submit" variant="secondary" size="sm">
                        Remove
                      </Button>
                    </form>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}

        <Card className="mt-4">
          <h3 className="font-semibold">Block time or add extra hours</h3>
          <div className="mt-4">
            <AddBlockedPeriodForm timeZone={timeZone} />
          </div>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">What families can book</h2>
        <p className="mt-1 text-text-secondary">
          The next {PREVIEW_DAYS} days, worked out exactly the way a family sees it — your hours,
          minus anything blocked, minus time already held or booked.
        </p>
        {slots.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="No bookable time in the next two weeks"
              description="Add regular hours, or check whether a blocked period is covering them."
            />
          </div>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {slots.slice(0, 24).map((slot) => (
              <li
                key={slot.startAt.toISOString()}
                className="rounded-[var(--radius-medium)] border border-border-default bg-surface-raised px-3 py-2 text-sm"
              >
                {formatDateTime(slot.startAt, timeZone)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
