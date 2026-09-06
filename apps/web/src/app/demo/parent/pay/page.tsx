import Link from 'next/link';
import { Alert, Button, Card } from '@studdy/design-system';
import { DemoPaymentForm } from '@/components/demo/demo-payment-form';
import { DemoPage } from '@/components/demo/demo-page';
import { formatLessonDateTime, formatMoney } from '@/components/requests/request-status';
import { DEMO_PARENT_STEPS } from '@/lib/demo/steps';
import { demoStory } from '@/lib/demo/story';

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
 * omission. Studdy's commission comes OUT OF the tutor's listed price, so the
 * total is exactly the price shown when the tutor was chosen. Itemising a fee
 * the parent is not being charged would invent a cost.
 *
 * The production page renders this same summary with a handful of leftover
 * `text-muted-foreground` classes that are not Studdy tokens; this one uses the
 * design system's own.
 */
export default function DemoPayPage() {
  const story = demoStory();
  const total = formatMoney(story.priceAmountMinor, story.currencyCode);

  return (
    <DemoPage steps={DEMO_PARENT_STEPS} current="pay">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-2">
          <h1 className="font-display text-3xl font-semibold text-brand-purple-deep">
            Pay for your lesson
          </h1>
          <p className="max-w-prose text-sm text-text-secondary">
            {story.tutor.firstName} is holding this time for you until the deadline below.
          </p>
        </header>

        <Alert tone="information" title="This lesson is not booked until your payment succeeds">
          Nothing is confirmed while this page is open. If the payment does not go through before
          the deadline, the time is released to other families.
        </Alert>

        <Card>
          <h2 className="text-base font-semibold text-text-primary">What you are paying for</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Tutor" value={story.tutor.firstName} />
            <Row label="When" value={formatLessonDateTime(story.accepted.at, story.timeZone)} />
            <Row label="Length" value={`${String(story.durationMinutes)} minutes`} />
            <Row
              label="Format"
              value={story.formatCode === 'online' ? 'Online' : 'In person'}
            />
            <Row label="Lesson price" value={total} />
            <div className="flex justify-between gap-4 border-t border-surface-border pt-2 font-semibold text-text-primary">
              <dt>Total to pay</dt>
              <dd className="tabular-nums">{total}</dd>
            </div>
            <Row
              label="Pay by"
              value={formatLessonDateTime(story.paymentDeadlineAt, story.timeZone)}
            />
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 text-base font-semibold text-text-primary">Card details</h2>
          <DemoPaymentForm total={total} />
        </Card>

        <Button variant="quiet" size="sm" asChild>
          <Link href="/demo/parent/request/accepted">← Back to your request</Link>
        </Button>
      </div>
    </DemoPage>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-text-primary">{value}</dd>
    </div>
  );
}
