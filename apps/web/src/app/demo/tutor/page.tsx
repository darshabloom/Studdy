import { WeekCalendar } from '@studdy/design-system';
import { TutorShell } from '@/components/demo/demo-shells';
import {
  Chip,
  DemoButton,
  Disc,
  PageHead,
  Row,
  RowList,
  RowMain,
  RowMeta,
  SectionLine,
} from '@/components/demo/kit';
import { formatDeadline, formatLessonDateTime } from '@/components/requests/request-status';
import { profileCalendarWindow } from '@/lib/availability/calendar-projection';
import { CADENCE_LABEL, STUDENTS, money, serviceById } from '@/lib/demo/fixtures';
import {
  committedLessons,
  demoWeek,
  inboxRequests,
  lessonsToday,
  nextLesson,
  serviceNameFor,
  staceyWeekBlocks,
  weekTotals,
} from '@/lib/demo/schedule';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Tutor workspace' };

const WEEKDAY = new Intl.DateTimeFormat('en-NZ', {
  timeZone: PLATFORM_TIME_ZONE,
  weekday: 'long',
});
const CLOCK = new Intl.DateTimeFormat('en-NZ', {
  timeZone: PLATFORM_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * THE TUTOR DASHBOARD — a day, not a grid of tiles.
 *
 * Four tiers, each visibly a different weight, and NO STANDALONE METRIC CARDS.
 * "Three requests waiting" is a sentence in a section heading; the week's
 * totals are one line of text under the calendar. A row of equal-sized number
 * tiles gives every figure the same importance, which is the same as giving
 * none of them any.
 *
 * There is one dominant green action above the fold. The confirmed lessons on
 * the calendar are also forest — they are the same kind of object repeated, not
 * competing calls to action — and that is the distinction the rule is really
 * about.
 */
export default function TutorDashboardPage() {
  const now = new Date();
  const week = demoWeek(now);
  const today = lessonsToday(now);
  const next = nextLesson(now);
  const requests = inboxRequests(now);
  const blocks = staceyWeekBlocks(week.days, now, { includeHolds: true });
  const totals = weekTotals(week.days, now);
  const upcoming = committedLessons(week.days, now);

  const dayName = WEEKDAY.format(now);
  const remaining = today.filter((lesson) => lesson.status === 'scheduled');
  const headline =
    today.length === 0
      ? `${dayName}. Nothing booked.`
      : `${dayName}. ${today.length === 1 ? 'One lesson.' : `${String(today.length)} lessons.`}`;
  // "One lesson" and "one lesson, already taught" are different days, and the
  // sub-line is where that difference belongs.
  const daySub =
    today.length > 0 && remaining.length === 0
      ? `${week.days[0]?.label ?? ''} · all done for today`
      : week.days[0]?.label;

  const soonest = requests.reduce<Date | null>(
    (earliest, request) =>
      earliest === null || request.respondByAt < earliest ? request.respondByAt : earliest,
    null,
  );

  return (
    <TutorShell active="/demo/tutor">
      {/* TIER 1 — the day. The only thing on the screen at display size. */}
      <section className="border-b border-surface-border pb-7">
        <PageHead title={headline} sub={daySub} />

        {next === null ? (
          <p className="mt-6 text-[15px] text-text-secondary">
            Nothing else booked in the next fortnight.
          </p>
        ) : (
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
            <div className="min-w-[104px]">
              <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
                {remaining.length > 0 ? 'Next up' : 'Next lesson'}
              </p>
              <p className="mt-1 text-[30px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-text-primary">
                {CLOCK.format(next.at)}
              </p>
            </div>
            <Disc initials={next.student.initials} size="lg" />
            <div className="min-w-[180px] flex-1">
              <p className="font-display text-[21px] font-medium leading-tight text-text-primary">
                {next.student.firstName}
              </p>
              <p className="mt-1 text-[12.5px] text-text-muted">
                Year {next.student.schoolYear} &middot; {serviceNameFor(next.student)} &middot;{' '}
                {next.format === 'online' ? 'Online' : 'In person'} &middot;{' '}
                {next.durationMinutes} min
              </p>
            </div>
            <Chip tone={next.kind === 'weekly' ? 'current' : 'neutral'}>
              {CADENCE_LABEL[next.kind]}
            </Chip>
            <DemoButton href={`/demo/tutor/students/${next.student.slug}`} size="lg">
              Open {next.student.firstName}
            </DemoButton>
          </div>
        )}
      </section>

      {/* TIER 2 — what needs a decision. One clay row, deliberately. */}
      <section className="mt-9">
        <SectionLine
          title="Needs you"
          meta={
            soonest === null ? null : (
              <span>
                {requests.length} requests &middot; soonest reply due{' '}
                {formatDeadline(soonest, PLATFORM_TIME_ZONE)}
              </span>
            )
          }
          action={
            <DemoButton href="/demo/tutor/requests" tone="quiet" size="sm">
              All requests
            </DemoButton>
          }
        />
        <div className="mt-1">
          <RowList>
            {requests.map((request) => (
              <Row
                key={request.reference}
                href={`/demo/tutor/requests/${request.slug}`}
                attention={request.urgent}
              >
                <Disc initials={request.studentInitials} size="sm" />
                <RowMain
                  name={request.studentFirstName}
                  detail={`Year ${String(request.schoolYear)} · ${serviceById(request.serviceId)?.name ?? 'Maths'} · ${String(request.durationMinutes)} min · ${request.offered.length} times offered`}
                />
                {request.urgent ? (
                  <Chip tone="attention">
                    Reply by {formatDeadline(request.respondByAt, PLATFORM_TIME_ZONE)}
                  </Chip>
                ) : request.isExistingStudent ? (
                  <Chip tone="current">Your student</Chip>
                ) : (
                  <Chip tone="ghost">New family</Chip>
                )}
                <RowMeta>{money(request.priceMinor)}</RowMeta>
              </Row>
            ))}
          </RowList>
        </div>
      </section>

      {/* TIER 3 — the week, scanned rather than read. */}
      <section className="mt-9">
        <SectionLine
          title="Your week"
          meta={week.rangeLabel}
          action={
            <DemoButton href="/demo/tutor/bookings" tone="quiet" size="sm">
              Bookings
            </DemoButton>
          }
        />
        <div className="mt-4">
          <WeekCalendar
            blocks={blocks}
            window={profileCalendarWindow(blocks)}
            dayLabels={week.dayLabels}
            ariaLabel={`Your week, ${week.rangeLabel}`}
            {...(week.todayIndex >= 0
              ? { now: { dayIndex: week.todayIndex, minutes: 9 * 60 } }
              : {})}
          />
        </div>
        {/* The metrics, as a sentence. */}
        <p className="mt-3 text-[12.5px] tabular-nums text-text-muted">
          {totals.lessons} lessons &middot; {(totals.minutes / 60).toFixed(1)} hours &middot;{' '}
          {money(totals.grossMinor)} &middot; 1 slot held pending a decision
        </p>
      </section>

      {/* TIER 4 — the roster, for reference. */}
      <section className="mt-9">
        <SectionLine
          title="Your students"
          meta={`${STUDENTS.length}`}
          action={
            <DemoButton href="/demo/tutor/students" tone="quiet" size="sm">
              All students
            </DemoButton>
          }
        />
        <div className="mt-1">
          <RowList>
            {STUDENTS.map((student) => {
              const theirNext = upcoming.find((lesson) => lesson.student.slug === student.slug);
              return (
                <Row
                  key={student.slug}
                  href={`/demo/tutor/students/${student.slug}`}
                  muted={student.cadence === 'paused'}
                >
                  <Disc initials={student.initials} />
                  <RowMain
                    name={student.firstName}
                    detail={`Year ${String(student.schoolYear)} · ${serviceNameFor(student)}`}
                  />
                  <Chip
                    tone={
                      student.cadence === 'paused'
                        ? 'ghost'
                        : student.cadence === 'one_off'
                          ? 'neutral'
                          : 'current'
                    }
                  >
                    {CADENCE_LABEL[student.cadence]}
                  </Chip>
                  <RowMeta>
                    {student.cadence === 'paused'
                      ? 'Resumes 12 Oct'
                      : theirNext === undefined
                        ? '—'
                        : formatLessonDateTime(theirNext.at, PLATFORM_TIME_ZONE)}
                  </RowMeta>
                </Row>
              );
            })}
          </RowList>
        </div>
      </section>
    </TutorShell>
  );
}
