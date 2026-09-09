import { ParentShell } from '@/components/demo/demo-shells';
import { JourneyProgress } from '@/components/demo/demo-journey';
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
import { JACOB, money } from '@/lib/demo/fixtures';
import { chosenTimes, discoveryStory, intervalLabel, withTimes } from '@/lib/demo/stories';

export const metadata = { title: 'Check this over' };

export default async function FindReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ time?: string | string[] }>;
}) {
  const { time } = await searchParams;
  const picked = chosenTimes(time);
  const story = discoveryStory(new Date(), picked);

  return (
    <ParentShell active="/demo/parent/tutors">
      <JourneyProgress current="review" />
      <header className="mt-6">
        <h1 className="font-display text-[30px] font-semibold leading-tight tracking-[-0.018em] text-text-primary text-balance">
          Check this over before you send
        </h1>
        <p className="mt-1.5 max-w-[62ch] text-[13.5px] text-text-muted">
          Nothing is booked yet. {story.tutor.firstName} will be asked, and can accept one of your
          times or decline.
        </p>
      </header>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel tone="hero">
          <PanelHead title="Your request" action={<Chip tone="neutral">Not sent yet</Chip>} />
          <PanelBody>
            <div className="flex items-center gap-4">
              <Disc initials={story.tutor.initials} size="lg" />
              <div className="min-w-0">
                <p className="font-display text-[19px] font-medium leading-tight text-text-primary">
                  Physics with {story.tutor.firstName}
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
                  value={story.formatCode === 'online' ? 'Online' : 'In person'}
                />
                <Fact label="Cost" value={money(story.priceMinor)} strong />
              </Facts>
            </div>
          </PanelBody>
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel>
            <PanelHead title="Times you can do" meta={`${String(story.offered.length)} offered`} />
            <PanelBody className="flex flex-col gap-2">
              {story.offered.map((at) => (
                <div
                  key={at.toISOString()}
                  className="rounded-[5px] border border-surface-border bg-surface-card-secondary px-3.5 py-2.5 text-[13px] font-medium tabular-nums text-text-primary"
                >
                  {intervalLabel(at, story.durationMinutes)}
                </div>
              ))}
              <p className="mt-1 text-[12px] text-text-muted">
                {story.tutor.firstName} takes whichever one fits his week.
              </p>
            </PanelBody>
          </Panel>

          <Panel tone="quiet">
            <PanelBody className="flex flex-col gap-3">
              <DemoButton href={withTimes('/demo/parent/find/sent', picked)} size="lg">
                Send this request
              </DemoButton>
              <p className="text-[12.5px] leading-relaxed text-text-muted">
                You are asking, not booking. Nothing is charged.
              </p>
            </PanelBody>
          </Panel>
        </div>
      </div>

      <div className="mt-5">
        <Aside title="This adds a subject">
          Physics will be added to {JACOB.firstName}&rsquo;s subjects when you send this request.
          His Maths lessons with Stacey are untouched.
        </Aside>
      </div>
    </ParentShell>
  );
}
