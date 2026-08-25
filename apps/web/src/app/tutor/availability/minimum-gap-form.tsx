import { Label } from '@studdy/design-system';
import type { ReactNode } from 'react';
import { MINIMUM_GAP_CHOICES } from '@studdy/domain/availability';
import { setMinimumGapAction } from '@/lib/availability/actions';

export interface MinimumGapFormProps {
  readonly minutes: number;
}

/**
 * How long this tutor needs between one lesson and the next.
 *
 * Lives beside the calendar because it is a fact about the calendar: it decides
 * what a family can be offered, exactly as the drawn hours do. A tutor who has
 * just watched two lessons land back to back should be able to fix it here
 * rather than hunt through a settings page.
 *
 * Submits on change with no separate save button — one control, one decision,
 * and nothing to lose by forgetting to confirm it.
 */
export function MinimumGapForm({ minutes }: MinimumGapFormProps): ReactNode {
  return (
    <form action={setMinimumGapAction} className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Label htmlFor="minimumGapMinutes" className="shrink-0">
        Minimum time between lessons
      </Label>
      <select
        id="minimumGapMinutes"
        name="minimumGapMinutes"
        defaultValue={String(minutes)}
        className="h-9 rounded-[var(--radius-gentle)] border border-surface-border bg-surface-card px-2 text-sm text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-purple"
      >
        {MINIMUM_GAP_CHOICES.map((choice) => (
          <option key={choice} value={choice}>
            {choice === 0 ? 'No gap' : `${String(choice)} minutes`}
          </option>
        ))}
      </select>
      {/* Works without JavaScript, and gives a keyboard user something to press
          rather than relying on a change event they may never fire. */}
      <button
        type="submit"
        className="rounded-[var(--radius-gentle)] border border-brand-purple px-3 py-1.5 text-sm font-medium text-brand-purple hover:bg-brand-lavender focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-purple"
      >
        Save
      </button>
      <p className="basis-full text-xs text-text-muted">
        Time to prepare, reset or travel. Families are never offered a lesson that starts sooner
        than this after one of yours ends. Changing it does not affect lessons or holds already
        arranged.
      </p>
    </form>
  );
}
