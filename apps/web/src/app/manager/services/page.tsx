import Link from 'next/link';
import { serviceReviewQueue } from '@studdy/database';
import { Card, EmptyState, StatusBadge } from '@studdy/design-system';
import { requireStaff } from '@/lib/auth/staff';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Service review' };

const dateFormat = new Intl.DateTimeFormat('en-NZ', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Pacific/Auckland',
});

/**
 * Services waiting on a reviewer. Every new service, and every change to a
 * reviewed one, passes through here before its tutor can publish it.
 *
 * `requireStaff` is called HERE, not left to the manager layout: a page's data
 * fetch runs alongside its layout rather than after it.
 */
export default async function ServiceReviewQueuePage() {
  await requireStaff('/manager/services');
  const queue = await serviceReviewQueue();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Service review</h1>
        <p className="mt-1 text-text-secondary">
          Oldest first. A tutor cannot publish a service until it is approved here.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Needs review ({queue.length})</h2>
        {queue.length === 0 ? (
          <EmptyState
            title="Nothing is waiting"
            description="Services appear here as soon as a tutor sends one for review."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {queue.map((entry) => (
              <li key={entry.reference}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{entry.displayName}</p>
                      <p className="text-sm text-text-secondary">
                        {entry.subjectDisplayName} · {entry.tutorFirstName} ({entry.tutorReference})
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        {entry.reference}
                        {entry.submittedAt === null
                          ? ''
                          : ` · sent ${dateFormat.format(entry.submittedAt)}`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge family="pending">
                        {entry.isRevision ? 'Change to a service' : 'New service'}
                      </StatusBadge>
                      <Link
                        href={`/manager/services/${entry.reference}`}
                        className="text-sm font-medium text-brand-purple hover:underline"
                      >
                        Review
                      </Link>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
