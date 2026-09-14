import { TutorShell } from '@/components/demo/demo-shells';
import { DemoCalendar } from '@/components/demo/demo-calendar';
import {
  Aside,
  CardsHead,
  Chip,
  DemoButton,
  Disc,
  OpenMark,
  Panel,
  PanelBody,
  PanelHead,
  Stat,
} from '@/components/demo/kit';
import { CADENCE_LABEL, money, netMoney } from '@/lib/demo/fixtures';
import {
  committedLessons,
  demoFortnight,
  demoWeek,
  heldRequests,
  serviceNameFor,
  spanLabel,
  staceyWeekBlocks,
  weekTotals,
} from '@/lib/demo/schedule';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Bookings' };

const DAY_LABEL = new Intl.DateTimeFormat('en-NZ', {
  timeZone: PLATFORM_TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const CLOCK = new Intl.DateTimeFormat('en-NZ', {
  timeZone: PLATFORM_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * WHAT STACEY HAS COMMITTED TO.
 *
 * Deliberately a different page from Availability, and the distinction is the
 * product's, not the demo's: availability is when she is WILLING to teach,
 * bookings are the hours she has SOLD. Collapsing them into one calendar is the
 * mistake that makes a tutoring product feel like a diary app — a tutor needs
 * to see the difference between "free on Thursday" and "Thursday is spoken
 * for".
 *
 * THE HELD HOUR IS NOT COUNTED. Jacob's extra session sits on the calendar in
 * clay and in its own card at the bottom, and stays out of the week's figures,
 * because a lesson nobody has paid for is not income. That is the distinction
 * the card at the foot of this page exists to make.
 */
export default function TutorBookingsPage() {
  const now = new Date();
  // A WORKING WEEK, Monday first. Stacey teaches Monday to Thursday; her one
  // Saturday is a one-off change and has its own home on Availability, where
  // it can be explained instead of stretching every week view to reach it.
  const week = demoWeek(now, { dayCount: 5 });
  const fortnight = demoFortnight(now);
  const lessons = committedLessons(fortnight, now);
  const blocks = staceyWeekBlocks(week.days, now, { includeHolds: true, includePast: true });
  const totals = weekTotals(week.days, now);
  const held = heldRequests(now);

  // Grouped by day, because a schedule is read a day at a time.
  const byDay = new Map<string, typeof lessons>();
  for (const lesson of lessons) {
    const key = DAY_LABEL.format(lesson.at);
    byDay.set(key, [...(byDay.get(key) ?? []), lesson]);
  }

  return (
    <TutorShell active="/demo/tutor/bookings">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
            {week.rangeLabel}
          </p>
          <h1 className="mt-1.5 font-display text-[30px] font-semibold leading-tight tracking-[-0.018em] text-text-primary">
            Bookings
          </h1>
          <p className="mt-1.5 max-w-[62ch] text-[13.5px] text-text-muted">
            The hours you have committed to. Availability is a separate question.
          </p>
        </div>
        <DemoButton href="/demo/tutor/availability" tone="tertiary" size="sm">
          Manage availability
        </DemoButton>
      </header>

      {/* ── The week, with its figures inside the same frame ───────────── */}
      <div className="mt-6">
        <Panel className="min-w-0">
          <PanelHead title="This week" meta={week.rangeLabel} />
          <PanelBody>
            <div className="mb-5 flex flex-wrap gap-x-9 gap-y-4">
              <Stat label="Lessons" value={String(totals.lessons)} size="lg" />
              <Stat label="Teaching hours" value={(totals.minutes / 60).toFixed(1)} size="lg" />
              <Stat
                label="You earn this week"
                value={money(totals.netMinor)}
                size="lg"
                detail={`${money(totals.grossMinor)} in lessons, less ${money(totals.feeMinor)} Studdy fee`}
              />
            </div>
            <DemoCalendar
              blocks={blocks}
              dayLabels={week.dayLabels}
              todayIndex={week.todayIndex}
              pastCount={week.pastCount}
              size="comfortable"
              ariaLabel={`Your bookings, ${week.rangeLabel}`}
              legend={{ held: true, once: true }}
            />
          </PanelBody>
        </Panel>
      </div>

      {/* ── Every booking in the fortnight, a day at a time ────────────── */}
      <section className="mt-6 sm:mt-8">
        <CardsHead title="Next two weeks" meta={`${String(lessons.length)} lessons`} />
        <div className="mt-4 flex flex-col gap-5">
          {[...byDay.entries()].map(([day, dayLessons]) => (
            <Panel key={day} tone="quiet">
              <PanelHead
                title={day}
                meta={`${String(dayLessons.length)} ${dayLessons.length === 1 ? 'lesson' : 'lessons'}`}
              />
              <PanelBody className="grid gap-4 sm:grid-cols-2">
                {dayLessons.map((lesson) => (
                  <Panel key={lesson.id} href={`/demo/tutor/students/${lesson.student.slug}`}>
                    <PanelBody className="flex flex-col gap-3 py-3.5">
                      <div className="flex items-start gap-3">
                        <span className="w-[62px] shrink-0 text-[15px] font-semibold tabular-nums text-text-primary">
                          {CLOCK.format(lesson.at)}
                        </span>
                        <Disc initials={lesson.student.initials} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-[16px] font-medium leading-tight text-text-primary">
                            {lesson.student.firstName}
                          </p>
                          <p className="mt-0.5 text-[12px] text-text-muted">
                            Year {lesson.student.schoolYear} &middot;{' '}
                            {serviceNameFor(lesson.student)}
                          </p>
                        </div>
                        <OpenMark label="" />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 border-t border-surface-border pt-2.5">
                        <Chip tone={lesson.kind === 'weekly' ? 'current' : 'neutral'}>
                          {CADENCE_LABEL[lesson.kind]}
                        </Chip>
                        <Chip tone="ghost">
                          {lesson.format === 'online' ? 'Online' : 'In person'}
                        </Chip>
                        <span className="ml-auto text-[12.5px] tabular-nums text-text-secondary">
                          {lesson.durationMinutes} min &middot;{' '}
                          <span className="font-semibold text-text-primary">
                            {netMoney(lesson.priceMinor)}
                          </span>
                        </span>
                      </div>
                    </PanelBody>
                  </Panel>
                ))}
              </PanelBody>
            </Panel>
          ))}
        </div>
      </section>

      {/* ── The hour that is spoken for but not sold ───────────────────── */}
      {held.length > 0 ? (
        <section className="mt-6 sm:mt-8">
          <CardsHead title="Held, not yet booked" meta={`${String(held.length)}`} />
          <div className="mt-4 flex flex-col gap-4">
            {held.map((request) => {
              const accepted = request.offered[0];
              return (
                <Panel
                  key={request.reference}
                  tone="attention"
                  href={`/demo/tutor/requests/${request.slug}/accepted`}
                >
                  <PanelBody className="flex flex-wrap items-center gap-x-5 gap-y-3">
                    <span
                      aria-hidden
                      className="hidden w-[3px] self-stretch rounded-full bg-status-warning sm:block"
                    />
                    <Disc initials={request.studentInitials} size="sm" />
                    <span className="min-w-[210px] flex-1">
                      <span className="block font-display text-[17px] font-medium text-text-primary">
                        {request.studentFirstName}
                      </span>
                      <span className="mt-0.5 block text-[12.5px] text-text-secondary">
                        {accepted === undefined
                          ? 'Awaiting a decision'
                          : `${spanLabel(accepted.at, accepted.durationMinutes)} · you accepted, the family has not paid`}
                      </span>
                    </span>
                    <Chip tone="attention">Awaiting payment</Chip>
                    <span className="text-right text-[13px] tabular-nums text-text-secondary">
                      <span className="block font-semibold text-text-primary">
                        {netMoney(request.priceMinor)}
                      </span>
                      if it becomes a lesson
                    </span>
                    <OpenMark label="" />
                  </PanelBody>
                </Panel>
              );
            })}
          </div>
          <div className="mt-4">
            <Aside title="A hold is not a booking">
              Time held against a request keeps the slot out of your availability, but the lesson is
              only confirmed once the family has chosen you and paid. It is deliberately kept out of
              the figures above.
            </Aside>
          </div>
        </section>
      ) : null}
    </TutorShell>
  );
}
