import Link from 'next/link';
import { redirect } from 'next/navigation';
import { searchPublicTutors } from '@studdy/database';
import { Button } from '@studdy/design-system';
import { formatLabel, priceLabel, yearLevelRangeLabel } from '@studdy/domain/discovery';
import { schoolYearNumber } from '@studdy/domain/students';
import { BookingShell } from '@/components/booking/booking-shell';
import { ChoiceEmpty, ChoiceList } from '@/components/booking/choice-list';
import { bookingHref, type RawSearchParams } from '@/lib/booking/draft';
import { summaryRows } from '@/lib/booking/summary';
import { resolveBooking, stepIsReachable } from '@/lib/booking/resolve';

export const metadata = { title: 'Which tutor?' };

export default async function BookTutorPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const booking = await resolveBooking(raw);
  if (booking === null) redirect('/sign-in?next=%2Fbook');
  if (!stepIsReachable('tutor', booking.nextStep)) {
    redirect(bookingHref(booking.nextStep, booking.params));
  }

  const { student, subject, params } = booking;
  if (student === null || subject === null) redirect(bookingHref('child', {}));

  const tutors = await searchPublicTutors({
    subjectCode: null,
    schoolYearNumber:
      student.schoolYearCode === null ? null : schoolYearNumber(student.schoolYearCode),
    formatCode: null,
    maxPriceAmountMinor: null,
  });
  const forSubject = tutors.filter((tutor) => tutor.subjectDisplayName === subject.displayName);

  return (
    <BookingShell
      step="tutor"
      params={params}
      rows={summaryRows(booking)}
      title={`Who should teach ${subject.displayName}?`}
      description={`Tutors who teach ${subject.displayName} at ${student.preferredName}'s level.`}
    >
      <ChoiceList
        ariaLabel="Tutors"
        choices={forSubject.map((tutor) => ({
          key: tutor.tutorReference,
          // Changing the tutor drops the length: a version id belongs to one
          // tutor, and carrying it across would carry a price across too.
          href: bookingHref('length', {
            child: params.child,
            subject: params.subject,
            tutor: tutor.tutorReference,
          }),
          title: tutor.firstName,
          detail: [
            tutor.headline,
            yearLevelRangeLabel(tutor.yearLevelFrom, tutor.yearLevelTo),
            formatLabel(tutor.offersOnline, tutor.offersInPerson),
          ]
            .filter((part): part is string => part !== null && part !== '')
            .join(' · '),
          meta: `from ${priceLabel(tutor.startingPriceAmountMinor, tutor.currencyCode)}`,
          selected: tutor.tutorReference === params.tutor,
        }))}
        empty={
          <ChoiceEmpty
            title={`No tutors teach ${subject.displayName} at that level yet`}
            description="Try another subject, or browse everyone teaching on Studdy."
            action={
              <Button variant="secondary" asChild>
                <Link href="/tutors">Browse tutors</Link>
              </Button>
            }
          />
        }
      />

      <p className="mt-4 text-sm text-text-muted">
        Want to compare first?{' '}
        <Link href="/tutors" className="text-brand-purple hover:underline">
          Browse every tutor
        </Link>{' '}
        and come back — your answers so far are kept in the address bar.
      </p>
    </BookingShell>
  );
}
