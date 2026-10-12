import Link from 'next/link';
import {
  listAvailabilityExceptions,
  listAvailabilityRules,
  listTutorReservations,
  type TutorBookingView,
  type TutorRequestView,
} from '@studdy/database';
import { WeekCalendar, type CalendarBlock, type CalendarBlockRole } from '@studdy/design-system';
import { zonedClockTime } from '@studdy/domain/availability';
import { PageHeader, Panel, Quiet, Section, TextLink, lessonTime } from '@/components/parent/kit';
import { formatDeadline } from '@/components/requests/request-status';
import { CalendarTabs, LessonRow, TutorUnavailable } from '@/components/tutor/kit';
import { teachingWindow, tutorWeekBlocks } from '@/lib/availability/calendar-projection';
import {
  clockToMinutes,
  mondayOf,
  shiftDate,
  weekDays,
  type WeekDay,
} from '@/lib/availability/calendar-time';
import { localDateKey, monthKey, monthWeeks, parseMonth, shiftMonth } from '@/lib/parent/overview';
import { PLATFORM_TIME_ZONE } from '@/lib/time';
import { loadTutorWorkspace } from '@/lib/tutor/load';
import { isOpenTutorRequest } from '@/lib/tutor/overview';

export const metadata = { title: 'Calendar' };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const FILTERS = [
  ['all', 'Everything'],
  ['lessons', 'Lessons'],
  ['requests', 'Requests'],
  ['availability', 'Availability'],
] as const;
type Filter = (typeof FILTERS)[number][0];

const FILTER_ROLES: Record<Filter, readonly CalendarBlockRole[] | null> = {
  all: null,
  lessons: ['lesson'],
  requests: ['hold', 'candidate'],
  availability: ['available', 'available_once', 'blocked'],
};

/**
 * Times a family has asked for and the tutor has not answered yet.
 *
 * An accepted request already holds time, and the reservation behind that hold
 * is drawn by the shared week projection. An unanswered one holds nothing, so
 * it would be missing from the calendar without this — at exactly the moment
 * the tutor most needs to see where it would land.
 */
function unansweredBlocks(
  requests: readonly TutorRequestView[],
  days: readonly WeekDay[],
): readonly CalendarBlock[] {
  return requests
    .filter((request) => request.statusCode === 'sent')
    .flatMap((request) =>
      request.offeredTimes.flatMap((time) => {
        const dayIndex = days.findIndex(
          (day) => day.startAt <= time.startAt && time.startAt < day.endAt,
        );
        if (dayIndex === -1 || time.statusCode !== 'offered') return [];
        const startMinutes = clockToMinutes(zonedClockTime(time.startAt, PLATFORM_TIME_ZONE));
        return [
          {
            id: `request:${request.reference}:${time.tutorRequestTimeOptionId}`,
            dayIndex,
            startMinutes,
            endMinutes: Math.min(startMinutes + request.durationMinutes, 24 * 60),
            role: 'candidate' as const,
            label: `Request · ${request.studentPreferredName}`,
          },
        ];
      }),
    );
}

function Legend() {
  const items = [
    ['border border-status-success-border bg-status-success-bg', 'Confirmed lesson'],
    ['border border-status-warning-border bg-status-warning-bg', 'Held while a family decides'],
    ['border border-dashed border-brand-purple/50 bg-surface-card', 'Request awaiting your reply'],
    ['border border-brand-purple/30 bg-brand-lavender', 'Available'],
    ['bg-text-muted/40', 'Blocked'],
  ] as const;
  return (
    <ul className="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
      {items.map(([swatch, label]) => (
        <li key={label} className="flex items-center gap-2">
          <span aria-hidden="true" className={`h-[10px] w-[10px] rounded-[2px] ${swatch}`} />
          {label}
        </li>
      ))}
      <li>Recurring lessons are not available yet.</li>
    </ul>
  );
}

