import { ParentShell } from '@/components/demo/demo-shells';
import { JourneyProgress } from '@/components/demo/demo-journey';
import { DemoTimePicker } from '@/components/demo/demo-time-picker';
import { Panel, PanelBody, PanelHead } from '@/components/demo/kit';
import { JACOB } from '@/lib/demo/fixtures';
import { discoveryStory, intervalLabel } from '@/lib/demo/stories';
import { bookableStarts } from '@/lib/demo/timeline';

export const metadata = { title: 'When could the lesson be?' };

/**
 * Every block is ONE START. A four o'clock lesson and a half past four one are
 * different things to choose between, and merging them into bands would erase
 * exactly the distinction this screen exists to make.
 *
 * Clickable, like the rebooking picker: what is chosen here is what the review,
 * payment and confirmation screens describe.
 */
export default function FindTimesPage() {
  const now = new Date();
  const story = discoveryStory(now);
  const starts = bookableStarts(story.tutor.bands, story.week.days, story.durationMinutes, now);
  const labels = Object.fromEntries(
    starts.map((start) => [start.iso, intervalLabel(start.at, story.durationMinutes)]),
  );

  return (
    <ParentShell active="/demo/parent/tutors">
      <JourneyProgress current="times" />

      <header className="mt-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
          Step 3 of 3
        </p>
        <h1 className="mt-1.5 font-display text-[30px] font-semibold leading-tight tracking-[-0.018em] text-text-primary text-balance">
          When could {story.tutor.firstName} teach {JACOB.firstName}?
        </h1>
        <p className="mt-2 max-w-[64ch] text-[14px] leading-relaxed text-text-secondary">
          Offer more than one time and you are far more likely to get a lesson &mdash; the tutor
          accepts whichever fits their week.
        </p>
      </header>

      <div className="mt-6">
        <Panel>
          <PanelHead title="His bookable time" meta={story.week.rangeLabel} />
          <PanelBody>
            <DemoTimePicker
              blocks={starts.map((start) => start.block)}
              dayLabels={story.week.dayLabels}
              todayIndex={story.week.todayIndex}
              defaultSelected={story.offered.map((at) => at.toISOString())}
              continueHref="/demo/parent/find/review"
              labelFor={labels}
              tutorFirstName={story.tutor.firstName}
              durationMinutes={story.durationMinutes}
            />
          </PanelBody>
        </Panel>
      </div>
    </ParentShell>
  );
}
