import { TutorShell } from '@/components/demo/demo-shells';
import { ComingSoon } from '@/components/demo/kit';

export const metadata = { title: 'Earnings' };

export default function TutorEarningsPage() {
  return (
    <TutorShell active="/demo/tutor/earnings">
      <ComingSoon title="Earnings">
        Payouts, invoices and what Studdy has taken. Not built yet. The week&rsquo;s gross sits
        under the calendar on your Bookings page in the meantime.
      </ComingSoon>
    </TutorShell>
  );
}
