import { ParentShell } from '@/components/demo/demo-shells';
import { ChoiceRows, JourneyProgress } from '@/components/demo/demo-journey';
import { PageHead } from '@/components/demo/kit';
import { money } from '@/lib/demo/fixtures';
import { discoveryStory } from '@/lib/demo/stories';

export const metadata = { title: 'How long should the lesson be?' };

export default function FindLengthPage() {
  const story = discoveryStory();
  const hourly = story.tutor.hourlyMinor;
  return (
    <ParentShell active="/demo/parent/tutors">
      <JourneyProgress current="lesson" />
      <div className="mt-6">
        <PageHead
          eyebrow="Step 2 of 3"
          title="How long should the lesson be?"
          sub={`${story.tutor.firstName} sets a price for each length he offers.`}
        />
      </div>
      <div className="mt-7 max-w-xl">
        <ChoiceRows
          choices={[
            {
              key: '60',
              href: '/demo/parent/find/times',
              title: '60 minutes',
              detail: 'The usual first lesson.',
              meta: money(hourly),
            },
            {
              key: '90',
              href: '/demo/parent/find/times',
              title: '90 minutes',
              detail: 'More room when there is a lot of ground to cover.',
              meta: money((hourly * 3n) / 2n),
            },
          ]}
        />
      </div>
    </ParentShell>
  );
}
