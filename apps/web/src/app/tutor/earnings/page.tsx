import Link from 'next/link';
import { tutorPayoutStatus } from '@studdy/database';
import { Button, StatusBadge } from '@studdy/design-system';
import {
  COMPACT,
  PageHeader,
  Panel,
  Quiet,
  Section,
  lessonDay,
  shortDate,
} from '@/components/parent/kit';
import { formatMoney } from '@/components/requests/request-status';
import { TutorUnavailable } from '@/components/tutor/kit';
import { loadTutorWorkspace } from '@/lib/tutor/load';
import { EARNING_LABELS, earningState, earningsSummary } from '@/lib/tutor/overview';

export const metadata = { title: 'Earnings' };

/**
 * What the tutor earns, and where each lesson's money is.
 *
 * EVERY FIGURE IS THE TUTOR'S SHARE — the lesson price less Studdy's fee —
 * because that is the number a tutor can plan on. The gross price appears only
 * beside it, per lesson, so the difference is visible rather than hidden.
 *
 * Nothing of the family's payment is here: not how they paid, not their
 * provider, not whether a card was declined on the way.
 */
export default async function TutorEarningsPage() {
  const workspace = await loadTutorWorkspace();
  if (workspace === null) return <TutorUnavailable />;

  const now = new Date();
  const payout = await tutorPayoutStatus(workspace.tutorProfileId);
  const summaries = earningsSummary(workspace.bookings, now);
  const summary = summaries[0] ?? {
    currencyCode: 'NZD',
    earnedMinor: 0n,
    pendingMinor: 0n,
    paidMinor: 0n,
    upcomingMinor: 0n,
  };
  const rows = workspace.bookings
    .map((booking) => ({ booking, state: earningState(booking, now) }))
    .filter((row) => row.state !== 'none')
    .sort((a, b) => b.booking.scheduledStartAt.getTime() - a.booking.scheduledStartAt.getTime());

  const tiles = [
    ['Earned', summary.earnedMinor, 'bg-parent-sky', 'Lessons whose time has passed'],
    ['Pending', summary.pendingMinor, 'bg-parent-gold-pale', 'Earned, not yet paid out'],
    ['Paid out', summary.paidMinor, 'bg-parent-cream', 'Sent to your payout account'],
    [
      'Expected',
      summary.upcomingMinor,
      'bg-surface-card-secondary',
      'Booked lessons still to come',
    ],
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Earnings"
        description="What you earn after Studdy’s fee. Payouts are sent weekly, after a lesson has taken place."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([label, amount, tint, note]) => (
          <div key={label} className={`rounded-[var(--radius-medium)] px-4 py-3 ${tint}`}>
            <p className="text-xs font-medium text-text-secondary">{label}</p>
            <p className="text-xl font-semibold text-text-primary tabular-nums">
              {formatMoney(amount, summary.currencyCode)}
            </p>
            <p className="text-xs text-text-secondary">{note}</p>
          </div>
        ))}
      </div>

      <Panel className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">
            Payout status
          </p>
          <p className="text-sm text-text-primary">
            {payout.canReceivePayments
              ? 'You are set up to be paid.'
              : payout.status === 'not_onboarded'
                ? 'Payout setup has not been started. Families cannot pay for a lesson with you until it is finished.'
                : 'Payout setup is not finished yet. Families cannot pay for a lesson with you until it is.'}
          </p>
        </div>
        <Button variant="secondary" className={COMPACT} asChild>
          <Link prefetch={false} href="/tutor/payments">
            {payout.canReceivePayments ? 'Payout details' : 'Finish payout setup'}
          </Link>
        </Button>
      </Panel>

      <Section title="By lesson">
        {rows.length === 0 ? (
          <Quiet>No earnings yet. A lesson appears here once a family has booked and paid.</Quiet>
        ) : (
          <Panel className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-surface-border bg-surface-card-secondary text-xs font-semibold text-text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2">
                    Lesson
                  </th>
                  <th scope="col" className="px-4 py-2">
                    Student
                  </th>
                  <th scope="col" className="px-4 py-2 text-right">
                    Price
                  </th>
                  <th scope="col" className="px-4 py-2 text-right">
                    You earn
                  </th>
                  <th scope="col" className="px-4 py-2">
                    Payout
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {rows.map(({ booking, state }) => {
                  const label = EARNING_LABELS[state];
                  return (
                    <tr key={booking.reference}>
                      <td className="px-4 py-3">
                        <Link
                          prefetch={false}
                          href={`/tutor/lessons/${booking.reference}`}
                          className="font-medium text-text-primary hover:underline"
                        >
                          {lessonDay(booking.scheduledStartAt, booking.timeZone)}
                        </Link>
                        <p className="text-text-secondary">{booking.subjectDisplayName}</p>
                      </td>
                      <td className="px-4 py-3">{booking.studentPreferredName}</td>
                      <td className="px-4 py-3 text-right text-text-secondary tabular-nums">
                        {formatMoney(booking.lessonAmountMinor, booking.currencyCode)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {formatMoney(booking.earnsMinor, booking.currencyCode)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge family={label.family}>{label.label}</StatusBadge>
                        {booking.payoutSentAt !== null ? (
                          <span className="ml-2 text-text-secondary">
                            {shortDate(booking.payoutSentAt, booking.timeZone)}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        )}
      </Section>
    </div>
  );
}