function ModeSwitch({
  mode,
  weekHref,
  monthHref,
}: {
  mode: string;
  weekHref: string;
  monthHref: string;
}) {
  const item = (label: string, href: string, active: boolean) => (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={
        active
          ? 'bg-parent-navy px-3 py-1 text-sm font-medium text-text-on-brand'
          : 'px-3 py-1 text-sm font-medium text-text-secondary hover:bg-surface-card-secondary'
      }
    >
      {label}
    </Link>
  );
  return (
    <div className="inline-flex overflow-hidden rounded-[var(--radius-gentle)] border border-surface-border">
      {item('Week', weekHref, mode === 'week')}
      {item('Month', monthHref, mode === 'month')}
    </div>
  );
}

function StepNav({
  label,
  previousHref,
  nextHref,
  todayHref,
}: {
  label: string;
  previousHref: string;
  nextHref: string;
  todayHref: string;
}) {
  const arrow = 'px-3 py-1 text-sm text-text-secondary hover:bg-surface-card-secondary';
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="inline-flex overflow-hidden rounded-[var(--radius-gentle)] border border-surface-border">
        <Link href={previousHref} aria-label="Previous" className={arrow}>
          ←
        </Link>
        <Link href={todayHref} className={`border-x border-surface-border ${arrow}`}>
          Today
        </Link>
        <Link href={nextHref} aria-label="Next" className={arrow}>
          →
        </Link>
      </div>
      <h2 className="text-base font-semibold text-text-primary">{label}</h2>
    </div>
  );
}

function RequestRow({ request }: { request: TutorRequestView }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-text-primary">
          <Link href={`/tutor/requests/${request.reference}`} className="hover:underline">
            Request: {request.subjectDisplayName} with {request.studentPreferredName}
          </Link>
        </p>
        <p className="mt-px text-sm text-text-secondary">
          {request.statusCode === 'sent'
            ? `Reply by ${formatDeadline(request.respondByAt, request.timeZone)}`
            : 'You accepted; the family is deciding'}
        </p>
      </div>
      <TextLink href={`/tutor/requests/${request.reference}`}>
        {request.statusCode === 'sent' ? 'Respond' : 'Open'}
      </TextLink>
    </li>
  );
}

