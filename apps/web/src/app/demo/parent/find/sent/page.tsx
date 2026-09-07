import { ParentShell } from '@/components/demo/demo-shells';
import { JourneyProgress } from '@/components/demo/demo-journey';
import {
  Chip,
  DemoButton,
  DemoNote,
  Disc,
  Fact,
  Facts,
  PageHead,
  SectionLine,
} from '@/components/demo/kit';
import { formatDeadline } from '@/components/requests/request-status';
import { JACOB, money } from '@/lib/demo/fixtures';
import { discoveryStory, intervalLabel } from '@/lib/demo/stories';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Request sent' };

export default function FindSentPage() {
  const now = new Date();
  const story = discoveryStory(now);

  return (
    <ParentShell active="/demo/parent/tutors">
      <JourneyProgress current="sent" />
      <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12.5px] text-text-muted">{story.reference}</p>
          <PageHead title={`Sent to ${story.tutor.firstName}`} sub={`Physics for ${JACOB.firstName}`} />
        </div>
        <Chip tone="neutral">Awaiting a reply</Chip>
      </div>

      <section className="mt-8">
        <SectionLine title="What you asked for" />
        <div className="mt-4 flex items-center gap-4">
          <Disc initials={story.tutor.initials} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-[17px] font-medium text-text-primary">
              {story.tutor.firstName}
            </p>
            <p className="mt-0.5 text-[12.5px] text-text-muted">
              Reply due by {formatDeadline(story.respondByAt, PLATFORM_TIME_ZONE)}
            </p>
          </div>
          <span className="text-[14px] font-semibold tabular-nums text-text-primary">
            {money(story.priceMinor)}
          </span>
        </div>
        <div className="mt-5 max-w-lg">
          <Facts>
            {story.offered.map((at) => (
              <Fact
                key={at.toISOString()}
                label="Offered"
                value={intervalLabel(at, story.durationMinutes)}
              />
            ))}
          </Facts>
        </div>
      </section>

      <div className="mt-9">
        <DemoNote title="In the real product you would wait here">
          <p>
            Each tutor replies separately, and no tutor can see who else you asked. You are emailed
            the moment one accepts. Nothing is held or charged until then.
          </p>
          <div className="mt-3">
            <DemoButton href="/demo/parent/find/pay">
              Skip the wait &mdash; {story.tutor.firstName} accepts
            </DemoButton>
          </div>
        </DemoNote>
      </div>
    </ParentShell>
  );
}
