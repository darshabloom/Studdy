import Link from 'next/link';
import { Alert, Button, Card } from '@studdy/design-system';
import { DemoPage } from '@/components/demo/demo-page';
import { JourneyShell } from '@/components/journey/journey-shell';
import { JourneySummary } from '@/components/journey/journey-summary';
import { DEMO_DURATION_MINUTES, DEMO_FAMILY } from '@/lib/demo/fixtures';
import { DEMO_PARENT_STEPS } from '@/lib/demo/steps';
import { demoSections } from '@/lib/demo/journey';
import { demoStory } from '@/lib/demo/story';

export const metadata = { title: 'Check this over before you send' };

/**
 * THE PARENT REVIEW STEP.
 *
 * The summary here is the SAME component the parent has watched grow down the
 * right-hand side of every previous screen, rendered `bare` — deliberately not
 * a new presentation invented for the last screen. A different-looking summary
 * at the moment of committing invites the question "is this the same request?",
 * which is exactly the question a review screen exists to answer.
 *
 * `JourneyShell` drops its own summary panel when no section is current, so the
 * answers appear once rather than twice side by side.
 */
export default function DemoReviewPage() {
  const story = demoStory();
  const sections = demoSections(story, null, {
    format: 'online',
    durationMinutes: DEMO_DURATION_MINUTES,
    times: story.offered,
  });

  return (
    <DemoPage steps={DEMO_PARENT_STEPS} current="review">
      <JourneyShell
        sections={sections}
        title="Check this over before you send"
        description={`Nothing is booked yet. ${story.tutor.firstName} will be asked, and can accept one of your times or decline.`}
        summaryTitle="Your request"
        summaryCaption="This is what will be sent."
        backHref="/demo/parent/book/times"
      >
        <Card>
          <h2 className="mb-1 text-sm font-semibold text-text-primary">Your request</h2>
          <JourneySummary sections={sections} title="Your request" caption="" bare />
        </Card>

        <Card className="mt-4" tone="secondary">
          <h2 className="text-sm font-semibold text-text-primary">
            Anything {story.tutor.firstName} should know?
          </h2>
          <p className="mt-2 text-sm text-text-secondary">{DEMO_FAMILY.notesForTutors}</p>
        </Card>

        <div className="mt-4">
          <Alert tone="information" title="This will add a subject">
            {DEMO_FAMILY.subjectDisplayName} will be added to{' '}
            {DEMO_FAMILY.studentPreferredName}&rsquo;s subjects when you send this request.
          </Alert>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button size="lg" asChild>
            <Link href="/demo/parent/request">Send this request</Link>
          </Button>
          <p className="text-sm text-text-secondary">
            You are asking, not booking. Nothing is charged.
          </p>
        </div>
      </JourneyShell>
    </DemoPage>
  );
}
