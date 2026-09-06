'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Button, Label } from '@studdy/design-system';

export interface DemoResponseOption {
  readonly iso: string;
  readonly label: string;
}

/**
 * ACCEPT EXACTLY ONE TIME, or decline.
 *
 * A radio group rather than checkboxes, because accepting is a single choice by
 * design — and in the product the database enforces the same thing underneath,
 * so a crafted form cannot claim two.
 *
 * The chosen time travels in the URL rather than in a server action, which is
 * how the demo stays repeatable: accepting is a navigation, so the accepted
 * state and the confirmed calendar that follows it are both directly linkable.
 */
export function DemoTutorResponse({
  options,
}: {
  options: readonly DemoResponseOption[];
}): ReactNode {
  const router = useRouter();
  const [chosen, setChosen] = useState<string>(options[0]?.iso ?? '');

  return (
    <div className="mt-4 flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Times you were offered</legend>
        {options.map((option) => (
          <label
            key={option.iso}
            className={[
              'flex cursor-pointer items-center gap-3 rounded-[var(--radius-medium)] border px-4 py-3 transition-colors',
              chosen === option.iso
                ? 'border-brand-purple bg-brand-lavender/60'
                : 'border-surface-border bg-surface-card hover:border-brand-purple/50',
            ].join(' ')}
          >
            <input
              type="radio"
              name="demo-offered-time"
              value={option.iso}
              checked={chosen === option.iso}
              onChange={() => {
                setChosen(option.iso);
              }}
              className="accent-[var(--color-brand-purple)]"
            />
            <Label className="cursor-pointer font-medium tabular-nums text-text-primary">
              {option.label}
            </Label>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="lg"
          onClick={() => {
            router.push(`/demo/tutor/accepted?time=${encodeURIComponent(chosen)}`);
          }}
        >
          Accept this time
        </Button>
        <p className="text-sm text-text-secondary">
          This holds the time — it does not book the lesson.
        </p>
      </div>
    </div>
  );
}
