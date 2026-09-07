import { ParentShell } from '@/components/demo/demo-shells';
import { DemoPaymentForm } from '@/components/demo/demo-payment-form';
import {
  Aside,
  DemoButton,
  Disc,
  Fact,
  Facts,
  PageHead,
  SectionLine,
} from '@/components/demo/kit';
import { formatLessonDateTime } from '@/components/requests/request-status';
import { JACOB, STACEY, money, serviceById } from '@/lib/demo/fixtures';
import { chosenTimes, rebookStory, withTimes } from '@/lib/demo/stories';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Pay for your lesson' };

/**
 * THE PAYMENT SCREEN.
 *
 * Honest about two things, in the product and here: what is being charged, and
 * what has and has not happened yet. PAYING IS NOT BOOKING, and the copy says
 * so before the parent pays as well as after — a family should never be able to
 * say they thought the lesson was booked when it was not.
 *
 * NO STUDDY FEE LINE, and its absence is the product decision rather than an
 * omission. The commission comes OUT OF the tutor's listed price, so the total
 * is exactly the figure shown when the tutor was chosen. Itemising a fee the
 * parent is not being charged would invent a cost.
 */
export default async function RebookPayPage({
  searchParams,
}: {
  searchParams: Promise<{ time?: string | string[] }>;
}) {
  const { time } = await searchParams;
  const picked = chosenTimes(time);
  const now = new Date();
  const story = rebookStory(now, picked);
  const total = money(story.priceMinor);

  return (
    <ParentShell active="/demo/parent">
      <div className="mx-auto max-w-2xl">
        <PageHead
          eyebrow={`${STACEY.firstName} accepted`}
          title="Pay for your lesson"
          sub={`She is holding this time until ${formatLessonDateTime(story.paymentDeadlineAt, PLATFORM_TIME_ZONE)}.`}
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
            <Disc initials={STACEY.initials} />
            <div>
              <p className="font-display text-[18px] font-medium text-text-primary">
                {serviceById(JACOB.serviceId)?.name ?? 'Maths'} with {STACEY.firstName}
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
              <Fact
                label="Format"
                value={story.request.format === 'online' ? 'Online' : 'In person'}
              />
              <Fact label="Lesson price" value={total} />
              <Fact label="Total to pay" value={total} strong />
              <Fact
                label="Pay by"
                value={formatLessonDateTime(story.paymentDeadlineAt, PLATFORM_TIME_ZONE)}
              />
            </Facts>
          </div>
        </section>

        <section className="mt-9">
          <SectionLine title="Card details" />
          <div className="mt-4">
            <DemoPaymentForm total={total} nextHref={withTimes('/demo/parent/rebook/booked', picked)} />
          </div>
        </section>

        <div className="mt-7">
          <DemoButton href={withTimes('/demo/parent/rebook/sent', picked)} tone="quiet" size="sm">
            &larr; Back to your request
          </DemoButton>
        </div>
      </div>
    </ParentShell>
  );
}
