import { redirect } from 'next/navigation';
import { askHref, type RawSearchParams } from '@/lib/ask/draft';
import { resolveAsk } from '@/lib/ask/resolve';

/**
 * The entry to the optional multi-tutor journey.
 *
 * Redirects to the first question still genuinely open, exactly as `/book`
 * does, so a link into this journey never lands on a question already answered.
 */
export default async function AskEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ subjectSectionId: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { subjectSectionId } = await params;
  const ask = await resolveAsk(subjectSectionId, await searchParams);
  if (ask === null) {
    redirect(`/sign-in?next=${encodeURIComponent(`/shortlist/${subjectSectionId}/ask`)}`);
  }

  redirect(askHref(subjectSectionId, ask.nextStep, ask.params));
}
