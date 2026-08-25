import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@studdy/design-system';
import { schoolYearLabel } from '@studdy/domain/students';
import { BookingShell } from '@/components/booking/booking-shell';
import { ChoiceEmpty, ChoiceList } from '@/components/booking/choice-list';
import { bookingHref, paramsUpTo, type RawSearchParams } from '@/lib/booking/draft';
import { summaryRows } from '@/lib/booking/summary';
import { resolveBooking } from '@/lib/booking/resolve';

export const metadata = { title: 'Who is the lesson for?' };

export default async function BookChildPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const booking = await resolveBooking(raw);
  if (booking === null) redirect('/sign-in?next=%2Fbook');

  // A family with one child is not choosing between children. The answer is
  // already made, and shown in the summary; asking for it would be a screen
  // whose single option is the one already taken.
  if (booking.settled.has('child')) {
    redirect(bookingHref(booking.nextStep, paramsUpTo(booking.nextStep, booking.params)));
  }

  const { context, params } = booking;

  return (
    <BookingShell
      step="child"
      params={params}
      rows={summaryRows(booking)}
      title="Who is this lesson for?"
      description="Choose the student. Nothing is added to their profile until you send the request."
    >
      <ChoiceList
        ariaLabel="Students you can book for"
        choices={context.students.map((student) => ({
          key: student.studentProfileId,
          // Choosing a child clears everything downstream: a tutor picked for
          // one student's year level is not automatically right for another.
          href: bookingHref('subject', { child: student.studentProfileId }),
          title: student.preferredName,
          detail:
            student.schoolYearCode === null ? undefined : schoolYearLabel(student.schoolYearCode),
          selected: student.studentProfileId === params.child,
        }))}
        empty={
          <ChoiceEmpty
            title="Add a student first"
            description="A lesson request is always for a particular student, so we need to know who is learning before anything else."
            action={
              <Button asChild>
                <Link href="/parent/students/new">Add a student</Link>
              </Button>
            }
          />
        }
      />
    </BookingShell>
  );
}
