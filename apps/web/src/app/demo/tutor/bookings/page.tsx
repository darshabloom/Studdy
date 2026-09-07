import { TutorShell } from '@/components/demo/demo-shells';
import { DemoCalendar } from '@/components/demo/demo-calendar';
import {
  Aside,
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
import { CADENCE_LABEL, money } from '@/lib/demo/fixtures';
import {
  committedLessons,
  demoFortnight,
  demoWeek,
  inboxRequests,
  serviceNameFor,
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

/**
 * WHAT STACEY HAS COMMITTED TO.
 *
 * Deliberately a different page from Availability, and the distinction is the
 * product's, not the demo's: availability is when she is WILLING to teach,
 * bookings are the hours she has SOLD. Collapsing them into one calendar is the
 * mistake that makes a tutoring product feel like a diary app — a tutor needs
 * to see the difference between "free on Thursday" and "Thursday is spoken
 * for".
 */
export default function TutorBookingsPage() {
  const now = new Date();
  const week = demoWeek(now);
  const fortnight = demoFortnight(now);
  const lessons = committedLessons(fortnight, now);
  const blocks = staceyWeekBlocks(week.days, now, { includeHolds: true });
  const totals = weekTotals(week.days, now);
  const held = inboxRequests(now).filter((request) => request.urgent === false).slice(0, 1);

  // Grouped by day, because a schedule is read a day at a time.
  const byDay = new Map<string, typeof lessons>();
  for (const lesson of lessons) {
    const key = DAY_LABEL.format(lesson.at);
    byDay.set(key, [...(byDay.get(key) ?? []), lesson]);
  }

  return (
    <TutorShell active="/demo/tutor/bookings">
      <PageHead
        title="Bookings"
        sub="The hours you have committed to. Availability is a separate question."
        action={
          <DemoButton href="/demo/tutor/availability" tone="tertiary" size="sm">
            Manage availability
          </DemoButton>
        }
      />

      <section className="mt-8">
        <SectionLine title="This week" meta={week.rangeLabel} />
        <div className="mt-4">
          <DemoCalendar
              blocks={blocks}
              dayLabels={week.dayLabels}
              todayIndex={week.todayIndex}
              size="comfortable"
              ariaLabel={`Your bookings, ${week.rangeLabel}`}
              legend={{ held: true, once: true }}
            />
        </div>
        <p className="mt-3 text-[12.5px] tabular-nums text-text-muted">
          {totals.lessons} lessons &middot; {(totals.minutes / 60).toFixed(1)} hours &middot;{' '}
          {money(totals.grossMinor)}
        </p>
      </section>

      <section className="mt-10">
        <SectionLine title="Next two weeks" meta={`${lessons.length} lessons`} />
        <div className="mt-4 flex flex-col gap-7">
          {[...byDay.entries()].map(([day, dayLessons]) => (
            <div key={day}>
              <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
                {day}
              </p>
              <div className="mt-1">
                <RowList>
                  {dayLessons.map((lesson) => (
                    <Row key={lesson.id} href={`/demo/tutor/students/${lesson.student.slug}`}>
                      <span className="w-[74px] shrink-0 text-[14px] font-semibold tabular-nums text-text-primary">
                        {formatLessonDateTime(lesson.at, PLATFORM_TIME_ZONE).split(' at ')[1]}
                      </span>
                      <Disc initials={lesson.student.initials} size="sm" />
                      <RowMain
                        name={lesson.student.firstName}
                        detail={`Year ${String(lesson.student.schoolYear)} · ${serviceNameFor(lesson.student)} · ${lesson.format === 'online' ? 'Online' : 'In person'}`}
                      />
                      <Chip tone={lesson.kind === 'weekly' ? 'current' : 'neutral'}>
                        {CADENCE_LABEL[lesson.kind]}
                      </Chip>
                      <RowMeta>
                        {lesson.durationMinutes} min
                        <span className="mt-0.5 block text-text-muted">
                          {money(lesson.priceMinor)}
                        </span>
                      </RowMeta>
                    </Row>
                  ))}
                </RowList>
              </div>
            </div>
          ))}
        </div>
      </section>

      {held.length > 0 ? (
        <section className="mt-10">
          <SectionLine title="Held, not yet booked" meta={`${held.length}`} />
          <div className="mt-1">
            <RowList>
              {held.map((request) => {
                const first = request.offered[0];
                return (
                  <Row key={request.reference} href={`/demo/tutor/requests/${request.slug}`}>
                    <Disc initials={request.studentInitials} size="sm" />
                    <RowMain
                      name={request.studentFirstName}
                      detail={
                        first === undefined
                          ? 'Awaiting a decision'
                          : `${formatLessonDateTime(first.at, PLATFORM_TIME_ZONE)} · awaiting the family`
                      }
                    />
                    <Chip tone="attention">
                      Reply by {formatDeadline(request.respondByAt, PLATFORM_TIME_ZONE)}
                    </Chip>
                  </Row>
                );
              })}
            </RowList>
          </div>
          <div className="mt-5">
            <Aside title="A hold is not a booking">
              Time held against a request keeps the slot out of your availability, but the lesson is
              only confirmed once the family has chosen you and paid.
            </Aside>
          </div>
        </section>
      ) : null}
    </TutorShell>
  );
}
