'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, StatusBadge, TextareaField } from '@studdy/design-system';
import type { ApplicationCheckCode, ApplicationCheckStatus } from '@studdy/domain/tutors';
import { CHECK_HELP, CHECK_LABEL } from '@/lib/tutors/application-status';
import { recordCheckInlineAction } from '@/lib/tutors/review-actions';
import { INITIAL_REVIEW_CHECK_STATE } from '@/lib/tutors/review-check-state';

const STATUS_LABEL: Record<ApplicationCheckStatus, string> = {
  pending: 'Not yet checked',
  verified: 'Verified',
  failed: 'Failed',
};

const STATUS_FAMILY = {
  pending: 'pending',
  verified: 'complete',
  failed: 'failed',
} as const;

export function ReviewCheckControls({
  reference,
  checkCode,
  initialStatus,
  initialNote,
  checkedAtText,
  required,
  decidable,
}: {
  reference: string;
  checkCode: ApplicationCheckCode;
  initialStatus: ApplicationCheckStatus;
  initialNote: string | null;
  checkedAtText: string | null;
  required: boolean;
  decidable: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    recordCheckInlineAction,
    INITIAL_REVIEW_CHECK_STATE,
  );
  const status = state.outcome === 'saved' && state.recordedStatus !== null
    ? state.recordedStatus
    : initialStatus;

  // Re-fetch the updated checks and approval readiness without navigation or
  // resetting the reviewer's scroll position.
  useEffect(() => {
    if (state.outcome === 'saved') router.refresh();
  }, [state.outcome, state.sequence, router]);

  return (
    <li className="flex flex-col gap-2 border-t border-surface-border pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">
            {CHECK_LABEL[checkCode]}{required ? '' : ' (optional)'}
          </p>
          <p className="text-sm text-text-secondary">{CHECK_HELP[checkCode]}</p>
        </div>
        <StatusBadge family={STATUS_FAMILY[status]}>{STATUS_LABEL[status]}</StatusBadge>
      </div>
      {checkedAtText !== null ? (
        <p className="text-xs text-text-muted">Recorded {checkedAtText}</p>
      ) : null}
      {decidable ? (
        <form action={action} aria-busy={pending} className="flex flex-col gap-2">
          <input type="hidden" name="reference" value={reference} />
          <input type="hidden" name="checkCode" value={checkCode} />
          <TextareaField
            label="Your note (staff only)"
            name="note"
            rows={2}
            defaultValue={initialNote ?? ''}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" name="status" value="verified" size="sm" disabled={pending}>
              {pending ? 'Saving check…' : 'Mark verified'}
            </Button>
            <Button type="submit" name="status" value="failed" variant="secondary" size="sm" disabled={pending}>
              Mark failed
            </Button>
            <Button type="submit" name="status" value="pending" variant="quiet" size="sm" disabled={pending}>
              Reset
            </Button>
          </div>
          <p role="status" aria-live="polite" className="text-sm text-text-secondary">
            {pending
              ? 'Saving this check…'
              : state.outcome === 'saved'
                ? 'Check saved.'
                : state.outcome === 'invalid'
                  ? 'Check not saved. Check the note (maximum 1,000 characters).'
                  : state.outcome === 'unavailable'
                    ? 'Check not saved. Refresh the application and try again.'
                    : ''}
          </p>
        </form>
      ) : initialNote !== null ? (
        <p className="text-sm text-text-secondary">Note: {initialNote}</p>
      ) : null}
    </li>
  );
}