function MonthGrid({
  year,
  month,
  bookings,
  requests,
  todayKey,
  filter,
}: {
  year: number;
  month: number;
  bookings: readonly TutorBookingView[];
  requests: readonly TutorRequestView[];
  todayKey: string;
  filter: Filter;
}) {
  const lessonsByDay = new Map<string, TutorBookingView[]>();
  if (filter === 'all' || filter === 'lessons') {
    for (const booking of bookings) {
      if (booking.statusCode === 'cancelled') continue;
      const key = localDateKey(booking.scheduledStartAt, booking.timeZone);
      lessonsByDay.set(key, [...(lessonsByDay.get(key) ?? []), booking]);
    }
  }
  const requestsByDay = new Map<string, number>();
  if (filter === 'all' || filter === 'requests') {
    for (const request of requests.filter(isOpenTutorRequest)) {
      for (const time of request.offeredTimes) {
        if (time.statusCode !== 'offered' && time.statusCode !== 'claimed') continue;
        const key = localDateKey(time.startAt, request.timeZone);
        requestsByDay.set(key, (requestsByDay.get(key) ?? 0) + 1);
      }
    }
  }

  return (
    <Panel className="overflow-x-auto">
      <div className="min-w-[640px]">
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
                className="min-h-[88px] border-r border-surface-border p-2 last:border-r-0"
              >
                {day.dateKey === null ? null : (
                  <>
                    <Link
                      href={`/tutor/calendar?week=${mondayOf(new Date(`${day.dateKey}T12:00:00Z`), 'UTC')}`}
                      className={
                        day.dateKey === todayKey
                          ? 'flex h-[24px] w-[24px] items-center justify-center rounded-full bg-parent-gold text-sm font-semibold text-parent-navy'
                          : 'text-sm text-text-secondary hover:text-text-primary'
                      }
                    >
                      {day.dayOfMonth}
                    </Link>
                    <ul className="mt-1 flex flex-col gap-1">
                      {(lessonsByDay.get(day.dateKey) ?? []).map((booking) => (
                        <li key={booking.reference}>
                          <Link
                            href={`/tutor/lessons/${booking.reference}`}
                            className="block truncate rounded-[4px] border border-status-success-border bg-status-success-bg px-1 py-px text-[11px] text-status-success"
                          >
                            {lessonTime(booking.scheduledStartAt, booking.timeZone)}{' '}
                            {booking.studentPreferredName}
                          </Link>
                        </li>
                      ))}
                      {(requestsByDay.get(day.dateKey) ?? 0) > 0 ? (
                        <li>
                          <Link
                            href="/tutor/requests"
                            className="block truncate rounded-[4px] border border-dashed border-brand-purple/50 bg-surface-card px-1 py-px text-[11px] text-text-secondary"
                          >
                            {requestsByDay.get(day.dateKey)} requested
                          </Link>
                        </li>
                      ) : null}
                    </ul>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </Panel>
  );
}

export default async function TutorCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    mode?: string;
    week?: string;
    month?: string;
    show?: string;
  }>;
}) {
  const params = await searchParams;
  const workspace = await loadTutorWorkspace();
  if (workspace === null) return <TutorUnavailable />;

  const { tutorProfileId, bookings, requests } = workspace;
  const now = new Date();
  const openRequests = requests.filter(isOpenTutorRequest);

  if (params.view === 'recurring') {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Calendar" />
        <CalendarTabs current="recurring" openRequests={openRequests.length} />
        <Quiet>
          Recurring lessons are not available yet: each lesson is requested and booked on its own.
          Your regular weekly hours are recurring already, and are set under{' '}
          <TextLink href="/tutor/availability">Availability</TextLink>.
        </Quiet>
      </div>
    );
  }

  const mode = params.mode === 'month' ? 'month' : 'week';
  const filter: Filter = FILTERS.find(([key]) => key === params.show)?.[0] ?? 'all';
  const showQuery = filter === 'all' ? '' : `&show=${filter}`;
  const todayKey = localDateKey(now, PLATFORM_TIME_ZONE);
  const currentWeek = mondayOf(now, PLATFORM_TIME_ZONE);
  const weekStart =
    params.week !== undefined && DATE_PATTERN.test(params.week) ? params.week : currentWeek;
  const shownMonth = parseMonth(params.month) ?? {
    year: Number(todayKey.slice(0, 4)),
    month: Number(todayKey.slice(5, 7)),
  };

  const filterLinks = (
    <nav aria-label="Show" className="flex flex-wrap items-center gap-1 text-sm">
      {FILTERS.map(([key, label]) => {
        const base =
          mode === 'month'
            ? `/tutor/calendar?mode=month&month=${monthKey(shownMonth.year, shownMonth.month)}`
            : `/tutor/calendar?week=${weekStart}`;
        return (
          <Link
            key={key}
            href={key === 'all' ? base : `${base}&show=${key}`}
            aria-current={filter === key ? 'true' : undefined}
            className={
              filter === key
                ? 'rounded-[var(--radius-pill)] bg-parent-sky px-3 py-1 font-medium text-parent-navy'
                : 'rounded-[var(--radius-pill)] px-3 py-1 text-text-secondary hover:bg-surface-card-secondary'
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const header = (
    <>
      <PageHeader title="Calendar" />
      <CalendarTabs current="calendar" openRequests={openRequests.length} />
    </>
  );

  if (mode === 'month') {
    const previous = shiftMonth(shownMonth.year, shownMonth.month, -1);
    const following = shiftMonth(shownMonth.year, shownMonth.month, 1);
    const label = new Intl.DateTimeFormat('en-NZ', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(shownMonth.year, shownMonth.month - 1, 1)));
    return (
      <div className="flex flex-col gap-5">
        {header}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StepNav
            label={label}
            previousHref={`/tutor/calendar?mode=month&month=${monthKey(previous.year, previous.month)}${showQuery}`}
            nextHref={`/tutor/calendar?mode=month&month=${monthKey(following.year, following.month)}${showQuery}`}
            todayHref={`/tutor/calendar?mode=month${showQuery}`}
          />
          <div className="flex flex-wrap items-center gap-3">
            {filterLinks}
            <ModeSwitch
              mode={mode}
              weekHref={`/tutor/calendar?week=${currentWeek}`}
              monthHref="/tutor/calendar?mode=month"
            />
          </div>
        </div>
        <MonthGrid
          year={shownMonth.year}
          month={shownMonth.month}
          bookings={bookings}
          requests={requests}
          todayKey={todayKey}
          filter={filter}
        />
        <Legend />
        <p className="text-sm text-text-secondary">
          Availability and blocked time are drawn in the week view. Choose a day to open its week.
        </p>
      </div>
    );
  }

  const days = weekDays(weekStart, PLATFORM_TIME_ZONE);
  const first = days[0];
  const last = days[6];
  if (first === undefined || last === undefined) return <TutorUnavailable />;

  const [rules, exceptions, reservations] = await Promise.all([
    listAvailabilityRules(tutorProfileId),
    listAvailabilityExceptions(tutorProfileId, first.startAt),
    listTutorReservations(tutorProfileId, first.startAt, last.endAt),
  ]);

  // The same projection the Availability editor draws from, so the two screens
  // can never disagree about what a week contains.
  const { blocks: ownBlocks } = tutorWeekBlocks({
    rules,
    exceptions,
    reservations,
    days,
    timeZone: PLATFORM_TIME_ZONE,
  });
  const allBlocks = [...ownBlocks, ...unansweredBlocks(requests, days)];
  const allowed = FILTER_ROLES[filter];
  const blocks =
    allowed === null ? allBlocks : allBlocks.filter((block) => allowed.includes(block.role));

  const todayIndex = days.findIndex((day) => day.startAt <= now && now < day.endAt);
  const nowMarker =
    todayIndex >= 0
      ? { dayIndex: todayIndex, minutes: clockToMinutes(zonedClockTime(now, PLATFORM_TIME_ZONE)) }
      : undefined;

  const inWeek = (at: Date): boolean => first.startAt <= at && at < last.endAt;
  const weekLessons = bookings.filter(
    (booking) => booking.statusCode !== 'cancelled' && inWeek(booking.scheduledStartAt),
  );
  const weekRequests = openRequests.filter((request) =>
    request.offeredTimes.some((time) => inWeek(time.startAt)),
  );
  const weekLabel = `${first.label} – ${last.label}`;

  return (
    <div className="flex flex-col gap-5">
      {header}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StepNav
          label={weekLabel}
          previousHref={`/tutor/calendar?week=${shiftDate(weekStart, -7)}${showQuery}`}
          nextHref={`/tutor/calendar?week=${shiftDate(weekStart, 7)}${showQuery}`}
          todayHref={`/tutor/calendar${filter === 'all' ? '' : `?show=${filter}`}`}
        />
        <div className="flex flex-wrap items-center gap-3">
          {filterLinks}
          <ModeSwitch
            mode={mode}
            weekHref={`/tutor/calendar?week=${weekStart}`}
            monthHref={`/tutor/calendar?mode=month&month=${weekStart.slice(0, 7)}`}
          />
        </div>
      </div>

      <WeekCalendar
        blocks={blocks}
        window={teachingWindow(allBlocks)}
        mode="read"
        dayLabels={days.map((day) => day.label)}
        ariaLabel={`Your calendar, week of ${weekLabel}`}
        {...(nowMarker === undefined ? {} : { now: nowMarker })}
      />
      <Legend />

      {/* The grid shows where things sit; this is where each one is opened. */}
      {filter === 'all' || filter === 'lessons' || filter === 'requests' ? (
        <Section title="This week">
          {weekLessons.length === 0 && weekRequests.length === 0 ? (
            <Quiet>No lessons or requests this week.</Quiet>
          ) : (
            <Panel>
              <ul className="divide-y divide-surface-border">
                {filter === 'requests'
                  ? null
                  : weekLessons.map((booking) => (
                      <LessonRow key={booking.reference} booking={booking} now={now} />
                    ))}
                {filter === 'lessons'
                  ? null
                  : weekRequests.map((request) => (
                      <RequestRow key={request.reference} request={request} />
                    ))}
              </ul>
            </Panel>
          )}
        </Section>
      ) : null}

      <p className="text-sm text-text-secondary">
        To change your hours or block time, use{' '}
        <TextLink href={`/tutor/availability?week=${weekStart}`}>Availability</TextLink>.
      </p>
    </div>
  );
}
