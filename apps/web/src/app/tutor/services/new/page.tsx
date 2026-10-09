import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listSubjects, tutorOwnProfile } from '@studdy/database';
import { Card } from '@studdy/design-system';
import { EMPTY_TUTOR_SERVICE } from '@studdy/domain/tutors';
import { ServiceForm } from '@/components/tutors/service-form';
import { saveServiceAction } from '@/lib/tutors/service-actions';
import { requireTutor } from '@/lib/tutors/tutor-session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Create a service' };

export default async function NewTutorServicePage() {
  const actor = await requireTutor('/tutor/services/new');
  const profile = await tutorOwnProfile(actor.studdyUserId);
  if (profile === null) redirect('/tutor');
  const subjects = await listSubjects();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/tutor/services"
          className="text-sm font-medium text-brand-purple hover:underline"
        >
          ← Your services
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold text-brand-purple-deep">
          Create a service
        </h1>
        <p className="mt-1 max-w-prose text-text-secondary">
          It starts as a draft only you can see. When it is ready you send it to Studdy, and once it
          is approved you choose when to publish it.
        </p>
      </div>
      <Card>
        <ServiceForm
          initial={{
            ...EMPTY_TUTOR_SERVICE,
            // Start from what the profile says, which is usually what is wanted.
            yearLevelFrom: profile.yearLevelFrom === null ? '' : String(profile.yearLevelFrom),
            yearLevelTo: profile.yearLevelTo === null ? '' : String(profile.yearLevelTo),
            formatCode: profile.offersOnline ? 'online' : 'in_person',
          }}
          subjects={subjects}
          offersOnline={profile.offersOnline}
          offersInPerson={profile.offersInPerson}
          saveAction={saveServiceAction}
        />
      </Card>
    </div>
  );
}
