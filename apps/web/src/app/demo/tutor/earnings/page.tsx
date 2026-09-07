import { TutorShell } from '@/components/demo/demo-shells';
import { SkeletonPreview } from '@/components/demo/demo-skeleton';
import {
  Chip,
  Fact,
  Facts,
  Panel,
  PanelBody,
  PanelHead,
  Row,
  RowList,
  RowMain,
  RowMeta,
  Stat,
} from '@/components/demo/kit';
import { COMMISSION_RATE, money, priceFor } from '@/lib/demo/fixtures';

export const metadata = { title: 'Earnings' };

const keep = (minor: bigint): bigint => BigInt(Math.round(Number(minor) * (1 - COMMISSION_RATE)));
const fee = (minor: bigint): bigint => minor - keep(minor);

const PAYMENTS = [
  { student: 'Jacob', when: 'Tue 8 Sept', minutes: 60 },
  { student: 'Leo', when: 'Wed 9 Sept', minutes: 90 },
  { student: 'Sophie', when: 'Thu 10 Sept', minutes: 60 },
  { student: 'Mia', when: 'Mon 7 Sept', minutes: 60 },
];

const PAYOUTS = [
  { period: '25 Aug – 31 Aug', lessons: 5, gross: 30500n },
  { period: '18 Aug – 24 Aug', lessons: 4, gross: 25000n },
  { period: '11 Aug – 17 Aug', lessons: 5, gross: 30500n },
];

/**
 * Not built — and shown rather than described.
 *
 * The figures are computed from the same rate card every other screen uses, so
 * even the mock-up cannot contradict what a lesson costs. Studdy's commission
 * is shown as coming OUT OF the listed price, which is the arrangement the
 * parent-facing screens already describe.
 */
export default function TutorEarningsPage() {
  const weekGross = PAYMENTS.reduce((total, payment) => total + priceFor(payment.minutes), 0n);

  return (
    <TutorShell active="/demo/tutor/earnings">
      <header>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-[30px] font-semibold leading-tight tracking-[-0.018em] text-text-primary">
            Earnings
          </h1>
          <Chip tone="ghost">Coming soon</Chip>
        </div>
        <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-text-secondary">
          What you have earned, what Studdy has taken, and when it reaches your account. Below is
          what it will look like &mdash; the week&rsquo;s total is on your Bookings page in the
          meantime.
        </p>
      </header>

      <SkeletonPreview>
        <Panel>
          <PanelHead title="This week" meta="4 lessons" />
          <PanelBody>
            <div className="flex flex-wrap gap-x-10 gap-y-5">
              <Stat label="Earned" value={money(keep(weekGross))} size="lg" detail="after fees" />
              <Stat label="Lesson value" value={money(weekGross)} size="lg" detail="charged to families" />
              <Stat label="Studdy fee" value={money(fee(weekGross))} size="lg" detail="15% of listed price" />
            </div>
            <div className="mt-5 border-t border-surface-border pt-4">
              <Facts>
                <Fact label="Next payout" value="Monday 14 September" />
                <Fact label="To" value="•••• 4821" />
              </Facts>
            </div>
          </PanelBody>
        </Panel>

        <div className="mt-5">
          <Panel>
            <PanelHead title="Lesson payments" meta="This week" />
            <PanelBody className="py-1">
              <RowList>
                {PAYMENTS.map((payment) => {
                  const gross = priceFor(payment.minutes);
                  return (
                    <Row key={payment.student}>
                      <RowMain
                        name={payment.student}
                        detail={`${payment.when} · ${String(payment.minutes)} min`}
                      />
                      <Chip tone="neutral">Paid</Chip>
                      <RowMeta>
                        {money(keep(gross))}
                        <span className="mt-0.5 block text-text-muted">
                          {money(gross)} less {money(fee(gross))}
                        </span>
                      </RowMeta>
                    </Row>
                  );
                })}
              </RowList>
            </PanelBody>
          </Panel>
        </div>

        <div className="mt-5">
          <Panel tone="quiet">
            <PanelHead title="Payout history" meta="Last 3 weeks" />
            <PanelBody className="py-1">
              <RowList>
                {PAYOUTS.map((payout) => (
                  <Row key={payout.period}>
                    <RowMain
                      name={payout.period}
                      detail={`${String(payout.lessons)} lessons · settled`}
                    />
                    <Chip tone="neutral">Settled</Chip>
                    <RowMeta>{money(keep(payout.gross))}</RowMeta>
                  </Row>
                ))}
              </RowList>
            </PanelBody>
          </Panel>
        </div>
      </SkeletonPreview>
    </TutorShell>
  );
}
