import { ParentShell } from '@/components/demo/demo-shells';
import { JourneyProgress } from '@/components/demo/demo-journey';
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
import { JACOB, money } from '@/lib/demo/fixtures';
import { chosenTimes, discoveryStory, intervalLabel, withTimes } from '@/lib/demo/stories';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Request sent' };

export default async function FindSentPage({
  searchParams,
}: {
  searchParams: Promise<{ time?: string | string[] }>;
}) {
  const { time } = await searchParams;
  const picked = chosenTimes(time);
  const now = new Date();
  const story = discoveryStory(now, picked);

  return (
    <ParentShell active="/demo/parent/tutors">
      <JourneyProgress current="sent" />
      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHead
            title="Request sent"
            meta={story.reference}
            action={<Chip tone="neutral">Awaiting a reply</Chip>}
          />
          <PanelBody className="py-5">
            <div className="flex items-center gap-4">
              <Disc initials={story.tutor.initials} size="lg" />
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-[24px] font-semibold leading-tight text-text-primary">
                  Sent to {story.tutor.firstName}
                </h1>
                <p className="mt-1 text-[12.5px] text-text-muted">Physics for {JACOB.firstName}</p>
              </div>
              <span className="text-[19px] font-semibold tabular-nums text-text-primary">
                {money(story.priceMinor)}
              </span>
            </div>
            <div className="mt-5 border-t border-surface-border pt-3">
              <Facts>
                <Fact
                  label="Reply due by"
                  value={formatDeadline(story.respondByAt, PLATFORM_TIME_ZONE)}
                />
                <Fact label="Status" value="Nothing held or charged yet" />
              </Facts>
            </div>
          </PanelBody>
        </Panel>

        <Panel tone="quiet">
          <PanelHead title="What you asked for" meta={`${String(story.offered.length)} times`} />
          <PanelBody className="flex flex-col gap-2">
            {story.offered.map((at) => (
              <div
                key={at.toISOString()}
                className="rounded-[5px] border border-surface-border bg-surface-card px-3.5 py-2.5 text-[13px] font-medium tabular-nums text-text-primary"
              >
                {intervalLabel(at, story.durationMinutes)}
              </div>
            ))}
          </PanelBody>
        </Panel>
      </div>

      <div className="mt-6 sm:mt-9">
        <DemoNote title="In the real product you would wait here">
          <p>
            Each tutor replies separately, and no tutor can see who else you asked. You are emailed
            the moment one accepts. Nothing is held or charged until then.
          </p>
          <div className="mt-3">
            <DemoButton href={withTimes('/demo/parent/find/pay', picked)}>
              Skip the wait &mdash; {story.tutor.firstName} accepts
            </DemoButton>
          </div>
        </DemoNote>
      </div>
    </ParentShell>
  );
}
