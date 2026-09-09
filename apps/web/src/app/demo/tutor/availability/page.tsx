import { TutorShell } from '@/components/demo/demo-shells';
import { DemoCalendar } from '@/components/demo/demo-calendar';
import {
  Aside,
  Chip,
  DemoButton,
  EditAffordance,
  Fact,
  Facts,
  Panel,
  PanelBody,
  PanelHead,
  Stat,
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
 *
 * Three cards, in the order she would change them: the standing pattern, the
 * week that pattern produces, and the one-off changes sitting on top of it.
 * Each carries its own edit affordance, so it reads as something she owns
 * rather than a report about her.
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
            {String(weeklyHours)} hours a week &middot; Pacific/Auckland
          </p>
          <h1 className="mt-1.5 font-display text-[30px] font-semibold leading-tight tracking-[-0.018em] text-text-primary">
            Availability
          </h1>
          <p className="mt-1.5 max-w-[62ch] text-[13.5px] text-text-muted">
            When you are willing to teach. What you have committed to lives under Bookings.
          </p>
        </div>
        <DemoButton href="/demo/tutor/bookings" tone="tertiary" size="sm">
          See bookings
        </DemoButton>
      </header>

      {/* ── The standing pattern, and the horizon it publishes into ────── */}
      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHead
            title="Your regular hours"
            meta={`${String(weeklyHours)} hours a week`}
            action={
              <EditAffordance label="Edit hours">
                <p>
                  In the product you drag on the calendar to add or trim your regular hours.
                  Existing bookings are never moved by a change to availability &mdash; they are
                  already agreed.
                </p>
              </EditAffordance>
            }
          />
          <PanelBody className="grid gap-3 sm:grid-cols-2">
            {STACEY.bands.map((band) => (
              <div
                key={band.weekday}
                className="rounded-[5px] border border-surface-border bg-surface-card-secondary px-4 py-3"
              >
                <p className="font-display text-[15.5px] font-medium text-text-primary">
                  {WEEKDAY_NAMES[band.weekday] ?? band.weekday}
                </p>
                <p className="mt-1 text-[15px] font-semibold tabular-nums text-brand-strong">
                  {clock(band.startMinutes)} &ndash; {clock(band.endMinutes)}
                </p>
                <p className="mt-1 text-[12px] text-text-muted">
                  {(band.endMinutes - band.startMinutes) / 60} hours &middot; after school
                </p>
              </div>
            ))}
          </PanelBody>
        </Panel>

        <Panel tone="quiet">
          <PanelHead title="How far ahead" />
          <PanelBody>
            <div className="flex flex-wrap gap-x-8 gap-y-4">
              <Stat
                label="Published"
                value={`${String(AVAILABILITY_WINDOW_DAYS)} days`}
                detail="rolling horizon"
              />
              <Stat
                label="One-off changes"
                value={String(exceptions.length)}
                detail="in the next week"
              />
            </div>
            <div className="mt-4 border-t border-surface-border pt-3">
              <Facts>
                <Fact label="Time zone" value="Pacific/Auckland" />
                <Fact label="Teaching days" value={`${String(STACEY.bands.length)} a week`} />
              </Facts>
            </div>
          </PanelBody>
        </Panel>
      </div>

      {/* ── What that produces, as a week ─────────────────────────────── */}
      <div className="mt-5">
        <Panel className="min-w-0">
          <PanelHead title="The next seven days" meta={week.rangeLabel} />
          <PanelBody>
            <p className="mb-4 max-w-[70ch] text-[13px] text-text-secondary">
              Your published hours, before bookings are taken out. Hours that have already passed
              today are not shown, because nothing in the past is bookable.
            </p>
            <DemoCalendar
              blocks={blocks}
              dayLabels={week.dayLabels}
              todayIndex={week.todayIndex}
              pastCount={week.pastCount}
              size="comfortable"
              ariaLabel={`Your published availability, ${week.rangeLabel}`}
              legend={{ once: true }}
            />
          </PanelBody>
        </Panel>
      </div>

      {/* ── The exceptions, which are the reason this page exists ──────── */}
      <div className="mt-5">
        <Panel>
          <PanelHead
            title="One-off changes"
            meta={`${String(exceptions.length)}`}
            action={
              <EditAffordance label="Add a change">
                <p>
                  A one-off change opens or closes a single date without touching your regular
                  hours.
                </p>
              </EditAffordance>
            }
          />
          <PanelBody>
            {exceptions.length === 0 ? (
              <Aside title="Nothing scheduled">
                A one-off change closes or opens a single date without touching your regular hours
                &mdash; a Thursday away, or a Saturday you are willing to take on before an exam.
              </Aside>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {exceptions.map((exception) => (
                  <div
                    key={exception.id}
                    className="flex flex-col gap-2 rounded-[5px] border border-dashed border-brand/40 bg-brand-tint/30 px-4 py-3.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-display text-[16px] font-medium leading-tight text-text-primary">
                        {exception.reason}
                      </p>
                      <Chip tone={exception.opens ? 'current' : 'ghost'}>
                        {exception.opens ? 'Extra hours' : 'Closed'}
                      </Chip>
                    </div>
                    <p className="text-[13px] tabular-nums text-text-secondary">
                      {formatLessonDateTime(exception.at, PLATFORM_TIME_ZONE).split(' at ')[0]}
                      {' · '}
                      {clock(
                        Math.round(
                          (exception.at.getTime() - exception.day.startAt.getTime()) / 60_000,
                        ),
                      )}{' '}
                      &ndash;{' '}
                      {clock(
                        Math.round(
                          (exception.endAt.getTime() - exception.day.startAt.getTime()) / 60_000,
                        ),
                      )}
                    </p>
                    <p className="text-[12.5px] text-text-muted">
                      Does not change your standing hours. It applies to this date only.
                    </p>
                  </div>
                ))}
              </div>
            )}
          </PanelBody>
        </Panel>
      </div>
    </TutorShell>
  );
}
