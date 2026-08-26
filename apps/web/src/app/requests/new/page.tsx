import { redirect } from 'next/navigation';
import { resolveDiscoveryContext } from '@/lib/discovery/context';

interface SearchParams {
  section?: string;
}

/**
 * The old multi-tutor composer, folded into the shortlist journey.
 *
 * It had two problems the new journey exists to fix: it never established what
 * lesson was being requested, so tutors publishing different lengths each got a
 * different lesson from the same chosen start; and it defaulted the format to
 * online without asking, which could send an in-person-only tutor a lesson they
 * do not teach. Both were invisible to the family.
 *
 * Kept as a redirect rather than deleted because links to it may exist. Two
 * composers with two sets of rules is how a family ends up being told different
 * things depending which way they came in.
 */
export default async function LegacyNewRequestPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const context = await resolveDiscoveryContext();
  if (context === null) redirect('/sign-in?next=%2Ftutors');

  // The chosen times are deliberately NOT carried across: they were picked
  // against a lesson length nobody had chosen yet, so they are not answers to
  // the question this journey asks.
  const section = context.subjectSections.find(
    (candidate) => candidate.subjectSectionId === params.section,
  );

  redirect(section === undefined ? '/tutors' : `/shortlist/${section.subjectSectionId}/ask`);
}
