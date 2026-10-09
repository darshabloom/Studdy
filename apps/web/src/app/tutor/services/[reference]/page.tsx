import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  listSubjects,
  serviceForTutor,
  tutorOwnProfile,
  tutorPublicationFacts,
} from '@studdy/database';
import { Alert, Button, Card, StatusBadge } from '@studdy/design-system';
import {
  ARCHIVABLE_SERVICE_STATUSES,
  EDITABLE_SERVICE_STATUSES,
  PUBLISHABLE_SERVICE_STATUSES,
  REVISABLE_SERVICE_STATUSES,
  type ServiceStatus,
} from '@studdy/domain/tutors';
import { ServiceForm } from '@/components/tutors/service-form';
import { ServiceSummary } from '@/components/tutors/service-summary';
import {
  publishServiceAction,
  removeServiceAction,
  reviseServiceAction,
  saveServiceAction,
  submitServiceAction,
  unpublishServiceAction,
  withdrawServiceAction,
} from '@/lib/tutors/service-actions';
import { serviceInputFromRecord } from '@/lib/tutors/service-form';
import {
  PUBLICATION_BLOCKER_COPY,
  SERVICE_STATUS_FAMILY,
  SERVICE_STATUS_HELP,
  SERVICE_STATUS_LABEL,
  tutorNoticeCopy,
} from '@/lib/tutors/service-status';
import { requireTutor } from '@/lib/tutors/tutor-session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your service' };

const REFERENCE = /^SERVICE-\d{8}$/;

const is = (statuses: readonly ServiceStatus[], status: ServiceStatus): boolean =>
  statuses.includes(status);

function ActionForm({
  action,
  reference,
  label,
  variant = 'primary',
  disabled = false,
}: {
  action: (formData: FormData) => Promise<void>;
  reference: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'quiet';
  disabled?: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="reference" value={reference} />
      <Button type="submit" variant={variant} disabled={disabled}>
        {label}
      </Button>
    </form>
  );
}

/**
 * One of the tutor's own services: what it says, where it is, and the one or two
 * things that can be done with it from there.
 *
 * The service is looked up by reference AND the tutor resolved from the session,
 * so another tutor's reference is simply not found. Every button posts to an
 * action that resolves the tutor again and re-checks the move under a lock; what
 * is shown here decides only which buttons are offered.
 */
