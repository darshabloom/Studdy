import { WeekCalendar } from '@studdy/design-system';
import { TutorShell } from '@/components/demo/demo-shells';
import {
  Aside,
  DemoButton,
  Fact,
  Facts,
  PageHead,
  Row,
  RowList,
  RowMain,
  RowMeta,
  SectionLine,
} from '@/components/demo/kit';
import { profileCalendarWindow } from '@/lib/availability/calendar-projection';
import { STACEY } from '@/lib/demo/fixtures';
import { demoWeek } from '@/lib/demo/schedule';
import { bandBlocks, clock } from '@/lib/demo/timeline';
import { AVAILABILITY_WINDOW_DAYS } from '@/lib/time';

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
  const week = demoWeek(now);
  const blocks = bandBlocks(STACEY.bands, week.days, now);
  const weeklyHours =
    STACEY.bands.reduce((total, band) => total + (band.endMinutes - band.startMinutes), 0) / 60;

  return (
    <TutorShell active="/demo/tutor/availability">
      <PageHead
        title="Availability"
        sub="When you are willing to teach. What you have committed to lives under Bookings."
        action={
          <DemoButton href="/demo/tutor/bookings" tone="tertiary" size="sm">
            See bookings
          </DemoButton>
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
          <WeekCalendar
            blocks={blocks}
            window={profileCalendarWindow(blocks)}
            dayLabels={week.dayLabels}
            ariaLabel={`Your published availability, ${week.rangeLabel}`}
            {...(week.todayIndex >= 0
              ? { now: { dayIndex: week.todayIndex, minutes: 9 * 60 } }
              : {})}
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
              <Fact label="One-off changes ahead" value="None" />
            </Facts>
          </div>
        </div>
        <div>
          <SectionLine title="One-off changes" />
          <div className="mt-3">
            <Aside title="Nothing scheduled">
              A one-off change closes or opens a single date without touching your regular hours —
              a Thursday away, or a Sunday you are willing to take on before an exam.
            </Aside>
          </div>
        </div>
      </section>
    </TutorShell>
  );
}
