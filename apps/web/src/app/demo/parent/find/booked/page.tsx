import { ParentShell } from '@/components/demo/demo-shells';
import { DemoCalendar } from '@/components/demo/demo-calendar';
import { JourneyProgress } from '@/components/demo/demo-journey';
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
import { JACOB, STACEY, money } from '@/lib/demo/fixtures';
import { chosenTimes, discoveryStory, tutorBands } from '@/lib/demo/stories';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'This lesson is booked' };

/**
 * THE END OF THE LONGER ROAD.
 *
 * Same terminal state as the rebooking journey, reached in nine screens rather
 * than four. Both are worth having in the demo precisely because the difference
 * between them is the argument: joining costs a family a real search, and after
 * that it is four screens.
 */
export default async function FindBookedPage({
  searchParams,
}: {
  searchParams: Promise<{ time?: string | string[] }>;
}) {
  const { time } = await searchParams;
  const now = new Date();
  const story = discoveryStory(now, chosenTimes(time));
  const bands = tutorBands(story.tutor, story.week.days, now);

  // The booked hour REPLACES the availability it consumed rather than sitting on
  // top of it — drawing both would overstate the time he has free.
  const column = story.week.days.findIndex(
    (day) => story.accepted >= day.startAt && story.accepted < day.endAt,
  );
  const day = story.week.days[column];
  const startMinutes =
    day === undefined ? 0 : Math.round((story.accepted.getTime() - day.startAt.getTime()) / 60_000);
  const endMinutes = startMinutes + story.durationMinutes;

  const blocks = [
    ...bands.filter(
      (block) =>
        block.dayIndex !== column || block.endMinutes <= startMinutes || block.startMinutes >= endMinutes,
    ),
    {
      id: `lesson-${story.accepted.toISOString()}`,
      dayIndex: column,
      startMinutes,
      endMinutes,
      role: 'lesson' as const,
      label: JACOB.firstName,
    },
  ];

  return (
    <ParentShell active="/demo/parent/tutors">
      <JourneyProgress current="booked" />

      <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12.5px] text-text-muted">{story.reference}</p>
          <PageHead title="Booked" sub={`Physics for ${JACOB.firstName}`} />
        </div>
        <Chip tone="committed">Confirmed</Chip>
      </div>

      <div className="mt-6">
        <Confirmed title={formatLessonDateTime(story.accepted, PLATFORM_TIME_ZONE)}>
          {story.tutor.firstName} has this time reserved for {JACOB.firstName}. Your payment went
          through and nothing else is needed from you.
        </Confirmed>
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] xl:items-start">
        <section className="min-w-0">
          <SectionLine title="The lesson" />
          <div className="mt-4 flex items-center gap-3">
            <Disc initials={story.tutor.initials} />
            <div>
              <p className="font-display text-[17px] font-medium text-text-primary">
                {story.tutor.firstName}
              </p>
              <p className="text-[12.5px] text-text-muted">Physics</p>
            </div>
          </div>
          <div className="mt-4">
            <Facts>
              <Fact label="Student" value={JACOB.firstName} />
              <Fact label="Length" value={`${String(story.durationMinutes)} minutes`} />
              <Fact
                label="Format"
                value={story.formatCode === 'online' ? 'Online' : 'In person'}
              />
              <Fact label="Paid" value={money(story.priceMinor)} strong />
            </Facts>
          </div>
        </section>

        <section className="min-w-0">
          <SectionLine title="His week" meta={story.week.rangeLabel} />
          <p className="mt-2 text-[12.5px] text-text-muted">
            The confirmed lesson, on the time it took out of his availability.
          </p>
          <div className="mt-4">
            <DemoCalendar
              blocks={blocks}
              dayLabels={story.week.dayLabels}
              todayIndex={story.week.todayIndex}
              size="comfortable"
              ariaLabel={`${story.tutor.firstName}`}
              legend={{}}
            />
          </div>
        </section>
      </div>

      <div className="mt-9">
        <DemoNote title={`${JACOB.firstName} now has two tutors`}>
          <p>
            {STACEY.firstName} for Maths every Tuesday, {story.tutor.firstName} for Physics. Nine
            screens to find a stranger; four to book again with someone you already use.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <DemoButton href="/demo/parent">Back to your family</DemoButton>
            <DemoButton href="/demo/parent/rebook" tone="quiet">
              See the shorter journey
            </DemoButton>
          </div>
        </DemoNote>
      </div>
    </ParentShell>
  );
}