export default async function TutorServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { reference } = await params;
  const actor = await requireTutor(`/tutor/services/${reference}`);
  if (!REFERENCE.test(reference)) notFound();

  const service = await serviceForTutor({ tutorProfileId: actor.tutorProfileId, reference });
  if (service === null) notFound();
  const profile = await tutorOwnProfile(actor.studdyUserId);
  if (profile === null) redirect('/tutor');

  const notice = tutorNoticeCopy((await searchParams).notice);
  const editable = is(EDITABLE_SERVICE_STATUSES, service.status);
  const publishable = is(PUBLISHABLE_SERVICE_STATUSES, service.status);
  const [subjects, publication] = await Promise.all([
    editable ? listSubjects() : Promise.resolve([]),
    publishable ? tutorPublicationFacts(actor.tutorProfileId) : Promise.resolve(null),
  ]);
  const payoutsBlock =
    publication !== null && publication.payoutsRequiredToPublish && !publication.canReceivePayments;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/tutor/services"
          className="text-sm font-medium text-brand-purple hover:underline"
        >
          ← Your services
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-semibold text-brand-purple-deep">
            {service.displayName}
          </h1>
          <StatusBadge family={SERVICE_STATUS_FAMILY[service.status]}>
            {SERVICE_STATUS_LABEL[service.status]}
          </StatusBadge>
        </div>
        <p className="mt-1 max-w-prose text-text-secondary">
          {SERVICE_STATUS_HELP[service.status]}
        </p>
      </div>

      {notice !== null ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}

      {service.replacesReference !== null ? (
        <Alert tone="information" title="These are changes to a service you already have">
          <Link
            href={`/tutor/services/${service.replacesReference}`}
            className="font-medium text-brand-purple hover:underline"
          >
            The current service
          </Link>{' '}
          stays exactly as it is until this one is approved and you publish it. Publishing this one
          replaces it.
        </Alert>
      ) : null}

      {service.status === 'changes_requested' && service.reviewerMessage !== null ? (
        <Alert tone="warning" title="Studdy has asked for changes">
          <span className="whitespace-pre-wrap">{service.reviewerMessage}</span>
        </Alert>
      ) : null}

      {editable ? (
        <>
          <Card>
            <ServiceForm
              initial={serviceInputFromRecord(service)}
              reference={service.reference}
              subjects={subjects}
              offersOnline={profile.offersOnline}
              offersInPerson={profile.offersInPerson}
              saveAction={saveServiceAction}
            />
          </Card>
          <Card className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Send it to Studdy</h2>
            <p className="text-sm text-text-secondary">
              Save your changes first. Studdy reviews what is saved, and you cannot edit the service
              while it is being reviewed.
            </p>
            <div className="flex flex-wrap gap-3">
              <ActionForm
                action={submitServiceAction}
                reference={service.reference}
                label={
                  service.status === 'changes_requested'
                    ? 'Send again for review'
                    : 'Send for review'
                }
              />
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <ServiceSummary {...service} />
        </Card>
      )}

      {service.status === 'pending_approval' ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Need to change something?</h2>
          <p className="text-sm text-text-secondary">
            Take it back out of review to edit it, then send it again.
          </p>
          <div>
            <ActionForm
              action={withdrawServiceAction}
              reference={service.reference}
              label="Take back out of review"
              variant="secondary"
            />
          </div>
        </Card>
      ) : null}

      {publishable ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Publish</h2>
          {payoutsBlock ? (
            <Alert tone="warning" title="Not yet">
              {PUBLICATION_BLOCKER_COPY.payouts_not_ready}{' '}
              <Link
                href="/tutor/payments"
                className="font-medium text-brand-purple hover:underline"
              >
                Set up payments
              </Link>
            </Alert>
          ) : (
            <p className="text-sm text-text-secondary">
              Once published, families can find this service and ask you for a lesson at the times
              in your availability.
            </p>
          )}
          <div>
            <ActionForm
              action={publishServiceAction}
              reference={service.reference}
              label="Publish this service"
              disabled={payoutsBlock}
            />
          </div>
        </Card>
      ) : null}

      {service.status === 'published' ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Take it off sale</h2>
          <p className="text-sm text-text-secondary">
            Families will no longer be able to ask for this service. Lessons already requested or
            booked are not affected, and you can publish it again at any time.
          </p>
          <div>
            <ActionForm
              action={unpublishServiceAction}
              reference={service.reference}
              label="Unpublish"
              variant="secondary"
            />
          </div>
        </Card>
      ) : null}

      {is(REVISABLE_SERVICE_STATUSES, service.status) ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Change this service</h2>
          <p className="text-sm text-text-secondary">
            A service Studdy has reviewed is not edited directly. You make your changes in a draft,
            Studdy reviews them, and this service stays as it is until you publish the new one.
          </p>
          <div>
            {service.revisionReference !== null ? (
              <Button asChild variant="secondary">
                <Link href={`/tutor/services/${service.revisionReference}`}>
                  Open your draft changes
                </Link>
              </Button>
            ) : (
              <ActionForm
                action={reviseServiceAction}
                reference={service.reference}
                label="Draft changes"
                variant="secondary"
              />
            )}
          </div>
        </Card>
      ) : null}

      {is(ARCHIVABLE_SERVICE_STATUSES, service.status) ? (
        <div>
          <ActionForm
            action={removeServiceAction}
            reference={service.reference}
            label="Remove this service"
            variant="quiet"
          />
        </div>
      ) : null}
    </div>
  );
}
