import Link from 'next/link';
import { Card, EmptyState, StatusBadge } from '@studdy/design-system';
import { reviewQueue } from '@studdy/database';
import { requireStaff } from '@/lib/auth/staff';
import {
  APPLICATION_STATUS_FAMILY,
  APPLICATION_STATUS_LABEL,
} from '@/lib/tutors/application-status';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tutor applications' };

const TOTAL_CHECKS = 4;

const dateFormat = new Intl.DateTimeFormat('en-NZ', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Pacific/Auckland',
});

/**
 * The review queue: applications waiting on a person, and those waiting on the
 * applicant after changes were asked for.
 *
 * `requireStaff` is called HERE, not left to the manager layout. A page's data
 * fetch runs alongside its layout rather than after it, so a layout's guard does
 * not stop a page loading personal data.
 */
export default async function TutorApplicationsPage() {
  await requireStaff('/manager/tutor-applications');
  const queue = await reviewQueue();

  const waiting = queue.filter((entry) => entry.status !== 'changes_requested');
  const withApplicant = queue.filter((entry) => entry.status === 'changes_requested');

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-semibold">Tutor applications</h1>
        <p className="mt-1 text-text-secondary">
          Oldest first. Open one to record your checks and decide.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Needs review ({waiting.length})</h2>
        {waiting.length === 0 ? (
          <EmptyState
            title="Nothing is waiting"
            description="New applications appear here as soon as they are submitted."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {waiting.map((entry) => (
              <li key={entry.reference}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{entry.preferredFirstName}</p>
                      <p className="text-sm text-text-secondary">{entry.headline}</p>
                      <p className="mt-1 text-xs text-text-muted">
                        {entry.reference} · revision {entry.revisionNumber}
                        {entry.submittedAt === null
                          ? ''
                          : ` · submitted ${dateFormat.format(entry.submittedAt)}`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge family={APPLICATION_STATUS_FAMILY[entry.status]}>
                        {APPLICATION_STATUS_LABEL[entry.status]}
                      </StatusBadge>
                      <span className="text-xs text-text-secondary">
                        {entry.verifiedChecks} of {TOTAL_CHECKS} checks verified
                      </span>
                      <Link
                        href={`/manager/tutor-applications/${entry.reference}`}
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

      {withApplicant.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">With the applicant ({withApplicant.length})</h2>
          <ul className="flex flex-col gap-3">
            {withApplicant.map((entry) => (
              <li key={entry.reference}>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{entry.preferredFirstName}</p>
                      <p className="text-xs text-text-muted">
                        {entry.reference} · revision {entry.revisionNumber}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge family={APPLICATION_STATUS_FAMILY[entry.status]}>
                        {APPLICATION_STATUS_LABEL[entry.status]}
                      </StatusBadge>
                      <Link
                        href={`/manager/tutor-applications/${entry.reference}`}
                        className="text-sm font-medium text-brand-purple hover:underline"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
