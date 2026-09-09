import { ParentShell } from '@/components/demo/demo-shells';
import { ChoiceRows, JourneyProgress } from '@/components/demo/demo-journey';
import { Chip, Panel, PanelBody, PanelHead } from '@/components/demo/kit';
import { JACOB } from '@/lib/demo/fixtures';
import { discoveryStory } from '@/lib/demo/stories';

export const metadata = { title: 'How should the lesson happen?' };

export default function FindFormatPage() {
  const story = discoveryStory();
  return (
    <ParentShell active="/demo/parent/tutors">
      <JourneyProgress current="lesson" />
      <div className="mt-6">
        <Panel>
          <PanelHead
            title="How should the lesson happen?"
            meta="Step 1 of 3"
            action={
              <Chip tone="ghost">
                {JACOB.firstName} &middot; Year {JACOB.schoolYear} &middot; Physics
              </Chip>
            }
          />
          <PanelBody className="py-5">
            <p className="mb-5 text-[13.5px] text-text-muted">
              {story.tutor.firstName} teaches{' '}
              {story.tutor.offersOnline && story.tutor.offersInPerson
                ? 'online and in person'
                : story.tutor.offersOnline
                  ? 'online only'
                  : 'in person only'}
              .
            </p>
            <ChoiceRows
              choices={[
                {
                  key: 'online',
                  href: '/demo/parent/find/length',
                  title: 'Online',
                  detail: 'Video lesson with a shared whiteboard. Nothing to travel to.',
                },
                ...(story.tutor.offersInPerson
                  ? [
                      {
                        key: 'in_person',
                        href: '/demo/parent/find/length',
                        title: 'In person',
                        detail: `${story.tutor.firstName} travels within central Auckland.`,
                      },
                    ]
                  : []),
              ]}
            />
          </PanelBody>
        </Panel>
      </div>
    </ParentShell>
  );
}
