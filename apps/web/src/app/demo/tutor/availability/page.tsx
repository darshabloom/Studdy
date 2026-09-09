import { TutorShell } from '@/components/demo/demo-shells';
import { DemoCalendar } from '@/components/demo/demo-calendar';
import {
  Aside,
  Chip,
  DemoButton,
  EditAffordance,
  Fact,
  Facts,
  PageHead,
  Row,
  RowList,
  RowMain,
  RowMeta,
  SectionLine,
} from '@/components/demo/kit';
import { STACEY } from '@/lib/demo/fixtures';
import { demoWeek, exceptionsIn } from '@/lib/demo/schedule';
import { formatLessonDateTime } from '@/components/requests/request-status';
import { AVAILABILITY_WINDOW_DAYS, PLATFORM_TIME_ZONE } from '@/lib/time';
import { bandBlocks, clock } from '@/lib/demo/timeline';

export const metadata = { title: 'Availability' };

const WEEKDAY_NAMES: Record<string, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
};

/**
 * WHEN STACEY IS WILLING TO TEACH — the raw rules, before anything is sold.
 *
 * This calendar shows her hours WITHOUT her bookings subtracted, which is the
 * whole reason it is a different page from Bookings. Availability is a standing
 * statement about her week; bookings are what has happened to it.
 */
export default function TutorAvailabilityPage() {
  const now = new Date();
  // Monday to Sunday here, unlike the working-week views: this is the page
  // that has to be able to show the Saturday one-off.
  const week = demoWeek(now, { dayCount: 7 });
  const blocks = [
    ...bandBlocks(STACEY.bands, week.days, now),
    // The one-off, drawn as the exception it is rather than folded into the
    // regular hours — this page exists to tell them apart.
    ...exceptionsIn(week.days, now)
      .filter((exception) => exception.opens)
      .flatMap((exception) => {
        const column = week.days.findIndex((day) => day.date === exception.day.date);
        if (column === -1) return [];
        return [
          {
            id: `exception-${exception.id}`,
            dayIndex: column,
            startMinutes: Math.round(
              (exception.at.getTime() - exception.day.startAt.getTime()) / 60_000,
            ),
            endMinutes: Math.round(
              (exception.endAt.getTime() - exception.day.startAt.getTime()) / 60_000,
            ),
            role: 'available_once' as const,
          },
        ];
      }),
  ];
  const exceptions = exceptionsIn(week.days, now);
  const weeklyHours =
    STACEY.bands.reduce((total, band) => total + (band.endMinutes - band.startMinutes), 0) / 60;

  return (
    <TutorShell active="/demo/tutor/availability">
      <PageHead
        title="Availability"
        sub="When you are willing to teach. What you have committed to lives under Bookings."
        action={
          <div className="flex flex-wrap gap-2">
            <EditAffordance label="Edit availability">
              <p>
                In the product you drag on the calendar to add or trim your regular hours. Existing
                bookings are never moved by a change to availability &mdash; they are already
                agreed.
              </p>
            </EditAffordance>
            <DemoButton href="/demo/tutor/bookings" tone="tertiary" size="sm">
              See bookings
            </DemoButton>
          </div>
        }
      />

      <section className="mt-8">
        <SectionLine title="Your regular hours" meta={`${String(weeklyHours)} hours a week`} />
        <div className="mt-1">
          <RowList>
            {STACEY.bands.map((band) => (
              <Row key={band.weekday}>
                <RowMain
                  name={WEEKDAY_NAMES[band.weekday] ?? band.weekday}
                  detail={
                    band.weekday === 'Sat'
                      ? 'Weekend mornings, mostly senior exam preparation'
                      : 'After school'
                  }
                />
                <RowMeta>
                  {clock(band.startMinutes)} &ndash; {clock(band.endMinutes)}
                  <span className="mt-0.5 block text-text-muted">
                    {(band.endMinutes - band.startMinutes) / 60} hours
                  </span>
                </RowMeta>
              </Row>
            ))}
          </RowList>
        </div>
      </section>

      <section className="mt-9">
        <SectionLine title="The next seven days" meta={week.rangeLabel} />
        <p className="mt-3 text-[13.5px] text-text-secondary">
          Your published hours, before bookings are taken out. Hours that have already passed today
          are not shown, because nothing in the past is bookable.
        </p>
        <div className="mt-4">
          <DemoCalendar
              blocks={blocks}
              dayLabels={week.dayLabels}
              todayIndex={week.todayIndex}
              pastCount={week.pastCount}
              size="comfortable"
              ariaLabel={`Your published availability, ${week.rangeLabel}`}
              legend={{ once: true }}
            />
        </div>
      </section>

      <section className="mt-9 grid gap-8 md:grid-cols-2">
        <div>
          <SectionLine title="How far ahead" />
          <div className="mt-3">
            <Facts>
              <Fact label="Published horizon" value={`${String(AVAILABILITY_WINDOW_DAYS)} days`} />
              <Fact label="Time zone" value="Pacific/Auckland" />
              <Fact label="One-off changes ahead" value={String(exceptions.length)} />
            </Facts>
          </div>
        </div>
        <div>
          <SectionLine
            title="One-off changes"
            action={
              <EditAffordance label="Add a change">
                <p>
                  A one-off change opens or closes a single date without touching your regular
                  hours.
                </p>
              </EditAffordance>
            }
          />
          <div className="mt-3">
            {exceptions.length === 0 ? (
              <Aside title="Nothing scheduled">
                A one-off change closes or opens a single date without touching your regular hours
                &mdash; a Thursday away, or a Saturday you are willing to take on before an exam.
              </Aside>
            ) : (
              <RowList>
                {exceptions.map((exception) => (
                  <Row key={exception.id}>
                    <RowMain
                      name={exception.reason}
                      detail={formatLessonDateTime(exception.at, PLATFORM_TIME_ZONE).split(' at ')[0]}
                    />
                    <Chip tone={exception.opens ? 'current' : 'ghost'}>
                      {exception.opens ? 'Extra hours' : 'Closed'}
                    </Chip>
                    <RowMeta>
                      {clock(
                        Math.round((exception.at.getTime() - exception.day.startAt.getTime()) / 60_000),
                      )}{' '}
                      &ndash;{' '}
                      {clock(
                        Math.round(
                          (exception.endAt.getTime() - exception.day.startAt.getTime()) / 60_000,
                        ),
                      )}
                    </RowMeta>
                  </Row>
                ))}
              </RowList>
            )}
          </div>
        </div>
      </section>
    </TutorShell>
  );
}
