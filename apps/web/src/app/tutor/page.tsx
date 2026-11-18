import Link from 'next/link';
import { listAvailabilityRules, tutorPayoutStatus, tutorSetupFacts } from '@studdy/database';
import { Button } from '@studdy/design-system';
import { tutorSetupChecklist } from '@studdy/domain/tutors';
import { COMPACT, Panel, Section, TextLink, lessonDay, lessonTime } from '@/components/parent/kit';
import { formatDeadline, formatMoney } from '@/components/requests/request-status';
import { SetupChecklist } from '@/components/tutors/setup-checklist';
import { LessonRow, TutorUnavailable, timeRange } from '@/components/tutor/kit';
import { calendarDayIndex, mondayOf, weekDays } from '@/lib/availability/calendar-time';
import { PLATFORM_TIME_ZONE } from '@/lib/time';
import { loadTutorWorkspace } from '@/lib/tutor/load';
import {
  earningsSummary,
  formatLabel,
  needsAction,
  splitLessons,
  weekSummary,
} from '@/lib/tutor/overview';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function clockMinutes(value: string): number {
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
}

/**
 * Tutor Home: the next lesson, what needs the tutor, what is coming up, what
 * they are earning, and the shape of their week. Each part is a short view with
 * a route into the page that owns it.
 */
