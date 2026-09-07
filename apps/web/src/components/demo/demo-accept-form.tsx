'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

export interface AcceptOption {
  readonly id: string;
  readonly label: string;
}

/**
 * ACCEPT EXACTLY ONE TIME, or decline.
 *
 * A radio group rather than checkboxes, because accepting is a single choice by
 * design — and in the product the database enforces the same thing underneath,
 * so a crafted form cannot claim two.
 *
 * The chosen time travels in the URL rather than through a server action, which
 * is how the demo stays repeatable: accepting is a navigation, so the accepted
 * state and the confirmed calendar that follow it are both directly linkable.
 */
export function DemoAcceptForm({
  options,
  acceptHref,
  declineHref,
}: {
  options: readonly AcceptOption[];
  acceptHref: string;
  declineHref: string;
}): ReactNode {
  const router = useRouter();
  const [chosen, setChosen] = useState<string>(options[0]?.id ?? '');

  return (
    <div className="mt-5 flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Times you were offered</legend>
        {options.map((option) => (
          <label
            key={option.id}
            className={`flex cursor-pointer items-center gap-3 rounded-[4px] border px-4 py-3 transition-colors ${
              chosen === option.id
                ? 'border-brand bg-brand-tint'
                : 'border-surface-border bg-surface-card hover:border-brand/40'
            }`}
          >
            <input
              type="radio"
              name="demo-offered-time"
              value={option.id}
              checked={chosen === option.id}
              onChange={() => {
                setChosen(option.id);
              }}
              className="accent-[var(--color-brand)]"
            />
            <span className="font-medium tabular-nums text-text-primary">{option.label}</span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => {
            router.push(`${acceptHref}?time=${encodeURIComponent(chosen)}`);
          }}
          className="inline-flex items-center rounded-[5px] border border-transparent bg-brand px-5 py-2.5 text-[15px] font-medium text-brand-contrast transition-colors hover:bg-brand-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Accept this time
        </button>
        <p className="text-[13.5px] text-text-secondary">
          This holds the time &mdash; it does not book the lesson.
        </p>
      </div>

      <div className="border-t border-surface-border pt-4">
        <button
          type="button"
          onClick={() => {
            router.push(declineHref);
          }}
          className="text-[13px] text-text-secondary underline decoration-surface-border underline-offset-4 hover:text-text-primary"
        >
          Decline &mdash; none of these work
        </button>
      </div>
    </div>
  );
}
