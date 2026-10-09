import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, Button, Card, StatusBadge, TextareaField } from '@studdy/design-system';
import { applicationForReview } from '@studdy/database';
import { DECIDABLE_APPLICATION_STATUSES, type ApplicationCheckStatus } from '@studdy/domain/tutors';
import { requireStaff } from '@/lib/auth/staff';
import {
  APPLICATION_STATUS_FAMILY,
  APPLICATION_STATUS_LABEL,
  CHECK_HELP,
  CHECK_LABEL,
} from '@/lib/tutors/application-status';
import {
  approveApplicationAction,
  recordCheckAction,
  rejectApplicationAction,
  requestChangesAction,
} from '@/lib/tutors/review-actions';
import { noticeCopy } from '@/lib/tutors/review-notices';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Review a tutor application' };

const REFERENCE = /^APP-\d{8}$/;

const CHECK_STATUS_FAMILY = {
  pending: 'pending',
  verified: 'complete',
  failed: 'failed',
} as const;

const CHECK_STATUS_LABEL: Record<ApplicationCheckStatus, string> = {
  pending: 'Not yet checked',
  verified: 'Verified',
  failed: 'Failed',
};

const dateTime = new Intl.DateTimeFormat('en-NZ', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Pacific/Auckland',
});

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap">{children}</dd>
    </div>
  );
}

/**
 * One application, with everything a reviewer needs and the controls to decide it.
 *
 * `requireStaff` runs first, in the page itself, because this page loads an
 * applicant's personal data and a layout's guard does not stop a page's fetch.
 * Every form below posts to an action that re-checks staff and MFA again.
 */
