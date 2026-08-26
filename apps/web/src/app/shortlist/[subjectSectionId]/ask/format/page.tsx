import { redirect } from 'next/navigation';
import { AskShell } from '@/components/ask/ask-shell';
import { ChoiceEmpty, ChoiceList } from '@/components/booking/choice-list';
import { askHref, askStepIsReachable, type RawSearchParams } from '@/lib/ask/draft';
import { resolveAsk } from '@/lib/ask/resolve';
import { askRows } from '@/lib/ask/summary';

export const metadata = { title: 'Online or in person?' };

const COPY = {
  online: { title: 'Online', detail: 'A video lesson. Nobody travels.' },
  in_person: {
    title: 'In person',
    detail: 'You and the tutor arrange where, once a lesson is confirmed.',
  },
} as const;

/**
 * Always asked, even where only one format remains.
 *
 * One remaining format is a fact about what these tutors publish, not a
 * preference this family expressed — the same rule the single-tutor journey
 * follows. A family who needs someone in the room should meet that fact here,
 * while changing the length or the shortlist is still cheap.
 *
 * Only formats an otherwise-compatible tutor can deliver are offered: putting
 * "in person" on screen when nobody left teaches that way would be inviting the
 * family to empty their own request.
 */
export default async function AskFormatPage({
  params,
  searchParams,
}: {
  params: Promise<{ subjectSectionId: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { subjectSectionId } = await params;
  const ask = await resolveAsk(subjectSectionId, await searchParams);
  if (ask === null) {
    redirect(`/sign-in?next=${encodeURIComponent(`/shortlist/${subjectSectionId}/ask/format`)}`);
  }

  if (!askStepIsReachable('format', ask.nextStep)) {
    redirect(askHref(subjectSectionId, ask.nextStep, ask.params));
  }
  if (ask.params.duration === null) {
    redirect(askHref(subjectSectionId, 'length', {}));
  }

  const { formats } = ask;

  return (
    <AskShell
      step="format"
      subjectSectionId={subjectSectionId}
      params={ask.params}
      rows={askRows(ask)}
      title="Online or in person?"
      description={
        formats.length === 1
          ? 'This is the only way your shortlisted tutors teach this lesson. Confirm it works for you, or go back and change the length.'
          : 'One choice for the whole request. Tutors who cannot teach it that way are shown, not dropped.'
      }
    >
      <ChoiceList
        ariaLabel="Lesson format"
        choices={formats.map((choice) => ({
          key: choice.format,
          href: askHref(subjectSectionId, 'times', {
            duration: ask.params.duration,
            format: choice.format,
          }),
          title: COPY[choice.format].title,
          detail: `${COPY[choice.format].detail} ${String(choice.tutorCount)} of ${String(
            choice.ofTutors,
          )} ${choice.ofTutors === 1 ? 'tutor teaches' : 'tutors teach'} this lesson that way.`,
          selected: choice.format === ask.params.format,
        }))}
        empty={
          <ChoiceEmpty
            title="No tutor offers that lesson length any more"
            description="Go back and choose a different length."
          />
        }
      />
    </AskShell>
  );
}
