import Link from 'next/link';
import { notFound } from 'next/navigation';
import { serviceForReview } from '@studdy/database';
import { Alert, Button, Card, StatusBadge, TextareaField } from '@studdy/design-system';
import { formatLabel, yearLevelRangeLabel } from '@studdy/domain/discovery';
import { ServiceSummary } from '@/components/tutors/service-summary';
import { requireStaff } from '@/lib/auth/staff';
import { noticeCopy } from '@/lib/tutors/review-notices';
import {
  approveServiceAction,
  requestServiceChangesAction,
} from '@/lib/tutors/service-review-actions';
import { SERVICE_STATUS_FAMILY, SERVICE_STATUS_LABEL } from '@/lib/tutors/service-status';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Review a service' };

const REFERENCE = /^SERVICE-\d{8}$/;

const OUTCOME_LABEL: Readonly<Record<string, string>> = {
  pending: 'Waiting for a decision',
  approved: 'Approved',
  changes_requested: 'Changes requested',
  withdrawn: 'Taken back by the tutor',
};

const dateTime = new Intl.DateTimeFormat('en-NZ', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Pacific/Auckland',
});

/**
 * One service, with what a reviewer needs to decide it: what it says, who is
 * offering it, what it would replace, and what was decided before.
 *
 * `requireStaff` runs first, in the page itself. Both forms post to actions that
 * re-check staff and MFA again, and the decision is re-checked under a lock, so a
 * service the tutor has just taken back cannot be approved from a stale page.
 */
export default async function ReviewServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { reference } = await params;
  await requireStaff(`/manager/services/${reference}`);
  if (!REFERENCE.test(reference)) notFound();

  const review = await serviceForReview(reference);
  if (review === null) notFound();

  const notice = noticeCopy((await searchParams).notice);
  const { service, tutor, replaces } = review;
  const decidable = service.status === 'pending_approval';
  const earlier = review.history.filter((entry) => entry.outcome !== 'pending');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/manager/services"
          className="text-sm font-medium text-brand-purple hover:underline"
        >
          ← Service review
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-semibold">{service.displayName}</h1>
          <StatusBadge family={SERVICE_STATUS_FAMILY[service.status]}>
            {SERVICE_STATUS_LABEL[service.status]}
          </StatusBadge>
        </div>
        <p className="mt-1 text-xs text-text-muted">{service.reference}</p>
      </div>

      {notice !== null ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}

      <Card>
        <h2 className="text-lg font-semibold">What the tutor wants to offer</h2>
        <div className="mt-4">
          <ServiceSummary {...service} />
        </div>
      </Card>

      {replaces !== null ? (
        <Card tone="secondary">
          <h2 className="text-lg font-semibold">What it would replace</h2>
          <p className="mt-1 text-sm text-text-secondary">
            {replaces.displayName} ({replaces.reference}), currently{' '}
            {SERVICE_STATUS_LABEL[replaces.status].toLowerCase()}. It stays as it is until the tutor
            publishes this change.
          </p>
          <div className="mt-4">
            <ServiceSummary {...replaces} />
          </div>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-lg font-semibold">The tutor</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-text-secondary">Name families see</dt>
            <dd className="mt-0.5">
              {tutor.firstName} ({tutor.reference})
            </dd>
          </div>
          <div>
            <dt className="text-text-secondary">Headline</dt>
            <dd className="mt-0.5">{tutor.headline ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Year levels on their profile</dt>
            <dd className="mt-0.5">
              {yearLevelRangeLabel(tutor.yearLevelFrom, tutor.yearLevelTo)}
            </dd>
          </div>
          <div>
            <dt className="text-text-secondary">Formats on their profile</dt>
            <dd className="mt-0.5">{formatLabel(tutor.offersOnline, tutor.offersInPerson)}</dd>
          </div>
        </dl>
      </Card>

      {earlier.length > 0 ? (
        <Card>
          <h2 className="text-lg font-semibold">Earlier decisions</h2>
          <ul className="mt-4 flex flex-col gap-4">
            {earlier.map((entry) => (
              <li
                key={entry.submittedAt.toISOString()}
                className="border-t border-surface-border pt-4 text-sm first:border-t-0 first:pt-0"
              >
                <p className="font-medium">
                  {OUTCOME_LABEL[entry.outcome] ?? entry.outcome}
                  {entry.decidedAt === null ? '' : ` · ${dateTime.format(entry.decidedAt)}`}
                </p>
                {entry.tutorMessage !== null ? (
                  <p className="mt-1 whitespace-pre-wrap text-text-secondary">
                    To the tutor: {entry.tutorMessage}
                  </p>
                ) : null}
                {entry.internalNote !== null ? (
                  <p className="mt-1 whitespace-pre-wrap text-text-secondary">
                    Staff note: {entry.internalNote}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {decidable ? (
        <Card>
          <h2 className="text-lg font-semibold">Decision</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Check the subject, year levels, description, lengths, prices and format, and that the
            description makes no claim Studdy has not verified. Approving lets the tutor publish; it
            does not publish for them.
          </p>
          <div className="mt-4 flex flex-col gap-6">
            <form action={approveServiceAction} className="flex flex-col gap-2">
              <input type="hidden" name="reference" value={service.reference} />
              <TextareaField
                label="Your note (staff only, optional)"
                name="internalNote"
                rows={2}
              />
              <div>
                <Button type="submit">Approve this service</Button>
              </div>
            </form>

            <form action={requestServiceChangesAction} className="flex flex-col gap-2">
              <input type="hidden" name="reference" value={service.reference} />
              <TextareaField
                label="Ask for changes — your message to the tutor"
                name="message"
                rows={3}
                helper="The tutor will read this exactly as written."
              />
              <div>
                <Button type="submit" variant="secondary">
                  Request changes
                </Button>
              </div>
            </form>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
