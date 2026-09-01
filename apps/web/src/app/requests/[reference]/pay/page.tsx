import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { findRequestForStudents } from '@studdy/database';
import { Alert, Button, Card } from '@studdy/design-system';
import { formatLessonDateTime, formatMoney } from '@/components/requests/request-status';
import { PLATFORM_TIME_ZONE } from '@/lib/time';
import { resolveDiscoveryContext } from '@/lib/discovery/context';
import { startPaymentForRequest } from '@/lib/payments/payment-actions';
import { refusalMessage } from '@/lib/payments/refusal';
import { PaymentForm } from './payment-form';

export const metadata = { title: 'Pay for your lesson' };

/**
 * THE PARENT'S PAYMENT PAGE.
 *
 * Small and functional — the cohesive visual pass is deferred. What it must get
 * right is honesty about two things: what is being charged, and what has and has
 * not happened yet.
 *
 * NOTHING ON THIS PAGE DECIDES AN AMOUNT. Every figure is rendered from the
 * server-prepared payment, which computed it from the tutor's service version.
 * The Payment Element is driven by a client secret for an intent whose sum was
 * fixed before this page rendered.
 *
 * PAYING IS NOT BOOKING, and the copy says so before the parent pays and again
 * after. The booking transition is webhook-authoritative and lands in a later
 * slice; this page never writes it.
 */
export default async function PayPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}): Promise<React.JSX.Element> {
  const { reference } = await params;
  const context = await resolveDiscoveryContext();
  if (context === null)
    redirect(`/sign-in?next=${encodeURIComponent(`/requests/${reference}/pay`)}`);

  const request = await findRequestForStudents(
    reference,
    context.students.map((student) => student.studentProfileId),
  );
  // Not theirs and not existing are the same answer, deliberately.
  if (request === null) notFound();

  const winner = request.tutorRequests.find((entry) => entry.statusCode === 'selected') ?? null;

  /*
   * ALREADY BOOKED, SO THERE IS NOTHING TO PAY — and this is checked BEFORE
   * `startPaymentForRequest`, which would otherwise refuse with
   * `not_awaiting_payment` and tell a family whose lesson is confirmed that
   * their lesson "cannot be paid for". Both sentences are true and only one is
   * useful.
   *
   * `fulfilled` on the ILR is the authoritative record that the webhook
   * confirmed the booking. This page reads it; it has never had a write path,
   * and reaching it from a Stripe return URL still fulfils nothing.
   */
  if (request.statusCode === 'fulfilled') {
    const bookedStartAt = winner?.offeredTimes.find(
      (option) => option.statusCode === 'claimed',
    )?.startAt;
    return (
      <section className="space-y-6">
        <h1 className="text-2xl font-semibold">This lesson is booked</h1>
        <Alert tone="success" title="Your payment went through">
          {winner?.tutorFirstName ?? 'Your tutor'} has this time reserved for you
          {bookedStartAt === undefined
            ? ''
            : ` on ${formatLessonDateTime(bookedStartAt, PLATFORM_TIME_ZONE)}`}
          . Nothing else is needed from you.
        </Alert>
        <Button asChild variant="secondary">
          <Link href={`/requests/${reference}`}>Back to your request</Link>
        </Button>
      </section>
    );
  }

  const session = await startPaymentForRequest(reference);

  if (!session.ok) {
    return (
      <section className="space-y-6">
        <h1 className="text-2xl font-semibold">This lesson cannot be paid for</h1>
        <Alert tone="warning" title="Payment not available">
          {refusalMessage(session.reason)}
        </Alert>
        <Button asChild variant="secondary">
          <Link href={`/requests/${reference}`}>Back to your request</Link>
        </Button>
      </section>
    );
  }

  /*
   * A SUCCEEDED PAYMENT IS NOT YET A BOOKING. The parent is told their money
   * arrived and that confirmation follows — never that the lesson is booked,
   * because nothing in this slice writes that.
   */
  if (session.alreadySucceeded) {
    return (
      <section className="space-y-6">
        <h1 className="text-2xl font-semibold">Payment received</h1>
        <Alert tone="success" title="We are confirming your booking">
          Your payment has gone through. Studdy is confirming the booking with your tutor now — this
          page updates itself, and you will get an email once it is confirmed.
        </Alert>
        <Button asChild variant="secondary">
          <Link href={`/requests/${reference}`}>Back to your request</Link>
        </Button>
      </section>
    );
  }

  const deadline = new Date(session.paymentDeadlineAt);
  /*
   * The time the tutor actually claimed. `claimed` is the accepted state in the
   * family projection; falling back to the first offered time would risk
   * showing a parent a slot they are not being charged for.
   */
  const startAt = winner?.offeredTimes.find((option) => option.statusCode === 'claimed')?.startAt;
  const money = (minor: string): string => formatMoney(BigInt(minor), session.currencyCode);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Pay for your lesson</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Your tutor is holding this time for you until the deadline below.
        </p>
      </header>

      {/*
        THE MOST IMPORTANT SENTENCE ON THE PAGE, and it is shown BEFORE payment
        rather than only after. A family should never be able to say they
        thought the lesson was booked when it was not.
      */}
      <Alert tone="information" title="This lesson is not booked until your payment succeeds">
        Nothing is confirmed while this page is open. If the payment does not go through before the
        deadline, the time is released to other families.
      </Alert>

      <Card>
        <h2 className="text-base font-semibold">What you are paying for</h2>
        <dl className="mt-3 space-y-2 text-sm">
          {winner === null ? null : (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Tutor</dt>
              <dd>{winner.tutorFirstName}</dd>
            </div>
          )}
          {startAt === undefined ? null : (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">When</dt>
              <dd>{formatLessonDateTime(startAt, PLATFORM_TIME_ZONE)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Length</dt>
            <dd>{request.durationMinutes} minutes</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Format</dt>
            <dd>{request.formatCode === 'online' ? 'Online' : 'In person'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Lesson price</dt>
            <dd>{money(session.lessonAmountMinor)}</dd>
          </div>
          {/*
            NO STUDDY FEE LINE, and its absence is the product decision rather
            than an omission. Studdy's commission comes OUT OF the tutor's
            listed price, so the parent's total is exactly the price they were
            shown when they chose the tutor. Itemising a fee they are not being
            charged would invent a cost and make $40 look like it might not be
            $40. The tutor sees the split on their own side.
          */}
          <div className="flex justify-between gap-4 border-t pt-2 font-semibold">
            <dt>Total to pay</dt>
            <dd>{money(session.totalChargedMinor)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Pay by</dt>
            <dd>{formatLessonDateTime(deadline, PLATFORM_TIME_ZONE)}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="mb-3 text-base font-semibold">Card details</h2>
        <PaymentForm
          clientSecret={session.clientSecret}
          returnUrl={`${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/requests/${reference}/pay`}
        />
      </Card>
    </section>
  );
}
