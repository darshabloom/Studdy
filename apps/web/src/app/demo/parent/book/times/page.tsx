import { DemoNote, DemoPage } from '@/components/demo/demo-page';
import { JourneyShell } from '@/components/journey/journey-shell';
import { JourneyTimePicker } from '@/components/journey/time-picker';
import { availabilitySummary } from '@/lib/discovery/availability-view';
import { profileCalendarWindow } from '@/lib/availability/calendar-projection';
import { DEMO_DURATION_MINUTES, DEMO_FAMILY } from '@/lib/demo/fixtures';
import { DEMO_PARENT_STEPS } from '@/lib/demo/steps';
import { demoSections, intervalLabel } from '@/lib/demo/journey';
import { demoStory } from '@/lib/demo/story';
import { bookableStarts } from '@/lib/demo/timeline';

export const metadata = { title: 'When could the lesson be?' };

/**
 * CHOOSING TIMES — the production `JourneyTimePicker`, unchanged.
 *
 * This is the single largest piece of reuse in the demo and the reason it is
 * worth showing: the picker is a client component driven entirely by props and
 * hrefs, with no server action behind it, so the demo gets the real
 * interaction — a real week grid, real half-hour starts, the real one-to-five
 * bound and the real guidance copy — for the price of assembling its inputs.
 *
 * Every block is ONE START, deliberately not merged into bands. A four o'clock
 * lesson and a half past four one are different things to choose between, and
 * merging them would erase exactly the distinction this screen exists to make.
 */
export default function DemoTimesPage() {
  const story = demoStory();
  const starts = bookableStarts(story.tutor.bands, story.week.days, DEMO_DURATION_MINUTES);
  const blocks = starts.map((start) => start.block);

  const chosen = story.offered.map((time) => time.at.toISOString());
  const labelFor = Object.fromEntries(
    starts.map((start) => [start.iso, intervalLabel(start.at, DEMO_DURATION_MINUTES)]),
  );

  const sections = demoSections(story, 'times', {
    format: 'online',
    durationMinutes: DEMO_DURATION_MINUTES,
    times: story.offered,
  });

  return (
    <DemoPage steps={DEMO_PARENT_STEPS} current="times">
      <JourneyShell
        sections={sections}
        title={`When could ${story.tutor.firstName} teach ${DEMO_FAMILY.studentPreferredName}?`}
        description="Offer more than one time and you are far more likely to get a lesson — the tutor accepts whichever one fits their week."
        summaryTitle="Your request so far"
        summaryCaption="Nothing is sent until you review it."
        backHref="/demo/parent/book/length"
      >
        <div className="mb-4">
          <DemoNote title="This picker is live">
            Two times are already chosen, so the story can continue. Add and remove times to see how
            the real picker behaves — Continue always moves on with the two shown in the summary.
          </DemoNote>
        </div>

        <JourneyTimePicker
          blocks={blocks}
          window={profileCalendarWindow(blocks)}
          dayLabels={story.week.dayLabels}
          rangeLabel={story.week.rangeLabel}
          summary={availabilitySummary(story.week.days, blocks)}
          todayIndex={story.week.todayIndex}
          previousHref={null}
          nextHref={null}
          lessonLengthLabel={`Lessons are ${String(DEMO_DURATION_MINUTES)} minutes long.`}
          chosen={chosen}
          reviewHref="/demo/parent/book/review"
          labelFor={labelFor}
          ariaSubject={story.tutor.firstName}
          emptyWeekSentence={`${story.tutor.firstName} has nothing bookable`}
          alternativesSentence="These are alternatives — the tutor will accept at most one."
        />
      </JourneyShell>
    </DemoPage>
  );
}
