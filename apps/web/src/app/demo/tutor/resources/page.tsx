import { TutorShell } from '@/components/demo/demo-shells';
import { ComingSoon } from '@/components/demo/kit';

export const metadata = { title: 'Resources' };

export default function TutorResourcesPage() {
  return (
    <TutorShell active="/demo/tutor/resources">
      <ComingSoon title="Resources">
        Worksheets, past papers and the material you reuse between students. Not built yet — this
        page is here so the demo does not pretend the product is more finished than it is.
      </ComingSoon>
    </TutorShell>
  );
}
