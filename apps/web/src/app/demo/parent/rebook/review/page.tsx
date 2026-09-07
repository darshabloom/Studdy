import { ParentShell } from '@/components/demo/demo-shells';
import {
  Aside,
  DemoButton,
  Disc,
  Fact,
  Facts,
  PageHead,
  SectionLine,
} from '@/components/demo/kit';
import { JACOB, STACEY, money, serviceById } from '@/lib/demo/fixtures';
import { intervalLabel, rebookStory } from '@/lib/demo/stories';

export const metadata = { title: 'Check this over' };

export default function RebookReviewPage() {
  const now = new Date();
  const story = rebookStory(now);
  const service = serviceById(JACOB.serviceId);

  return (
    <ParentShell active="/demo/parent">
      <DemoButton href="/demo/parent/rebook/times" tone="quiet" size="sm">
        &larr; Back
      </DemoButton>

      <div className="mt-4">
        <PageHead
          eyebrow="Book another lesson"
          title="Check this over before you send"
          sub={`Nothing is booked yet. ${STACEY.firstName} will be asked, and can accept one of your times or decline.`}
        />
      </div>

      <section className="mt-8">
        <SectionLine title="Your request" />
        <div className="mt-4 flex items-center gap-4 border-l-2 border-brand bg-brand-tint/40 px-5 py-4">
          <Disc initials={STACEY.initials} />
          <div>
            <p className="font-display text-[18px] font-medium text-text-primary">
              {service?.name ?? 'Maths'} with {STACEY.firstName}
            </p>
            <p className="mt-1 text-[12.5px] text-text-muted">
              For {JACOB.firstName} &middot; Year {JACOB.schoolYear}
            </p>
          </div>
        </div>

        <div className="mt-5 max-w-lg">
          <Facts>
            <Fact label="Length" value={`${String(story.durationMinutes)} minutes`} />
            <Fact
              label="Format"
              value={story.request.format === 'online' ? 'Online' : 'In person'}
            />
            <Fact
              label="Times you can do"
              value={
                <span className="flex flex-col items-end gap-0.5">
                  {story.request.offered.map((option) => (
                    <span key={option.id}>{intervalLabel(option.at, story.durationMinutes)}</span>
                  ))}
                  <span className="text-[11.5px] font-normal text-text-muted">Any one of these</span>
                </span>
              }
            />
            <Fact label="Cost" value={money(story.priceMinor)} strong />
          </Facts>
        </div>
      </section>

      <section className="mt-8 max-w-[68ch]">
        <SectionLine title={`What ${STACEY.firstName} will see`} />
        <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">{story.request.note}</p>
      </section>

      <div className="mt-8">
        <Aside title="You are asking, not booking">
          Nothing is charged now. If {STACEY.firstName} accepts one of your times, you choose her and
          pay, and only then is the lesson booked.
        </Aside>
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <DemoButton href="/demo/parent/rebook/sent" size="lg">
          Send this request
        </DemoButton>
      </div>
    </ParentShell>
  );
}
