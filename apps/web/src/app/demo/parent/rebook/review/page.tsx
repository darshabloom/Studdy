import { ParentShell } from '@/components/demo/demo-shells';
import {
  Aside,
  Chip,
  DemoButton,
  Disc,
  Fact,
  Facts,
  Panel,
  PanelBody,
  PanelHead,
} from '@/components/demo/kit';
import { JACOB, STACEY, money, serviceById } from '@/lib/demo/fixtures';
import { chosenTimes, intervalLabel, rebookStory, withTimes } from '@/lib/demo/stories';

export const metadata = { title: 'Check this over' };

export default async function RebookReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ time?: string | string[] }>;
}) {
  const { time } = await searchParams;
  const picked = chosenTimes(time);
  const now = new Date();
  // The times the viewer actually chose, carried from the picker.
  const story = rebookStory(now, picked);
  const service = serviceById(JACOB.serviceId);

  return (
    <ParentShell active="/demo/parent">
      <DemoButton href={withTimes('/demo/parent/rebook/times', picked)} tone="quiet" size="sm">
        &larr; Back
      </DemoButton>

      <header className="mt-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
          Book another lesson &middot; step 2 of 2
        </p>
        <h1 className="mt-1.5 font-display text-[30px] font-semibold leading-tight tracking-[-0.018em] text-text-primary text-balance">
          Check this over before you send
        </h1>
        <p className="mt-1.5 max-w-[62ch] text-[13.5px] text-text-muted">
          Nothing is booked yet. {STACEY.firstName} will be asked, and can accept one of your times
          or decline.
        </p>
      </header>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel tone="hero">
            <PanelHead title="Your request" action={<Chip tone="neutral">Not sent yet</Chip>} />
            <PanelBody>
              <div className="flex items-center gap-4">
                <Disc initials={STACEY.initials} size="lg" />
                <div className="min-w-0">
                  <p className="font-display text-[19px] font-medium leading-tight text-text-primary">
                    {service?.name ?? 'Maths'} with {STACEY.firstName}
                  </p>
                  <p className="mt-1 text-[12.5px] text-text-muted">
                    For {JACOB.firstName} &middot; Year {JACOB.schoolYear}
                  </p>
                </div>
              </div>
              <div className="mt-5 rounded-[5px] border border-brand/20 bg-surface-card px-4 py-1">
                <Facts>
                  <Fact label="Length" value={`${String(story.durationMinutes)} minutes`} />
                  <Fact
                    label="Format"
                    value={story.request.format === 'online' ? 'Online' : 'In person'}
                  />
                  <Fact label="Cost" value={money(story.priceMinor)} strong />
                </Facts>
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHead title={`What ${STACEY.firstName} will see`} />
            <PanelBody>
              <p className="max-w-[62ch] text-[14.5px] leading-relaxed text-text-secondary">
                {story.request.note}
              </p>
            </PanelBody>
          </Panel>
        </div>

        {/* The selection the viewer actually made, carried from the picker. */}
        <div className="flex flex-col gap-5">
          <Panel>
            <PanelHead
              title="Times you can do"
              meta={`${String(story.request.offered.length)} offered`}
            />
            <PanelBody className="flex flex-col gap-2">
              {story.request.offered.map((option) => (
                <div
                  key={option.id}
                  className="rounded-[5px] border border-surface-border bg-surface-card-secondary px-3.5 py-2.5 text-[13px] font-medium tabular-nums text-text-primary"
                >
                  {intervalLabel(option.at, story.durationMinutes)}
                </div>
              ))}
              <p className="mt-1 text-[12px] text-text-muted">
                {STACEY.firstName} takes whichever one fits her week.
              </p>
            </PanelBody>
          </Panel>

          <Panel tone="quiet">
            <PanelBody className="flex flex-col gap-3">
              <DemoButton href={withTimes('/demo/parent/rebook/sent', picked)} size="lg">
                Send this request
              </DemoButton>
              <p className="text-[12.5px] leading-relaxed text-text-muted">
                Nothing is charged now.
              </p>
            </PanelBody>
          </Panel>
        </div>
      </div>

      <div className="mt-5">
        <Aside title="You are asking, not booking">
          Nothing is charged now. If {STACEY.firstName} accepts one of your times, you choose her
          and pay, and only then is the lesson booked.
        </Aside>
      </div>
    </ParentShell>
  );
}
