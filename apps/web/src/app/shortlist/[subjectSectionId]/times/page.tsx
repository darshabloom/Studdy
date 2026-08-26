import { redirect } from 'next/navigation';

/**
 * The old shortlist-first times screen.
 *
 * It asked for times without ever establishing what lesson was being requested,
 * so a chosen start could mean a 60-minute lesson for one tutor and 90 for
 * another. The journey now settles the length and the format first, and this
 * forwards into it rather than leaving a second, older way in.
 */
export default async function LegacyShortlistTimesPage({
  params,
}: {
  params: Promise<{ subjectSectionId: string }>;
}) {
  const { subjectSectionId } = await params;
  redirect(`/shortlist/${subjectSectionId}/ask`);
}
