import { ParentShell } from '@/components/demo/demo-shells';
import { DemoPaymentForm } from '@/components/demo/demo-payment-form';
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
import { formatLessonDateTime } from '@/components/requests/request-status';
import { JACOB, STACEY, money, serviceById } from '@/lib/demo/fixtures';
import { chosenTimes, intervalLabel, rebookStory, withTimes } from '@/lib/demo/stories';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Pay for your lesson' };

/**
 * THE PAYMENT SCREEN, and the middle of the demo's one lifecycle.
 *
 * The same extra session that shows as `Payment required` on the family's
 * dashboard, as a hold on Stacey's calendar, and as booked on the screen after
 * this one. Priya reaches this page two ways — walking the rebooking journey,
 * or pressing Pay now on the dashboard — and both arrive at the same lesson,
 * because both read the same accepted request rather than making one up.
 *
 * Honest about two things, in the product and here: what is being charged, and
 * what has and has not happened yet. PAYING IS NOT BOOKING, and the copy says
 * so before the parent pays as well as after — a family should never be able to
 * say they thought the lesson was booked when it was not.
 *
 * NO STUDDY FEE LINE, and its absence is the product decision rather than an
 * omission. The commission comes OUT OF the tutor's listed price, so the total
 * is exactly the figure shown when the tutor was chosen. Itemising a fee the
 * parent is not being charged would invent a cost. The tutor's side of that
 * split is shown on her screens, never here.
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
            {STACEY.firstName} accepted &middot; {story.reference}
          </p>
          <h1 className="mt-1.5 font-display text-[30px] font-semibold leading-tight tracking-[-0.018em] text-text-primary">
            Pay for your lesson
          </h1>
          <p className="mt-1.5 max-w-[62ch] text-[13.5px] text-text-muted">
            She is holding this time until{' '}
            {formatLessonDateTime(story.paymentDeadlineAt, PLATFORM_TIME_ZONE)}.
          </p>
        </div>
        <Chip tone="attention">Payment required</Chip>
      </header>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* ── What is being bought ──────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-5">
          <Panel tone="hero">
            <PanelHead title="What you are paying for" />
            <PanelBody>
              <div className="flex items-center gap-4">
                <Disc initials={STACEY.initials} size="lg" />
                <div className="min-w-0">
                  <p className="font-display text-[19px] font-medium leading-tight text-text-primary">
                    {serviceById(JACOB.serviceId)?.name ?? 'Maths'} with {STACEY.firstName}
                  </p>
                  <p className="mt-1 text-[12.5px] text-text-muted">
                    For {JACOB.firstName} &middot; Year {JACOB.schoolYear}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-[5px] border border-brand/20 bg-surface-card px-4 py-1">
                <Facts>
                  <Fact label="When" value={intervalLabel(story.accepted, story.durationMinutes)} />
                  <Fact label="Length" value={`${String(story.durationMinutes)} minutes`} />
                  <Fact
                    label="Format"
                    value={story.request.format === 'online' ? 'Online' : 'In person'}
                  />
                  <Fact label="Lesson price" value={total} />
                  <Fact label="Total to pay" value={total} strong />
                </Facts>
              </div>
            </PanelBody>
          </Panel>

          <Panel tone="attention">
            <PanelBody className="flex gap-3.5">
              <span
                aria-hidden
                className="w-[3px] shrink-0 self-stretch rounded-full bg-status-warning"
              />
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-text-primary">
                  Not booked until your payment succeeds
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">
                  Nothing is confirmed while this page is open. If the payment does not go through
                  before the deadline, the time is released to other families.
                </p>
              </div>
            </PanelBody>
          </Panel>
        </div>

        {/* ── The form ──────────────────────────────────────────────── */}
        <Panel>
          <PanelHead title="Card details" meta="Simulated" />
          <PanelBody>
            <DemoPaymentForm
              total={total}
              nextHref={withTimes('/demo/parent/rebook/booked', picked)}
            />
          </PanelBody>
        </Panel>
      </div>

      <div className="mt-5">
        <Aside title="No real payment is taken">
          The demo has no Stripe keys and makes no network call. Submitting the form moves the story
          on; it does not charge anything.
        </Aside>
      </div>

      <div className="mt-5">
        <DemoButton href={withTimes('/demo/parent/rebook/sent', picked)} tone="quiet" size="sm">
          &larr; Back to your request
        </DemoButton>
      </div>
    </ParentShell>
  );
}
