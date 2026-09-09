import { ParentShell } from '@/components/demo/demo-shells';
import { ChoiceRows, JourneyProgress } from '@/components/demo/demo-journey';
import { Panel, PanelBody, PanelHead } from '@/components/demo/kit';
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
        <Panel>
          <PanelHead title="How long should the lesson be?" meta="Step 2 of 3" />
          <PanelBody className="py-5">
            <p className="mb-5 text-[13.5px] text-text-muted">
              {story.tutor.firstName} sets a price for each length he offers.
            </p>
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
          </PanelBody>
        </Panel>
      </div>
    </ParentShell>
  );
}
