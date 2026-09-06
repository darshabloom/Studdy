import { ChoiceList } from '@/components/booking/choice-list';
import { DemoPage } from '@/components/demo/demo-page';
import { JourneyShell } from '@/components/journey/journey-shell';
import { EmptyState } from '@studdy/design-system';
import { formatLabel } from '@studdy/domain/discovery';
import { DEMO_PARENT_STEPS } from '@/lib/demo/steps';
import { demoSections } from '@/lib/demo/journey';
import { demoStory } from '@/lib/demo/story';

export const metadata = { title: 'How should the lesson happen?' };

/**
 * One question, one decision, and the row IS the link — the production pattern.
 * Links rather than a form means the back button stays honest and every point
 * in the journey has a shareable URL, which is what lets a reviewer jump
 * straight to a screenshot.
 */
export default function DemoFormatPage() {
  const story = demoStory();
  const sections = demoSections(story, 'format', {
    format: null,
    durationMinutes: null,
    times: [],
  });

  return (
    <DemoPage steps={DEMO_PARENT_STEPS} current="lesson">
      <JourneyShell
        sections={sections}
        title="How should the lesson happen?"
        description={`${story.tutor.firstName} teaches ${formatLabel(story.tutor.offersOnline, story.tutor.offersInPerson).toLowerCase()}.`}
        summaryTitle="Your request so far"
        summaryCaption="Nothing is sent until you review it."
        backHref="/demo/parent/tutors/aroha"
      >
        <ChoiceList
          ariaLabel="Lesson format"
          choices={[
            {
              key: 'online',
              href: '/demo/parent/book/length',
              title: 'Online',
              detail: 'Video lesson, shared whiteboard. Nothing to travel to.',
            },
            {
              key: 'in_person',
              href: '/demo/parent/book/length',
              title: 'In person',
              detail: `${story.tutor.firstName} travels within central Auckland.`,
            },
          ]}
          empty={<EmptyState title="No formats available" />}
        />
      </JourneyShell>
    </DemoPage>
  );
}