export default async function ReviewApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { reference } = await params;
  await requireStaff(`/manager/tutor-applications/${reference}`);
  if (!REFERENCE.test(reference)) notFound();

  const review = await applicationForReview(reference);
  if (review === null) notFound();

  const notice = noticeCopy((await searchParams).notice);
  const decidable = (DECIDABLE_APPLICATION_STATUSES as readonly string[]).includes(review.status);
  const { form } = review;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/manager/tutor-applications"
          className="text-sm font-medium text-brand-purple hover:underline"
        >
          ← All applications
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-semibold">{form.preferredFirstName}</h1>
          <StatusBadge family={APPLICATION_STATUS_FAMILY[review.status]}>
            {APPLICATION_STATUS_LABEL[review.status]}
          </StatusBadge>
        </div>
        <p className="mt-1 text-xs text-text-muted">
          {review.reference} · revision {review.revisionNumber}
          {review.submittedAt === null ? '' : ` · submitted ${dateTime.format(review.submittedAt)}`}
        </p>
      </div>

      {notice !== null ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}

      <Card>
        <h2 className="text-lg font-semibold">The applicant</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Detail label="Legal name">
            {form.legalFirstName} {form.legalFamilyName}
          </Detail>
          <Detail label="Known to families as">{form.preferredFirstName}</Detail>
          <Detail label="Sign-in email">{review.applicantEmail ?? '—'}</Detail>
          <Detail label="Phone">{form.phone === '' ? '—' : form.phone}</Detail>
        </dl>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">What they teach</h2>
        <dl className="mt-4 flex flex-col gap-4">
          <Detail label="Subjects">{review.subjectNames.join(', ')}</Detail>
          <Detail label="Year levels">
            Year {form.yearLevelFrom} to Year {form.yearLevelTo}
          </Detail>
          <Detail label="Formats">
            {[form.offersOnline ? 'Online' : null, form.offersInPerson ? 'In person' : null]
              .filter(Boolean)
              .join(' and ')}
          </Detail>
          <Detail label="Headline">{form.headline}</Detail>
          <Detail label="How they teach">{form.teachingApproach}</Detail>
          <Detail label="Experience">{form.experienceSummary}</Detail>
          <Detail label="Qualifications">
            {form.qualificationsSummary === '' ? '—' : form.qualificationsSummary}
          </Detail>
        </dl>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Referees</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {form.references
            .filter((entry) => entry.email !== '')
            .map((entry) => (
              <li key={entry.email} className="text-sm">
                <p className="font-medium">{entry.fullName}</p>
                <p className="text-text-secondary">
                  {entry.email} · {entry.relationship}
                </p>
              </li>
            ))}
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Checks</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Done outside this form, recorded here as an outcome. Studdy keeps the result, not the
          documents. Approval needs every required check verified.
        </p>
        <ul className="mt-4 flex flex-col gap-5">
          {review.checks.map((check) => (
            <li
              key={check.code}
              className="flex flex-col gap-2 border-t border-surface-border pt-4 first:border-t-0 first:pt-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {CHECK_LABEL[check.code]}
                    {review.requiredChecks.includes(check.code) ? '' : ' (optional)'}
                  </p>
                  <p className="text-sm text-text-secondary">{CHECK_HELP[check.code]}</p>
                </div>
                <StatusBadge family={CHECK_STATUS_FAMILY[check.status]}>
                  {CHECK_STATUS_LABEL[check.status]}
                </StatusBadge>
              </div>
              {check.checkedAt !== null ? (
                <p className="text-xs text-text-muted">
                  Recorded {dateTime.format(check.checkedAt)}
                </p>
              ) : null}
              {decidable ? (
                <form action={recordCheckAction} className="flex flex-col gap-2">
                  <input type="hidden" name="reference" value={review.reference} />
                  <input type="hidden" name="checkCode" value={check.code} />
                  <TextareaField
                    label="Your note (staff only)"
                    name="note"
                    rows={2}
                    defaultValue={check.note ?? ''}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" name="status" value="verified" size="sm">
                      Mark verified
                    </Button>
                    <Button
                      type="submit"
                      name="status"
                      value="failed"
                      variant="secondary"
                      size="sm"
                    >
                      Mark failed
                    </Button>
                    <Button type="submit" name="status" value="pending" variant="quiet" size="sm">
                      Reset
                    </Button>
                  </div>
                </form>
              ) : check.note !== null ? (
                <p className="text-sm text-text-secondary">Note: {check.note}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      {review.applicantMessage !== null ? (
        <Card>
          <h2 className="text-lg font-semibold">Message the applicant was shown</h2>
          <p className="mt-2 whitespace-pre-wrap">{review.applicantMessage}</p>
        </Card>
      ) : null}

      {decidable ? (
        <Card>
          <h2 className="text-lg font-semibold">Decision</h2>
          {review.readiness.ready ? (
            <p className="mt-1 text-sm text-text-secondary">
              Every required check is verified. Approving creates the tutor&rsquo;s profile and
              workspace, and cannot be undone from here.
            </p>
          ) : (
            <Alert tone="warning">
              Not ready to approve.
              {review.readiness.failed.length > 0
                ? ` Failed: ${review.readiness.failed.map((code) => CHECK_LABEL[code]).join(', ')}.`
                : ''}
              {review.readiness.missing.length > 0
                ? ` Still to verify: ${review.readiness.missing.map((code) => CHECK_LABEL[code]).join(', ')}.`
                : ''}
            </Alert>
          )}

          <div className="mt-4 flex flex-col gap-6">
            <form action={approveApplicationAction}>
              <input type="hidden" name="reference" value={review.reference} />
              <Button type="submit" disabled={!review.readiness.ready}>
                Approve this tutor
              </Button>
            </form>

            <form action={requestChangesAction} className="flex flex-col gap-2">
              <input type="hidden" name="reference" value={review.reference} />
              <TextareaField
                label="Ask for changes — your message to the applicant"
                name="message"
                rows={3}
                helper="The applicant will read this exactly as written."
              />
              <div>
                <Button type="submit" variant="secondary">
                  Request changes
                </Button>
              </div>
            </form>

            <form action={rejectApplicationAction} className="flex flex-col gap-2">
              <input type="hidden" name="reference" value={review.reference} />
              <TextareaField
                label="Decline — your message to the applicant"
                name="message"
                rows={3}
                helper="The applicant will read this exactly as written. Do not include notes about other people."
              />
              <div>
                <Button type="submit" variant="secondary">
                  Decline this application
                </Button>
              </div>
            </form>
          </div>
        </Card>
      ) : review.tutorProfileReference !== null ? (
        <Alert tone="success">
          Approved{review.decidedAt === null ? '' : ` on ${dateTime.format(review.decidedAt)}`}.
          Tutor profile {review.tutorProfileReference}.
        </Alert>
      ) : null}
    </div>
  );
}
