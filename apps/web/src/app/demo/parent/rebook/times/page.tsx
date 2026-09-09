import { ParentShell } from '@/components/demo/demo-shells';
import { DemoTimePicker } from '@/components/demo/demo-time-picker';
import { Aside, DemoButton, Panel, PanelBody, PanelHead } from '@/components/demo/kit';
import { JACOB, STACEY } from '@/lib/demo/fixtures';
import { intervalLabel, rebookStarts, rebookStory, standingSlotLabel } from '@/lib/demo/stories';

export const metadata = { title: 'When would suit?' };

/**
 * CHOOSING A TIME, with the standing lesson explained rather than hidden.
 *
 * Jacob's usual Tuesday at four does not appear as bookable, and the reason is
 * the whole point: IT IS ALREADY HIS. A picker that silently omitted it would
 * look like the tutor was busy; saying so turns an absence into a fact about
 * the relationship.
 *
 * The picker is real. Blocks are clickable, the selection can be changed, and
 * what is chosen travels in the URL to every screen after this one.
 */
export default function RebookTimesPage() {
  const now = new Date();
  const story = rebookStory(now);
  const starts = rebookStarts(now);
  const standing = standingSlotLabel(now);

  const labels = Object.fromEntries(
    starts.map((start) => [start.iso, intervalLabel(start.at, story.durationMinutes)]),
  );

  return (
    <ParentShell active="/demo/parent">
      <DemoButton href="/demo/parent/rebook" tone="quiet" size="sm">
        &larr; Back
      </DemoButton>

      <header className="mt-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
          Book another lesson &middot; step 1 of 2
        </p>
        <h1 className="mt-1.5 font-display text-[30px] font-semibold leading-tight tracking-[-0.018em] text-text-primary text-balance">
          When could {STACEY.firstName} teach {JACOB.firstName}?
        </h1>
        <p className="mt-2 text-[13.5px] text-text-muted">
          {story.week.rangeLabel} &middot; shown in New Zealand time
        </p>
      </header>

      {standing === null ? null : (
        <div className="mt-6">
          <Aside title={`Your usual time is already ${JACOB.firstName}'s`}>
            {standing} is his weekly lesson, so it is not free to book again. Everything below is
            what {STACEY.firstName} has left.
          </Aside>
        </div>
      )}

      <div className="mt-6">
        <Panel>
          <PanelHead
            title={`${STACEY.firstName}'s remaining time`}
            meta={`${String(starts.length)} start times`}
          />
          <PanelBody>
            <DemoTimePicker
              blocks={starts.map((start) => start.block)}
              dayLabels={story.week.dayLabels}
              todayIndex={story.week.todayIndex}
              pastCount={story.week.pastCount}
              defaultSelected={story.request.offered.map((option) => option.at.toISOString())}
              continueHref="/demo/parent/rebook/review"
              labelFor={labels}
              tutorFirstName={STACEY.firstName}
              durationMinutes={story.durationMinutes}
            />
          </PanelBody>
        </Panel>
      </div>
    </ParentShell>
  );
}
