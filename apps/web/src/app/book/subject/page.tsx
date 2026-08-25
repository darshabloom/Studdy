import { redirect } from 'next/navigation';
import { listSubjects } from '@studdy/database';
import { BookingShell } from '@/components/booking/booking-shell';
import { ChoiceEmpty, ChoiceList } from '@/components/booking/choice-list';
import { bookingHref, type RawSearchParams } from '@/lib/booking/draft';
import { summaryRows } from '@/lib/booking/summary';
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
      params={params}
      rows={summaryRows(booking)}
      title={`What does ${student.preferredName} need help with?`}
      /**
       * Said once, quietly, next to the question.
       *
       * This used to be a full callout as well. Two notices making the same
       * promise, on a screen where nothing is at stake yet, gave the moment far
       * more weight than it has — the parent is picking a subject, not
       * authorising a change. The prominent notice belongs on Review, where the
       * write is genuinely about to happen, and that is where it stays.
       */
      description={`Pick a subject. A new one is added to ${student.preferredName}'s profile only when you send the request.`}
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
    </BookingShell>
  );
}
