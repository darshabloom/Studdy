import { ParentShell } from '@/components/demo/demo-shells';
import { JourneyProgress } from '@/components/demo/demo-journey';
import {
  Aside,
  DemoButton,
  Disc,
  Fact,
  Facts,
  PageHead,
  SectionLine,
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
      <div className="mt-6">
        <PageHead
          title="Check this over before you send"
          sub={`Nothing is booked yet. ${story.tutor.firstName} will be asked, and can accept one of your times or decline.`}
        />
      </div>

      <section className="mt-8">
        <SectionLine title="Your request" />
        <div className="mt-4 flex items-center gap-4 border-l-2 border-brand bg-brand-tint/40 px-5 py-4">
          <Disc initials={story.tutor.initials} />
          <div>
            <p className="font-display text-[18px] font-medium text-text-primary">
              Physics with {story.tutor.firstName}
            </p>
            <p className="mt-1 text-[12.5px] text-text-muted">
              For {JACOB.firstName} &middot; Year {JACOB.schoolYear}
            </p>
          </div>
        </div>

        <div className="mt-5 max-w-lg">
          <Facts>
            <Fact label="Length" value={`${String(story.durationMinutes)} minutes`} />
            <Fact label="Format" value={story.formatCode === 'online' ? 'Online' : 'In person'} />
            <Fact
              label="Times you can do"
              value={
                <span className="flex flex-col items-end gap-0.5">
                  {story.offered.map((at) => (
                    <span key={at.toISOString()}>
                      {intervalLabel(at, story.durationMinutes)}
                    </span>
                  ))}
                  <span className="text-[11.5px] font-normal text-text-muted">Any one of these</span>
                </span>
              }
            />
            <Fact label="Cost" value={money(story.priceMinor)} strong />
          </Facts>
        </div>
      </section>

      <div className="mt-8">
        <Aside title="This adds a subject">
          Physics will be added to {JACOB.firstName}&rsquo;s subjects when you send this request. His
          Maths lessons with Stacey are untouched.
        </Aside>
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <DemoButton href={withTimes('/demo/parent/find/sent', picked)} size="lg">
          Send this request
        </DemoButton>
        <p className="text-[13.5px] text-text-secondary">
          You are asking, not booking. Nothing is charged.
        </p>
      </div>
    </ParentShell>
  );
}
