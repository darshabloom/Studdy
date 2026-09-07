import { ParentShell } from '@/components/demo/demo-shells';
import { ChoiceRows, JourneyProgress } from '@/components/demo/demo-journey';
import { PageHead } from '@/components/demo/kit';
import { JACOB } from '@/lib/demo/fixtures';
import { discoveryStory } from '@/lib/demo/stories';

export const metadata = { title: 'How should the lesson happen?' };

export default function FindFormatPage() {
  const story = discoveryStory();
  return (
    <ParentShell active="/demo/parent/tutors">
      <JourneyProgress current="lesson" />
      <div className="mt-6">
        <PageHead
          eyebrow="Step 1 of 3"
          title="How should the lesson happen?"
          sub={`${story.tutor.firstName} teaches ${story.tutor.offersOnline && story.tutor.offersInPerson ? 'online and in person' : story.tutor.offersOnline ? 'online only' : 'in person only'}.`}
        />
      </div>
      <div className="mt-7 max-w-xl">
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
      </div>
      <p className="mt-6 text-[13px] text-text-muted">
        For {JACOB.firstName} &middot; Year {JACOB.schoolYear} &middot; Physics
      </p>
    </ParentShell>
  );
}
