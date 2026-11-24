import Link from 'next/link';
import { Alert, Button, Card, StatusBadge, TextareaField } from '@studdy/design-system';
import { APPLICATION_CHECK_CODES, DECIDABLE_APPLICATION_STATUSES } from '@studdy/domain/tutors';
import { ReviewCheckControls } from '@/components/tutors/review-check-controls';
import {
  approveApplicationV2Action,
  requestChangesV2Action,
  rejectV2Action,
} from '@/lib/tutors/review-actions';
import type { SubjectOption, V2ReviewDetail } from '@studdy/database';
import {
  APPLICATION_STATUS_FAMILY,
  APPLICATION_STATUS_LABEL,
} from '@/lib/tutors/application-status';

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap break-words">{children}</dd>
    </div>
  );
}

/** Staff only. Parent page MUST call requireStaff before querying private data. */
export function TutorApplicationV2Review({
  review,
  subjects,
}: {
  review: V2ReviewDetail;
  subjects: readonly SubjectOption[];
}) {
  const { answers, documentVersions } = review.snapshot;
  const decidable = (DECIDABLE_APPLICATION_STATUSES as readonly string[]).includes(review.status);
  const approvalEnabled =
    process.env.STUDDY_APPLICATION_V2_ENABLED === 'true' &&
    process.env.STUDDY_APPLICATION_V2_DECISIONS_ENABLED === 'true';
  const allChecksVerified = APPLICATION_CHECK_CODES.every((code) =>
    review.checks.some((check) => check.code === code && check.status === 'verified'),
  );
  const subjectName = (id: string) =>
    subjects.find((subject) => subject.subjectId === id)?.displayName ?? 'Unavailable subject';

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
          <h1 className="font-display text-2xl font-semibold">{review.preferredFirstName}</h1>
          <StatusBadge family={APPLICATION_STATUS_FAMILY[review.status]}>
            {APPLICATION_STATUS_LABEL[review.status]}
          </StatusBadge>
        </div>
        <p className="mt-1 text-xs text-text-muted">
          {review.reference} · V2 revision {review.revisionNumber}
        </p>
      </div>
      <Alert tone="warning">
        Read-only v2 application review. Approval and change requests will be enabled after
        v2-specific safeguarding and decision controls are verified.
      </Alert>

      <Card>
        <h2 className="text-lg font-semibold">1. About the applicant</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Detail label="Legal name">
            {answers.about.legalFirstName} {answers.about.legalFamilyName}
          </Detail>
          <Detail label="First name for families">{answers.about.preferredFirstName}</Detail>
          <Detail label="Date of birth — private">{answers.about.dateOfBirth}</Detail>
          <Detail label="Mobile">{answers.about.mobile}</Detail>
          <Detail label="Based in">{answers.about.location}</Detail>
          <Detail label="Current activities">
            {answers.about.currentActivities.join(', ') || '—'}
          </Detail>
        </dl>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">2. Subjects and levels</h2>
        <ul className="mt-4 space-y-3">
          {answers.subjects.selections.map((entry) => (
            <li key={entry.subjectId}>
              <p className="font-semibold">{subjectName(entry.subjectId)}</p>
              <p className="text-sm text-text-secondary">
                Levels: {entry.levels.join(', ')} · {entry.specialisations || 'No specialisations'}
              </p>
            </li>
          ))}
        </ul>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Detail label="Suggested subjects">
            {answers.subjects.suggestedSubjects.join(', ') || '—'}
          </Detail>
          <Detail label="Curricula">{answers.subjects.curricula.join(', ')}</Detail>
          <Detail label="Format">
            {[
              answers.subjects.offersOnline ? 'Online' : '',
              answers.subjects.offersInPerson ? 'In person' : '',
            ]
              .filter(Boolean)
              .join(' and ')}
          </Detail>
        </dl>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">3. Teaching experience</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Detail label="Experience">{answers.teaching.experience}</Detail>
          <Detail label="Settings">{answers.teaching.settings.join(', ')}</Detail>
          <Detail label="Approach">{answers.teaching.approach}</Detail>
          <Detail label="Student groups">{answers.teaching.studentGroups.join(', ')}</Detail>
          <Detail label="Learning needs experience">
            {answers.teaching.learningNeeds.join(', ') || '—'}
          </Detail>
          <Detail label="Practical example">{answers.teaching.example || '—'}</Detail>
        </dl>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">4. Qualifications and evidence</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Detail label="Highest education">{answers.qualifications.highestEducation}</Detail>
          <Detail label="Currently studying">{answers.qualifications.currentlyStudying}</Detail>
          <Detail label="Qualifications">
            {answers.qualifications.noRelevantQualifications
              ? 'None yet'
              : answers.qualifications.relevantQualifications
                  .map((q) => [q.title, q.institution, q.field, q.awardedYear].join(' · '))
                  .join('; ')}
          </Detail>
          <Detail label="Evidence">{answers.qualifications.evidenceIntention}</Detail>
          <Detail label="Academic results">{answers.qualifications.academicResults || '—'}</Detail>
          <Detail label="Credentials">
            {answers.qualifications.professionalCredentials || '—'}
          </Detail>
          <Detail label="Training">{answers.qualifications.training.join(', ') || '—'}</Detail>
        </dl>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">5. Referees</h2>
        <ul className="mt-4 space-y-4">
          {answers.references.map((ref, index) => (
            <li key={index} className="text-sm">
              <p className="font-semibold">
                {ref.fullName} · {ref.category}
              </p>
              <p>
                {ref.relationship} · {ref.position} · {ref.organisation}
              </p>
              <p>{[ref.email, ref.phone].filter(Boolean).join(' / ')}</p>
              <p className="text-text-secondary">
                {ref.permissionConfirmed ? 'Permission confirmed' : 'Permission unconfirmed'}
                {' · '}
                {ref.contactPreference === 'contact_me_first'
                  ? 'Contact applicant first'
                  : 'Contact now'}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Verification checks</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Identity, safeguarding, references and interview are individually verified by authorised
          staff. The applicant's declarations alone never mark a check as complete.
        </p>
        <ul className="mt-4 flex flex-col gap-5">
          {review.checks.map((check) => (
            <ReviewCheckControls
              key={check.code}
              reference={review.reference}
              checkCode={check.code}
              initialStatus={check.status}
              initialNote={check.note}
              checkedAtText={
                check.checkedAt === null ? null : check.checkedAt.toISOString().slice(0, 10)
              }
              required
              decidable={decidable && approvalEnabled}
            />
          ))}
        </ul>
        {approvalEnabled && decidable ? (
          <div className="mt-5 flex flex-col gap-6">
            <form action={approveApplicationV2Action}>
              <input type="hidden" name="reference" value={review.reference} />
              <Button type="submit" disabled={!allChecksVerified}>
                Approve tutor and open private setup
              </Button>
            </form>
            <form action={requestChangesV2Action} className="flex flex-col gap-2">
              <input type="hidden" name="reference" value={review.reference} />
              <TextareaField
                label="Ask for changes — message to the applicant"
                name="message"
                rows={3}
                helper="The previous v2 answers will be restored as a draft. The applicant must accept declarations again."
              />
              <div>
                <Button type="submit" variant="secondary">
                  Request changes
                </Button>
              </div>
            </form>
            <form action={rejectV2Action} className="flex flex-col gap-2">
              <input type="hidden" name="reference" value={review.reference} />
              <TextareaField
                label="Decline — message to the applicant"
                name="message"
                rows={3}
                helper="The applicant receives a notification and reads the decision in Studdy."
              />
              <div>
                <Button type="submit" variant="secondary">
                  Decline application
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <p className="mt-4 text-sm text-text-secondary">
            Approval controls are locked until the v2 release and notification requirements are
            complete.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">6. Declarations</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Detail label="Accuracy">
            {answers.declarations.accuracyAccepted ? 'Accepted' : 'Missing'}
          </Detail>
          <Detail label="Safeguarding">
            {answers.declarations.safeguardingAccepted ? 'Accepted' : 'Missing'}
          </Detail>
          <Detail label="Interview">
            {answers.declarations.interviewAccepted ? 'Accepted' : 'Missing'}
          </Detail>
          <Detail label="Tutor Agreement version">{documentVersions.tutorAgreement}</Detail>
          <Detail label="Code of Conduct version">{documentVersions.codeOfConduct}</Detail>
          <Detail label="Privacy Notice version">{documentVersions.privacyNotice}</Detail>
          <Detail label="Guardian consent reference">
            {review.guardianConsentReference || 'Not applicable'}
          </Detail>
          <Detail label="Verified review checks">{review.verifiedChecks} of 4</Detail>
        </dl>
      </Card>
    </div>
  );
}
