import { WeekCalendar } from '@studdy/design-system';
import { ParentShell } from '@/components/demo/demo-shells';
import {
  Chip,
  Confirmed,
  DemoButton,
  DemoNote,
  Disc,
  Fact,
  Facts,
  PageHead,
  SectionLine,
} from '@/components/demo/kit';
import { formatLessonDateTime } from '@/components/requests/request-status';
import { profileCalendarWindow } from '@/lib/availability/calendar-projection';
import { JACOB, STACEY, money, serviceById } from '@/lib/demo/fixtures';
import { staceyWeekBlocks } from '@/lib/demo/schedule';
import { rebookStory } from '@/lib/demo/stories';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'This lesson is booked' };

/**
 * THE END OF THE STORY, and the first screen allowed to say the lesson is
 * booked.
 *
 * In the product this state is rendered from the request's own `fulfilled`
 * status — the authoritative record that a payment succeeded — and never from
 * anything the browser observed.
 *
 * The solid forest block on the calendar is THE SAME LESSON Stacey sees on her
 * own side, computed once in `schedule.ts`. That is the point of the whole
 * demo: one lesson, two sides, and they cannot disagree.
 */
export default function RebookBookedPage() {
  const now = new Date();
  const story = rebookStory(now);
  const blocks = staceyWeekBlocks(story.week.days, now, {
    extraLesson: {
      at: story.accepted,
      durationMinutes: story.durationMinutes,
      label: JACOB.firstName,
    },
  });

  return (
    <ParentShell active="/demo/parent">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12.5px] text-text-muted">{story.reference}</p>
          <PageHead title="Booked" sub={`An extra session for ${JACOB.firstName}`} />
        </div>
        <Chip tone="committed">Confirmed</Chip>
      </div>

      <div className="mt-6">
        <Confirmed title={formatLessonDateTime(story.accepted, PLATFORM_TIME_ZONE)}>
          {STACEY.firstName} has this time reserved for {JACOB.firstName}. Your payment went through
          and nothing else is needed from you.
        </Confirmed>
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] xl:items-start">
        <section className="min-w-0">
          <SectionLine title="The lesson" />
          <div className="mt-4 flex items-center gap-3">
            <Disc initials={STACEY.initials} />
            <div>
              <p className="font-display text-[17px] font-medium text-text-primary">
                {STACEY.firstName}
              </p>
              <p className="text-[12.5px] text-text-muted">
                {serviceById(JACOB.serviceId)?.name ?? 'Maths'}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Facts>
              <Fact label="Student" value={JACOB.firstName} />
              <Fact label="Length" value={`${String(story.durationMinutes)} minutes`} />
              <Fact
                label="Format"
                value={story.request.format === 'online' ? 'Online' : 'In person'}
              />
              <Fact label="Paid" value={money(story.priceMinor)} strong />
            </Facts>
          </div>
        </section>

        <section className="min-w-0">
          <SectionLine title="Stacey&rsquo;s week" meta={story.week.rangeLabel} />
          <p className="mt-2 text-[12.5px] text-text-muted">
            Your new lesson, and {JACOB.firstName}&rsquo;s standing Tuesday, on the time they took
            out of her availability.
          </p>
          <div className="mt-4">
            <WeekCalendar
              blocks={blocks}
              window={profileCalendarWindow(blocks)}
              dayLabels={story.week.dayLabels}
              ariaLabel={`Stacey's week, ${story.week.rangeLabel}`}
              {...(story.week.todayIndex >= 0
                ? { now: { dayIndex: story.week.todayIndex, minutes: 9 * 60 } }
                : {})}
            />
          </div>
        </section>
      </div>

      <div className="mt-9">
        <DemoNote title="That is the rebooking journey">
          <p>
            Four screens, because everything except <em>when</em> was already known. A family with
            no tutor yet takes a longer road &mdash; and the difference is worth seeing.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <DemoButton href="/demo/tutor/bookings">See it as {STACEY.firstName}</DemoButton>
            <DemoButton href="/demo/parent/tutors" tone="quiet">
              Find a new tutor instead
            </DemoButton>
          </div>
        </DemoNote>
      </div>
    </ParentShell>
  );
}
