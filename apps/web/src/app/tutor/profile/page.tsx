import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listPublicServicesForTutor, tutorOwnProfile } from '@studdy/database';
import { Alert, Button, Card, StatusBadge } from '@studdy/design-system';
import { verificationLabel } from '@studdy/domain/discovery';
import { TUTOR_SELECTABLE_AVAILABILITY_LABELS } from '@studdy/domain/tutors';
import { ProfileForm } from '@/components/tutors/profile-form';
import {
  pauseListingAction,
  resumeListingAction,
  saveProfileAction,
} from '@/lib/tutors/service-actions';
import { tutorNoticeCopy } from '@/lib/tutors/service-status';
import { requireTutor } from '@/lib/tutors/tutor-session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your profile' };

/**
 * A tutor's own public profile: what families read about them, and whether they
 * are listed at all.
 *
 * The tutor is resolved from the session; there is no profile reference in the
 * URL to change. "Listed" here is the profile's own state. Being FOUND also needs
 * a published service, which the page says rather than implying a listed profile
 * is enough.
 */
export default async function TutorProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const actor = await requireTutor('/tutor/profile');
  const profile = await tutorOwnProfile(actor.studdyUserId);
  if (profile === null) redirect('/tutor');

  const notice = tutorNoticeCopy((await searchParams).notice);
  const onSale = await listPublicServicesForTutor(profile.reference);
  const visibleToFamilies = profile.listed && onSale.length > 0;
  const selectable = TUTOR_SELECTABLE_AVAILABILITY_LABELS as readonly string[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-brand-purple-deep">Your profile</h1>
        <p className="mt-1 max-w-prose text-text-secondary">
          What families read about you. Changes show on your public profile straight away.
        </p>
      </div>

      {notice !== null ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{profile.firstName}</h2>
            <p className="text-sm text-text-secondary">
              Families see your first name only. To change it, contact Studdy.
            </p>
          </div>
          <StatusBadge family={visibleToFamilies ? 'complete' : 'paused'}>
            {visibleToFamilies ? 'Visible to families' : 'Not visible to families'}
          </StatusBadge>
        </div>
        {profile.verificationLabels.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {profile.verificationLabels.map((label) => (
              <StatusBadge key={label} family="complete">
                {verificationLabel(label)}
              </StatusBadge>
            ))}
          </div>
        ) : null}
        {visibleToFamilies ? (
          <div>
            <Button asChild variant="secondary" size="sm">
              <Link href={`/tutors/${profile.reference}`}>View your public profile</Link>
            </Button>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">
            {profile.pausedByTutor
              ? 'You have paused your listing.'
              : !profile.listed
                ? 'Your profile is not listed at the moment. Contact Studdy if you were not expecting this.'
                : 'You appear in search once you have a published service.'}{' '}
            {profile.listed && onSale.length === 0 ? (
              <Link
                href="/tutor/services"
                className="font-medium text-brand-purple hover:underline"
              >
                Go to your services
              </Link>
            ) : null}
          </p>
        )}
      </Card>

      <Card>
        <ProfileForm
          initial={{
            headline: profile.headline ?? '',
            teachingApproach: profile.teachingApproach ?? '',
            yearLevelFrom: profile.yearLevelFrom === null ? '' : String(profile.yearLevelFrom),
            yearLevelTo: profile.yearLevelTo === null ? '' : String(profile.yearLevelTo),
            offersOnline: profile.offersOnline,
            offersInPerson: profile.offersInPerson,
            availabilityLabelCode: selectable.includes(profile.availabilityLabelCode)
              ? profile.availabilityLabelCode
              : 'accepting_new',
          }}
          saveAction={saveProfileAction}
        />
      </Card>

      {profile.pausedByTutor ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Your listing is paused</h2>
          <p className="text-sm text-text-secondary">
            Families cannot find you or ask for new lessons. Lessons already requested or booked are
            not affected.
          </p>
          <form action={resumeListingAction}>
            <Button type="submit">Resume my listing</Button>
          </form>
        </Card>
      ) : profile.listed ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Pause your listing</h2>
          <p className="text-sm text-text-secondary">
            Step back from new students without removing anything. You leave search and cannot be
            asked for new lessons until you resume. Lessons already requested or booked are not
            affected.
          </p>
          <form action={pauseListingAction}>
            <Button type="submit" variant="secondary">
              Pause my listing
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
