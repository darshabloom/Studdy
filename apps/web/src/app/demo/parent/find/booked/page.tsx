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
  Panel,
  PanelBody,
  PanelHead,
  PayChip,
} from '@/components/demo/kit';
import { JACOB, STACEY, money } from '@/lib/demo/fixtures';
import { withPaid } from '@/lib/demo/schedule';
import { chosenTimes, discoveryStory, intervalLabel, tutorBands } from '@/lib/demo/stories';

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
        block.dayIndex !== column ||
        block.endMinutes <= startMinutes ||
        block.startMinutes >= endMinutes,
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

      <header className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
            {story.reference}
          </p>
          <h1 className="mt-1.5 font-display text-[30px] font-semibold leading-tight tracking-[-0.018em] text-text-primary">
            Booked
          </h1>
          <p className="mt-1.5 text-[13.5px] text-text-muted">Physics for {JACOB.firstName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="committed">Confirmed</Chip>
          <PayChip payment="paid" />
        </div>
      </header>

      <div className="mt-6">
        <Confirmed title={intervalLabel(story.accepted, story.durationMinutes)}>
          {story.tutor.firstName} has this time reserved for {JACOB.firstName}. Your payment went
          through and nothing else is needed from you.
        </Confirmed>
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Panel>
          <PanelHead title="The lesson" />
          <PanelBody>
            <div className="flex items-center gap-3">
              <Disc initials={story.tutor.initials} />
              <div className="min-w-0">
                <p className="font-display text-[17px] font-medium leading-tight text-text-primary">
                  {story.tutor.firstName}
                </p>
                <p className="mt-0.5 text-[12.5px] text-text-muted">Physics</p>
              </div>
            </div>
            <div className="mt-4">
              <Facts>
                <Fact label="Student" value={JACOB.firstName} />
                <Fact label="When" value={intervalLabel(story.accepted, story.durationMinutes)} />
                <Fact label="Length" value={`${String(story.durationMinutes)} minutes`} />
                <Fact
                  label="Format"
                  value={story.formatCode === 'online' ? 'Online' : 'In person'}
                />
                <Fact label="Paid" value={money(story.priceMinor)} strong />
              </Facts>
            </div>
          </PanelBody>
        </Panel>

        <Panel className="min-w-0">
          <PanelHead title={`${story.tutor.firstName}'s week`} meta={story.week.rangeLabel} />
          <PanelBody>
            <p className="mb-4 text-[12.5px] text-text-muted">
              The confirmed lesson, on the time it took out of his availability.
            </p>
            <DemoCalendar
              blocks={blocks}
              dayLabels={story.week.dayLabels}
              todayIndex={story.week.todayIndex}
              pastCount={story.week.pastCount}
              size="comfortable"
              ariaLabel={`${story.tutor.firstName}`}
              legend={{}}
            />
          </PanelBody>
        </Panel>
      </div>

      <div className="mt-6 sm:mt-9">
        <DemoNote title={`${JACOB.firstName} now has two tutors`}>
          <p>
            {STACEY.firstName} for Maths every Tuesday, {story.tutor.firstName} for Physics. Nine
            screens to find a stranger; four to book again with someone you already use.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <DemoButton href={withPaid('/demo/parent', true)}>Back to your family</DemoButton>
            <DemoButton href="/demo/parent/rebook" tone="quiet">
              See the shorter journey
            </DemoButton>
          </div>
        </DemoNote>
      </div>
    </ParentShell>
  );
}
