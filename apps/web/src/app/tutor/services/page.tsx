import Link from 'next/link';
import { listServicesForTutor } from '@studdy/database';
import { Alert, Button, Card, EmptyState, StatusBadge } from '@studdy/design-system';
import { ServiceSummary } from '@/components/tutors/service-summary';
import {
  SERVICE_STATUS_FAMILY,
  SERVICE_STATUS_HELP,
  SERVICE_STATUS_LABEL,
  tutorNoticeCopy,
} from '@/lib/tutors/service-status';
import { requireTutor } from '@/lib/tutors/tutor-session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your services' };

/**
 * A tutor's services: what they offer, and where each one is on the way to being
 * on sale.
 *
 * `requireTutor` is called HERE, not left to the workspace layout: a page's data
 * fetch runs alongside its layout rather than after it.
 */
export default async function TutorServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const actor = await requireTutor('/tutor/services');
  const services = await listServicesForTutor(actor.tutorProfileId);
  const notice = tutorNoticeCopy((await searchParams).notice);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-brand-purple-deep">
            Your services
          </h1>
          <p className="mt-1 max-w-prose text-text-secondary">
            A service is what a family books. Studdy reviews each one before you can publish it.
          </p>
        </div>
        <Button asChild>
          <Link href="/tutor/services/new">Create a service</Link>
        </Button>
      </div>

      {notice !== null ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}

      {services.length === 0 ? (
        <EmptyState
          title="You have no services yet"
          description="Create your first service: the subject, the year levels, how you teach it, and what each lesson length costs."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {services.map((service) => (
            <li key={service.reference}>
              <Card className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{service.displayName}</h2>
                    <p className="mt-0.5 text-sm text-text-secondary">
                      {SERVICE_STATUS_HELP[service.status]}
                    </p>
                    {service.replacesReference !== null ? (
                      <p className="mt-0.5 text-sm text-text-secondary">
                        These are changes to a service you already have. It stays as it is until you
                        publish this one.
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge family={SERVICE_STATUS_FAMILY[service.status]}>
                    {SERVICE_STATUS_LABEL[service.status]}
                  </StatusBadge>
                </div>
                <ServiceSummary {...service} />
                <div>
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/tutor/services/${service.reference}`}>
                      Open {service.displayName}
                    </Link>
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
