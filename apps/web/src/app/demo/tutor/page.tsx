import { TutorShell } from '@/components/demo/demo-shells';
import { DemoCalendar } from '@/components/demo/demo-calendar';
import {
  Chip,
  DemoButton,
  Disc,
  Panel,
  PanelBody,
  PanelHead,
  Row,
  RowList,
  RowMain,
  RowMeta,
  Stat,
} from '@/components/demo/kit';
import { formatDeadline, formatLessonDateTime } from '@/components/requests/request-status';
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
  type DemoRequest,
} from '@/lib/demo/schedule';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Tutor workspace' };

const WEEKDAY = new Intl.DateTimeFormat('en-NZ', { timeZone: PLATFORM_TIME_ZONE, weekday: 'long' });
const CLOCK = new Intl.DateTimeFormat('en-NZ', {
  timeZone: PLATFORM_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * THE TUTOR DASHBOARD — a day, then a decision, then the week.
 *
 * Panels rather than a page of ruled lists, because a workspace is scanned and
 * a page is read. NO GRID OF EQUAL METRIC TILES: the three figures share one
 * panel and one frame, so they read as three facts about this week rather than
 * as three cards competing to be looked at first.
 *
 * `Needs you` is the strongest area on the screen and carries FOUR different
 * situations — an urgent one-off, an existing family asking for extra, a trial
 * wanting to continue, and a stranger. The variety is relationship and urgency,
 * not invented workflow: every one of them is a lesson request, which is the
 * only thing the product actually does here.
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

  const remaining = today.filter((lesson) => lesson.status === 'scheduled');
  const dayName = WEEKDAY.format(now);
  const headline =
    today.length === 0
      ? `${dayName}. Nothing booked.`
      : `${dayName}. ${today.length === 1 ? 'One lesson.' : `${String(today.length)} lessons.`}`;
  const urgent = requests.filter((request) => request.urgent);

  return (
    <TutorShell active="/demo/tutor">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
            {week.days[0]?.label}
            {today.length > 0 && remaining.length === 0 ? ' · all done for today' : ''}
          </p>
          <h1 className="mt-1.5 font-display text-[30px] font-semibold leading-tight tracking-[-0.018em] text-text-primary text-balance">
            {headline}
          </h1>
        </div>
        <DemoButton href="/demo/tutor/requests" tone={urgent.length > 0 ? 'primary' : 'secondary'}>
          {requests.length} requests waiting
        </DemoButton>
      </header>

      {/* TIER 1 — the next lesson. */}
      {next === null ? null : (
        <div className="mt-6">
          <Panel tone="hero">
            <PanelBody className="flex flex-wrap items-center gap-x-7 gap-y-5">
              <div className="min-w-[124px]">
                <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-brand-strong">
                  {remaining.length > 0 ? 'Next up' : 'Next lesson'}
                </p>
                <p className="mt-2 text-[30px] font-semibold leading-none tabular-nums text-text-primary">
                  {CLOCK.format(next.at)}
                </p>
                <p className="mt-1.5 text-[12.5px] text-text-muted">
                  {formatLessonDateTime(next.at, PLATFORM_TIME_ZONE).split(' at ')[0]}
                </p>
              </div>

              <span aria-hidden className="hidden h-16 w-px bg-brand/20 sm:block" />

              <div className="flex min-w-[200px] flex-1 items-center gap-3.5">
                <Disc initials={next.student.initials} size="lg" />
                <div className="min-w-0">
                  <p className="font-display text-[20px] font-medium leading-tight text-text-primary">
                    {next.student.firstName}
                  </p>
                  <p className="mt-1 text-[12.5px] text-text-muted">
                    Year {next.student.schoolYear} &middot; {serviceNameFor(next.student)} &middot;{' '}
                    {next.format === 'online' ? 'Online' : 'In person'} &middot;{' '}
                    {next.durationMinutes} min
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Chip tone={next.kind === 'weekly' ? 'current' : 'neutral'}>
                      {CADENCE_LABEL[next.kind]}
                    </Chip>
                    <Chip tone="neutral">{money(next.priceMinor)}</Chip>
                  </div>
                </div>
              </div>

              <DemoButton href={`/demo/tutor/students/${next.student.slug}`} size="lg">
                Open {next.student.firstName}
              </DemoButton>
            </PanelBody>
          </Panel>
        </div>
      )}

      {/* TIER 2 — what needs a decision. */}
      <div className="mt-5">
        <Panel tone={urgent.length > 0 ? 'attention' : 'default'}>
          <PanelHead
            title="Needs you"
            meta={
              urgent.length > 0
                ? `${String(urgent.length)} needs answering soon`
                : `${String(requests.length)} awaiting a reply`
            }
            action={
              <DemoButton href="/demo/tutor/requests" tone="quiet" size="sm">
                All requests
              </DemoButton>
            }
          />
          <PanelBody className="bg-surface-card py-1">
            <RowList>
              {requests.map((request) => (
                <RequestRow key={request.reference} request={request} />
              ))}
            </RowList>
          </PanelBody>
        </Panel>
      </div>

      {/* TIER 3 — the week, and its figures inside the same frame. */}
      <div className="mt-5">
        <Panel className="min-w-0">
          <PanelHead
            title="Your week"
            meta={week.rangeLabel}
            action={
              <DemoButton href="/demo/tutor/bookings" tone="quiet" size="sm">
                Bookings
              </DemoButton>
            }
          />
          <PanelBody>
            <div className="mb-5 flex flex-wrap gap-x-9 gap-y-4">
              <Stat label="Lessons" value={String(totals.lessons)} size="lg" />
              <Stat label="Teaching hours" value={(totals.minutes / 60).toFixed(1)} size="lg" />
              <Stat
                label="Booked value"
                value={money(totals.grossMinor)}
                size="lg"
                detail="before Studdy's cut"
              />
            </div>
            <DemoCalendar
              blocks={blocks}
              dayLabels={week.dayLabels}
              todayIndex={week.todayIndex}
              size="comfortable"
              ariaLabel={`Your week, ${week.rangeLabel}`}
              legend={{ held: true, once: true }}
            />
          </PanelBody>
        </Panel>
      </div>

      {/* TIER 4 — the roster, for reference. */}
      <div className="mt-5">
        <Panel tone="quiet">
          <PanelHead
            title="Your students"
            meta={`${String(STUDENTS.length)} relationships`}
            action={
              <DemoButton href="/demo/tutor/students" tone="quiet" size="sm">
                All students
              </DemoButton>
            }
          />
          <PanelBody className="py-1">
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
                      detail={`Year ${String(student.schoolYear)} · ${serviceNameFor(student)} · ${String(student.lessonsSoFar)} lessons`}
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
          </PanelBody>
        </Panel>
      </div>
    </TutorShell>
  );
}

/**
 * One request, with its situation legible before it is read.
 *
 * Four contexts, four treatments: a clock running (clay), an existing family, a
 * trial deciding whether to continue, and a stranger. Only the deadline gets
 * colour — if all four carried a tone, none of them would mean anything.
 */
function RequestRow({ request }: { request: DemoRequest }) {
  const context = request.urgent
    ? { tone: 'attention' as const, label: `Reply by ${formatDeadline(request.respondByAt, PLATFORM_TIME_ZONE)}` }
    : request.student === null
      ? { tone: 'ghost' as const, label: 'New family' }
      : request.student.cadence === 'trial'
        ? { tone: 'current' as const, label: 'After a trial' }
        : { tone: 'current' as const, label: 'Your student' };

  return (
    <Row href={`/demo/tutor/requests/${request.slug}`} attention={request.urgent}>
      <Disc initials={request.studentInitials} size="sm" />
      <RowMain
        name={request.studentFirstName}
        detail={`Year ${String(request.schoolYear)} · ${serviceById(request.serviceId)?.name ?? 'Maths'} · ${String(request.durationMinutes)} min · ${String(request.offered.length)} ${request.offered.length === 1 ? 'time' : 'times'} offered`}
      />
      <Chip tone={context.tone}>{context.label}</Chip>
      <RowMeta>{money(request.priceMinor)}</RowMeta>
    </Row>
  );
}
