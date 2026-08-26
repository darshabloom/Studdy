import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@studdy/design-system';
import { AskShell } from '@/components/ask/ask-shell';
import { ChoiceEmpty, ChoiceList } from '@/components/booking/choice-list';
import { askHref, type RawSearchParams } from '@/lib/ask/draft';
import { resolveAsk } from '@/lib/ask/resolve';
import { askRows } from '@/lib/ask/summary';

export const metadata = { title: 'How long should the lesson be?' };

/**
 * The first question of the optional multi-tutor journey, and the one that
 * makes the request coherent.
 *
 * IT COMES FIRST FOR A REASON. One request is one lesson, so a chosen start has
 * to mean the same interval for every tutor asked about it. That is only
 * possible if the length is settled before anyone's availability is drawn —
 * asking for times first would mean redrawing them the moment a length was
 * picked, and asking each tutor for their own length would make the request
 * unanswerable.
 *
 * The counts beside each length say how much of the shortlist it reaches. They
 * are there to make the trade-off visible, NOT to make it: a family may quite
 * reasonably want ninety minutes with the one tutor who offers it.
 */
export default async function AskLengthPage({
  params,
  searchParams,
}: {
  params: Promise<{ subjectSectionId: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { subjectSectionId } = await params;
  const ask = await resolveAsk(subjectSectionId, await searchParams);
  // Signed out, or a section that is not this user's — the two are deliberately
  // indistinguishable here, exactly as elsewhere in the product.
  if (ask === null) {
    redirect(`/sign-in?next=${encodeURIComponent(`/shortlist/${subjectSectionId}/ask/length`)}`);
  }

  const { durations, section, studentName } = ask;

  return (
    <AskShell
      step="length"
      subjectSectionId={subjectSectionId}
      params={ask.params}
      rows={askRows(ask)}
      title="How long should the lesson be?"
      description={`One length for the whole request, so every tutor is asked about the same lesson.${
        studentName === null ? '' : ` For ${studentName}, ${section.subjectDisplayName}.`
      }`}
    >
      <ChoiceList
        ariaLabel="Lesson lengths"
        choices={durations.map((choice) => ({
          key: String(choice.durationMinutes),
          href: askHref(subjectSectionId, 'format', { duration: choice.durationMinutes }),
          title: `${String(choice.durationMinutes)} minutes`,
          // The honest denominator: shortlisted tutors who still offer this
          // subject at all, so a withdrawn tutor does not quietly inflate it.
          detail: `${String(choice.tutorCount)} of ${String(choice.ofTutors)} shortlisted ${
            choice.ofTutors === 1 ? 'tutor offers' : 'tutors offer'
          } this`,
          selected: choice.durationMinutes === ask.params.duration,
        }))}
        empty={
          <ChoiceEmpty
            title="None of your shortlisted tutors offers this subject right now"
            description="Their published lessons may have changed since you saved them. Add another tutor, or ask one of them on their own."
            action={
              <Button variant="secondary" asChild>
                <Link href={`/tutors?section=${subjectSectionId}`}>Find tutors</Link>
              </Button>
            }
          />
        }
      />
    </AskShell>
  );
}