export default async function TutorHomePage() {
  const workspace = await loadTutorWorkspace();
  if (workspace === null) return <TutorUnavailable />;

  const now = new Date();
  const { tutorProfileId, bookings, requests } = workspace;
  const [rules, payout, setupFacts] = await Promise.all([
    listAvailabilityRules(tutorProfileId),
    tutorPayoutStatus(tutorProfileId),
    tutorSetupFacts(tutorProfileId),
  ]);

  // Shown until the tutor is bookable, and gone the moment they are.
  const setup = setupFacts === null ? null : tutorSetupChecklist(setupFacts);
  const settingUp = setup !== null && !setup.bookable;

  const { upcoming } = splitLessons(bookings, now);
  const nextLesson = upcoming[0] ?? null;
  // While the checklist is on screen it already says what is missing; the list
  // beside it then carries only the things the checklist does not.
  const actions = needsAction({
    requests,
    bookings,
    hasAvailability: settingUp || rules.length > 0,
    canReceivePayments: settingUp || payout.canReceivePayments,
    now,
  });
  const [earnings] = earningsSummary(bookings, now);

  const days = weekDays(mondayOf(now, PLATFORM_TIME_ZONE), PLATFORM_TIME_ZONE);
  const availableMinutesByDay = [0, 0, 0, 0, 0, 0, 0];
  for (const rule of rules) {
    const index = calendarDayIndex(rule.dayOfWeek);
    availableMinutesByDay[index] =
      (availableMinutesByDay[index] ?? 0) +
      (clockMinutes(rule.localEndTime) - clockMinutes(rule.localStartTime));
  }
  const week = weekSummary({ days, bookings, requests, availableMinutesByDay });
  const today = days.find((day) => day.startAt <= now && now < day.endAt)?.date ?? null;

  return (
    <div className="flex flex-col gap-6">
      {settingUp ? <SetupChecklist checklist={setup} /> : null}

      <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel className="flex flex-col gap-3 border-l-4 border-l-parent-gold p-5">
          <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">
            Next lesson
          </p>
          {nextLesson === null ? (
            <>
              <p className="text-lg font-semibold text-text-primary">No lessons booked yet</p>
              <p className="text-sm text-text-secondary">
                A lesson appears here once a family has chosen you and paid for it.
              </p>
            </>
          ) : (
            <>
              <div>
                <p className="text-xl font-semibold text-brand-purple-deep">
                  {lessonDay(nextLesson.scheduledStartAt, nextLesson.timeZone)}
                </p>
                <p className="text-lg text-text-primary">{timeRange(nextLesson)}</p>
              </div>
              <p className="text-sm text-text-secondary">
                {nextLesson.subjectDisplayName} with {nextLesson.studentPreferredName} ·{' '}
                {formatLabel(nextLesson.lessonFormatCode)}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" className={COMPACT} asChild>
                  <Link prefetch={false} href={`/tutor/lessons/${nextLesson.reference}`}>
                    View lesson
                  </Link>
                </Button>
              </div>
            </>
          )}
        </Panel>

        <Panel className="flex flex-col gap-3 bg-surface-card-secondary p-5">
          <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">
            Needs action
          </p>
          {actions.length === 0 ? (
            <p className="text-sm text-text-secondary">Nothing is waiting on you.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {actions.slice(0, 4).map((item) => (
                <li key={item.key} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary">{item.title}</p>
                    <p className="text-sm text-text-secondary">{item.detail}</p>
                    {item.dueAt !== null ? (
                      <p className="text-sm text-status-warning">
                        Reply by {formatDeadline(item.dueAt, PLATFORM_TIME_ZONE)}
                      </p>
                    ) : null}
                  </div>
                  <Button className={COMPACT} asChild>
                    <Link prefetch={false} href={item.href}>
                      {item.actionLabel}
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {actions.length > 4 ? (
            <TextLink href="/tutor/requests">{`See all ${String(actions.length)} items`}</TextLink>
          ) : null}
        </Panel>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Section
          title="Upcoming lessons"
          action={<TextLink href="/tutor/lessons">All lessons</TextLink>}
        >
          {upcoming.length === 0 ? (
            <Panel className="px-4 py-5 text-sm text-text-secondary">No upcoming lessons.</Panel>
          ) : (
            <Panel>
              <ul className="divide-y divide-surface-border">
                {upcoming.slice(0, 4).map((booking) => (
                  <LessonRow key={booking.reference} booking={booking} now={now} />
                ))}
              </ul>
            </Panel>
          )}
        </Section>

        <Section title="Earnings" action={<TextLink href="/tutor/earnings">Details</TextLink>}>
          <Panel className="grid grid-cols-3 divide-x divide-surface-border">
            {(
              [
                ['Expected', earnings?.upcomingMinor ?? 0n],
                ['Pending', earnings?.pendingMinor ?? 0n],
                ['Paid out', earnings?.paidMinor ?? 0n],
              ] as const
            ).map(([label, amount]) => (
              <div key={label} className="px-4 py-3">
                <p className="text-xs font-medium text-text-muted">{label}</p>
                <p className="text-lg font-semibold text-text-primary tabular-nums">
                  {formatMoney(amount, earnings?.currencyCode ?? 'NZD')}
                </p>
              </div>
            ))}
          </Panel>
          <p className="text-xs text-text-muted">What you earn after Studdy&rsquo;s fee.</p>
        </Section>
      </div>

      <Section title="Your week" action={<TextLink href="/tutor/calendar">Open calendar</TextLink>}>
        <Panel className="overflow-x-auto">
          <ul className="grid min-w-[560px] grid-cols-7 divide-x divide-surface-border">
            {week.map((day, index) => (
              <li key={day.date} className="flex min-h-[112px] flex-col gap-1 p-2">
                <Link
                  prefetch={false}
                  href={`/tutor/calendar?week=${days[0]!.date}`}
                  className="flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-text-primary"
                >
                  <span>{WEEKDAYS[index]}</span>
                  <span
                    className={
                      day.date === today
                        ? 'flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-parent-gold px-1 text-parent-navy'
                        : ''
                    }
                  >
                    {Number(day.date.slice(8, 10))}
                  </span>
                </Link>
                {day.lessons.map((booking) => (
                  <Link
                    prefetch={false}
                    key={booking.reference}
                    href={`/tutor/lessons/${booking.reference}`}
                    className="truncate rounded-[4px] border border-status-success-border bg-status-success-bg px-1 py-px text-[11px] text-status-success"
                  >
                    {lessonTime(booking.scheduledStartAt, booking.timeZone)}{' '}
                    {booking.studentPreferredName}
                  </Link>
                ))}
                {day.requestCount > 0 ? (
                  <Link
                    prefetch={false}
                    href="/tutor/requests"
                    className="truncate rounded-[4px] border border-dashed border-brand-purple/50 bg-surface-card px-1 py-px text-[11px] text-text-secondary"
                  >
                    {day.requestCount} requested
                  </Link>
                ) : null}
                <span
                  className={`mt-auto truncate rounded-[4px] px-1 py-px text-[11px] ${
                    day.availableMinutes > 0 ? 'bg-parent-sky text-parent-navy' : 'text-text-muted'
                  }`}
                >
                  {day.availableMinutes > 0
                    ? `${(day.availableMinutes / 60).toFixed(day.availableMinutes % 60 === 0 ? 0 : 1)}h open`
                    : 'No hours'}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <ul className="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
          <li className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-[10px] w-[10px] rounded-[2px] border border-status-success-border bg-status-success-bg"
            />
            Booked lesson
          </li>
          <li className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-[10px] w-[10px] rounded-[2px] border border-dashed border-brand-purple/50 bg-surface-card"
            />
            Requested time
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-[10px] w-[10px] rounded-[2px] bg-parent-sky" />
            Regular hours
          </li>
        </ul>
      </Section>
    </div>
  );
}
