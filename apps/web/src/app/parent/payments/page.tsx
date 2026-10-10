import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button, StatusBadge } from '@studdy/design-system';
import type { FamilyPaymentView } from '@studdy/database';
import {
  PageHeader,
  Panel,
  Quiet,
  Section,
  TextLink,
  ViewTabs,
  shortDate,
} from '@/components/parent/kit';
import { formatDeadline, formatMoney } from '@/components/requests/request-status';
import { loadFamilyOverview } from '@/lib/parent/load';
import {
  isSettledPayment,
  paymentStatus,
  paymentsDue,
  refundedPayments,
  totalPaid,
} from '@/lib/parent/overview';

export const metadata = { title: 'Payments' };

const VIEWS = ['overview', 'history', 'refunds', 'methods'] as const;
type View = (typeof VIEWS)[number];

/**
 * One payment, in the family's terms: what it was for, how much, and where the
 * money is now. There is deliberately nothing here about how the amount is
 * divided after it is paid — the view this is built from does not carry it.
 */
function PaymentRow({ payment }: { payment: FamilyPaymentView }) {
  const status = paymentStatus(payment);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-text-primary">
          {payment.subjectDisplayName} with {payment.tutorFirstName} for{' '}
          {payment.studentPreferredName}
        </p>
        <p className="mt-px text-sm text-text-secondary">
          {shortDate(payment.succeededAt ?? payment.createdAt, payment.timeZone)} ·{' '}
          <span className="tabular-nums">{payment.reference}</span>
          {payment.bookingReference !== null ? (
            <>
              {' '}
              ·{' '}
              <TextLink href={`/parent/bookings/${payment.bookingReference}`}>
                View booking
              </TextLink>
            </>
          ) : null}
        </p>
        <p className="text-sm text-text-secondary">{status.detail}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-semibold text-text-primary tabular-nums">
          {formatMoney(payment.totalChargedMinor, payment.currencyCode)}
        </span>
        <StatusBadge family={status.family}>{status.label}</StatusBadge>
      </div>
    </li>
  );
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const overview = await loadFamilyOverview();
  if (overview === null) redirect('/sign-in?next=%2Fparent%2Fpayments');

  const view: View = (VIEWS as readonly string[]).includes(params.view ?? '')
    ? (params.view as View)
    : 'overview';
  const now = new Date();
  const due = paymentsDue(overview.requests, now);
  // History is money that actually moved. An attempt that never completed took
  // nothing, and listing it beside real payments would read as a charge.
  const history = overview.payments.filter(isSettledPayment);
  const refunds = refundedPayments(overview.payments);
  const paid = totalPaid(overview.payments);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Payments" description="What you owe, what you have paid, and refunds." />

      <ViewTabs
        label="Payment views"
        current={view}
        tabs={[
          { key: 'overview', label: 'Overview', href: '/parent/payments', count: due.length },
          { key: 'history', label: 'History', href: '/parent/payments?view=history' },
          {
            key: 'refunds',
            label: 'Refunds & Credits',
            href: '/parent/payments?view=refunds',
          },
          { key: 'methods', label: 'Payment Methods', href: '/parent/payments?view=methods' },
        ]}
      />

      {view === 'overview' ? (
        <>
          <Section title="Due now">
            {due.length === 0 ? (
              <Quiet>
                Nothing to pay. You pay only after you choose a tutor who has accepted your request.
              </Quiet>
            ) : (
              <Panel>
                <ul className="divide-y divide-surface-border">
                  {due.map((item) => (
                    <li
                      key={item.requestReference}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary">
                          {item.subjectDisplayName} with {item.tutorFirstName} for{' '}
                          {item.studentPreferredName}
                        </p>
                        <p className="text-sm text-status-warning">
                          Pay by {formatDeadline(item.dueAt, item.timeZone)}. The lesson is not
                          booked until this is paid.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-text-primary tabular-nums">
                          {formatMoney(item.amountMinor, item.currencyCode)}
                        </span>
                        <Button size="sm" asChild>
                          <Link href={`/requests/${item.requestReference}/pay`}>Pay now</Link>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </Section>

          <div className="grid gap-4 sm:grid-cols-2">
            <Panel className="flex flex-col gap-1 p-5">
              <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">
                Paid for lessons
              </p>
              <p className="text-2xl font-semibold text-text-primary tabular-nums">
                {paid.length === 0
                  ? formatMoney(0n, 'NZD')
                  : paid
                      .map((total) => formatMoney(total.amountMinor, total.currencyCode))
                      .join(' + ')}
              </p>
              <TextLink href="/parent/payments?view=history">See payment history</TextLink>
            </Panel>
            <Panel className="flex flex-col gap-1 p-5">
              <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">
                Refunds
              </p>
              <p className="text-2xl font-semibold text-text-primary tabular-nums">
                {refunds.length}
              </p>
              <TextLink href="/parent/payments?view=refunds">See refunds</TextLink>
            </Panel>
          </div>
        </>
      ) : null}

      {view === 'history' ? (
        history.length === 0 ? (
          <Quiet>No payments yet.</Quiet>
        ) : (
          <Panel>
            <ul className="divide-y divide-surface-border">
              {history.map((payment) => (
                <PaymentRow key={payment.reference} payment={payment} />
              ))}
            </ul>
          </Panel>
        )
      ) : null}

      {view === 'refunds' ? (
        <>
          <Section title="Refunds">
            {refunds.length === 0 ? (
              <Quiet>No refunds.</Quiet>
            ) : (
              <Panel>
                <ul className="divide-y divide-surface-border">
                  {refunds.map((payment) => (
                    <PaymentRow key={payment.reference} payment={payment} />
                  ))}
                </ul>
              </Panel>
            )}
          </Section>
          <Section title="Credits">
            <Quiet>
              Studdy does not hold credit on your account. A refund always goes back to the card
              that was charged.
            </Quiet>
          </Section>
        </>
      ) : null}

      {view === 'methods' ? (
        <Quiet>
          Studdy does not keep a card on file yet. You enter your card each time you pay for a
          lesson, and it is handled by Stripe — Studdy never sees or stores the card number.
        </Quiet>
      ) : null}
    </div>
  );
}
