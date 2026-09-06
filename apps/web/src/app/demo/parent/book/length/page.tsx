import { EmptyState } from '@studdy/design-system';
import { priceLabel } from '@studdy/domain/discovery';
import { ChoiceList } from '@/components/booking/choice-list';
import { DemoPage } from '@/components/demo/demo-page';
import { JourneyShell } from '@/components/journey/journey-shell';
import { DEMO_PARENT_STEPS } from '@/lib/demo/steps';
import { demoSections } from '@/lib/demo/journey';
import { demoStory } from '@/lib/demo/story';

export const metadata = { title: 'How long should the lesson be?' };

/**
 * The price sits on the row rather than in a note underneath, because length
 * and price are one decision — a parent choosing ninety minutes is choosing to
 * spend half as much again, and separating the two hides that.
 */
export default function DemoLengthPage() {
  const story = demoStory();
  const hourly = story.tutor.startingPriceAmountMinor;
  const sections = demoSections(story, 'length', {
    format: 'online',
    durationMinutes: null,
    times: [],
  });

  return (
    <DemoPage steps={DEMO_PARENT_STEPS} current="lesson">
      <JourneyShell
        sections={sections}
        title="How long should the lesson be?"
        description={`${story.tutor.firstName} sets a price for each length she offers.`}
        summaryTitle="Your request so far"
        summaryCaption="Nothing is sent until you review it."
        backHref="/demo/parent/book/format"
      >
        <ChoiceList
          ariaLabel="Lesson length"
          choices={[
            {
              key: '60',
              href: '/demo/parent/book/times',
              title: '60 minutes',
              detail: 'The usual first lesson.',
              meta: priceLabel(hourly, 'NZD'),
            },
            {
              key: '90',
              href: '/demo/parent/book/times',
              title: '90 minutes',
              detail: 'More room when there is a lot of ground to cover.',
              meta: priceLabel((hourly * 3n) / 2n, 'NZD'),
            },
          ]}
          empty={<EmptyState title="No lengths available" />}
        />
      </JourneyShell>
    </DemoPage>
  );
}
