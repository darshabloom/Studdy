import { ParentShell } from '@/components/demo/demo-shells';
import {
  Chip,
  DemoButton,
  DemoNote,
  Disc,
  Fact,
  Facts,
  Panel,
  PanelBody,
  PanelHead,
} from '@/components/demo/kit';
import { formatDeadline } from '@/components/requests/request-status';
import { JACOB, STACEY, money } from '@/lib/demo/fixtures';
import { chosenTimes, intervalLabel, rebookStory, withTimes } from '@/lib/demo/stories';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Request sent' };

/**
 * SENT, AND WAITING.
 *
 * The one thing the demo has to fake is TIME. In reality Stacey replies over
 * the following hours; here that is a button, and the note beside it says so
 * rather than letting a reviewer think the product works that way.
 */
export default async function RebookSentPage({
  searchParams,
}: {
  searchParams: Promise<{ time?: string | string[] }>;
}) {
  const { time } = await searchParams;
  const picked = chosenTimes(time);
  const now = new Date();
  const story = rebookStory(now, picked);

  return (
    <ParentShell active="/demo/parent">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHead
            title="Request sent"
            meta={story.reference}
            action={<Chip tone="neutral">Awaiting a reply</Chip>}
          />
          <PanelBody className="py-5">
            <div className="flex items-center gap-4">
              <Disc initials={STACEY.initials} size="lg" />
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-[24px] font-semibold leading-tight text-text-primary">
                  Sent to {STACEY.firstName}
                </h1>
                <p className="mt-1 text-[12.5px] text-text-muted">
                  An extra {story.durationMinutes}-minute session for {JACOB.firstName}
                </p>
              </div>
              <span className="text-[19px] font-semibold tabular-nums text-text-primary">
                {money(story.priceMinor)}
              </span>
            </div>
            <div className="mt-5 border-t border-surface-border pt-3">
              <Facts>
                <Fact
                  label="Reply due by"
                  value={formatDeadline(story.request.respondByAt, PLATFORM_TIME_ZONE)}
                />
                <Fact label="Status" value="Nothing held or charged yet" />
              </Facts>
            </div>
          </PanelBody>
        </Panel>

        <Panel tone="quiet">
          <PanelHead
            title="What you asked for"
            meta={`${String(story.request.offered.length)} times`}
          />
          <PanelBody className="flex flex-col gap-2">
            {story.request.offered.map((option) => (
              <div
                key={option.id}
                className="rounded-[5px] border border-surface-border bg-surface-card px-3.5 py-2.5 text-[13px] font-medium tabular-nums text-text-primary"
              >
                {intervalLabel(option.at, story.durationMinutes)}
              </div>
            ))}
          </PanelBody>
        </Panel>
      </div>

      <div className="mt-9">
        <DemoNote title="In the real product you would wait here">
          <p>
            {STACEY.firstName} gets the request in her workspace and has until{' '}
            {formatDeadline(story.request.respondByAt, PLATFORM_TIME_ZONE)} to reply. You are
            emailed the moment she does. Nothing is held or charged until then.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <DemoButton href={withTimes('/demo/parent/rebook/pay', picked)}>
              Skip the wait &mdash; {STACEY.firstName} accepts
            </DemoButton>
            <DemoButton href="/demo/tutor/requests/jacob-extra-session" tone="quiet">
              Watch her do it
            </DemoButton>
          </div>
        </DemoNote>
      </div>
    </ParentShell>
  );
}
