import { redirect } from 'next/navigation';
import { listSubjects } from '@studdy/database';
import { Alert } from '@studdy/design-system';
import { BookingShell } from '@/components/booking/booking-shell';
import { ChoiceEmpty, ChoiceList } from '@/components/booking/choice-list';
import { bookingHref, type RawSearchParams } from '@/lib/booking/draft';
import { resolveBooking, stepIsReachable } from '@/lib/booking/resolve';

export const metadata = { title: 'Which subject?' };

export default async function BookSubjectPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const booking = await resolveBooking(raw);
  if (booking === null) redirect('/sign-in?next=%2Fbook');
  if (!stepIsReachable('subject', booking.nextStep)) redirect(bookingHref('child', {}));

  const { student, params } = booking;
  if (student === null) redirect(bookingHref('child', {}));

  const subjects = await listSubjects();
  const alreadyStudying = new Set(
    booking.context.subjectSections
      .filter((section) => section.studentProfileId === student.studentProfileId)
      .map((section) => section.subjectId),
  );

  return (
    <BookingShell
      step="subject"
      nextStep={booking.nextStep}
      params={params}
      title={`What does ${student.preferredName} need help with?`}
      description="Pick a subject. If it is new, we will add it to their profile when you send the request — not before."
    >
      <ChoiceList
        ariaLabel="Subjects"
        choices={subjects.map((subject) => ({
          key: subject.subjectId,
          href: bookingHref('tutor', { child: params.child, subject: subject.subjectId }),
          title: subject.displayName,
          // Honest, and useful: it tells a parent which of these is already
          // part of this child's learning without implying the rest are barred.
          detail: alreadyStudying.has(subject.subjectId)
            ? `Already one of ${student.preferredName}'s subjects`
            : undefined,
          selected: subject.subjectId === params.subject,
        }))}
        empty={
          <ChoiceEmpty
            title="No subjects are available yet"
            description="Subjects are configured by Studdy. Please try again shortly."
          />
        }
      />

      {alreadyStudying.size === 0 ? (
        <div className="mt-4">
          <Alert tone="information" title="Nothing is saved yet">
            Choosing a subject here does not add it to {student.preferredName}&rsquo;s profile. That
            happens only if you send a request, and we will say so before you do.
          </Alert>
        </div>
      ) : null}
    </BookingShell>
  );
}
