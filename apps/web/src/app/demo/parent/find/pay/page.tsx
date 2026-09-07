import { ParentShell } from '@/components/demo/demo-shells';
import { JourneyProgress } from '@/components/demo/demo-journey';
import { DemoPaymentForm } from '@/components/demo/demo-payment-form';
import { Aside, Disc, Fact, Facts, PageHead, SectionLine } from '@/components/demo/kit';
import { formatLessonDateTime } from '@/components/requests/request-status';
import { JACOB, money } from '@/lib/demo/fixtures';
import { discoveryStory } from '@/lib/demo/stories';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Pay for your lesson' };

export default function FindPayPage() {
  const now = new Date();
  const story = discoveryStory(now);
  const total = money(story.priceMinor);

  return (
    <ParentShell active="/demo/parent/tutors">
      <JourneyProgress current="pay" />
      <div className="mx-auto mt-6 max-w-2xl">
        <PageHead
          eyebrow={`${story.tutor.firstName} accepted`}
          title="Pay for your lesson"
          sub={`He is holding this time until ${formatLessonDateTime(story.paymentDeadlineAt, PLATFORM_TIME_ZONE)}.`}
        />

        <div className="mt-6">
          <Aside title="This lesson is not booked until your payment succeeds">
            Nothing is confirmed while this page is open. If the payment does not go through before
            the deadline, the time is released to other families.
          </Aside>
        </div>

        <section className="mt-8">
          <SectionLine title="What you are paying for" />
          <div className="mt-4 flex items-center gap-4">
            <Disc initials={story.tutor.initials} />
            <div>
              <p className="font-display text-[18px] font-medium text-text-primary">
                Physics with {story.tutor.firstName}
              </p>
              <p className="mt-0.5 text-[12.5px] text-text-muted">
                For {JACOB.firstName} &middot; Year {JACOB.schoolYear}
              </p>
            </div>
          </div>
          <div className="mt-5">
            <Facts>
              <Fact label="When" value={formatLessonDateTime(story.accepted, PLATFORM_TIME_ZONE)} />
              <Fact label="Length" value={`${String(story.durationMinutes)} minutes`} />
              <Fact label="Format" value={story.formatCode === 'online' ? 'Online' : 'In person'} />
              <Fact label="Lesson price" value={total} />
              <Fact label="Total to pay" value={total} strong />
            </Facts>
          </div>
        </section>

        <section className="mt-9">
          <SectionLine title="Card details" />
          <div className="mt-4">
            <DemoPaymentForm total={total} nextHref="/demo/parent/find/booked" />
          </div>
        </section>
      </div>
    </ParentShell>
  );
}
