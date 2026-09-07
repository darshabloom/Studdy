import { ParentShell } from '@/components/demo/demo-shells';
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
import { JACOB, STACEY, money } from '@/lib/demo/fixtures';
import { intervalLabel, rebookStory } from '@/lib/demo/stories';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Request sent' };

/**
 * SENT, AND WAITING.
 *
 * The one thing the demo has to fake is TIME. In reality Stacey replies over
 * the following hours; here that is a button, and the note beside it says so
 * rather than letting a reviewer think the product works that way.
 */
export default function RebookSentPage() {
  const now = new Date();
  const story = rebookStory(now);

  return (
    <ParentShell active="/demo/parent">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12.5px] text-text-muted">{story.reference}</p>
          <PageHead
            title="Sent to Stacey"
            sub={`An extra ${String(story.durationMinutes)}-minute session for ${JACOB.firstName}`}
          />
        </div>
        <Chip tone="neutral">Awaiting a reply</Chip>
      </div>

      <section className="mt-8">
        <SectionLine title="What you asked for" />
        <div className="mt-4 flex items-center gap-4">
          <Disc initials={STACEY.initials} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-[17px] font-medium text-text-primary">
              {STACEY.firstName}
            </p>
            <p className="mt-0.5 text-[12.5px] text-text-muted">
              Reply due by {formatDeadline(story.request.respondByAt, PLATFORM_TIME_ZONE)}
            </p>
          </div>
          <span className="text-[14px] font-semibold tabular-nums text-text-primary">
            {money(story.priceMinor)}
          </span>
        </div>

        <div className="mt-5 max-w-lg">
          <Facts>
            {story.request.offered.map((option) => (
              <Fact
                key={option.id}
                label="Offered"
                value={intervalLabel(option.at, story.durationMinutes)}
              />
            ))}
          </Facts>
        </div>
      </section>

      <div className="mt-9">
        <DemoNote title="In the real product you would wait here">
          <p>
            {STACEY.firstName} gets the request in her workspace and has until{' '}
            {formatDeadline(story.request.respondByAt, PLATFORM_TIME_ZONE)} to reply. You are
            emailed the moment she does. Nothing is held or charged until then.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <DemoButton href="/demo/parent/rebook/pay">
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
