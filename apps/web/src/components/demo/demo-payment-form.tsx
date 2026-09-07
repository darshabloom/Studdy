'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

/**
 * A PAYMENT FORM THAT TAKES NO PAYMENT.
 *
 * Nothing here touches Stripe. There is no Payment Element, no publishable key,
 * no client secret and no network request of any kind — the fields are inert
 * markup and the button is a timer followed by a navigation.
 *
 * It still LOOKS like the payment step, because a demo that skipped straight
 * from "choose your tutor" to "booked" would hide the part of the product that
 * matters most: money is taken before a lesson is confirmed, and the
 * confirmation is a consequence of the payment rather than a step beside it.
 *
 * The pause is deliberate and fixed. An instant jump reads as a broken link in
 * a screen recording; a beat of "Processing" reads as a payment. It always
 * succeeds, so the same click always reaches the same screen.
 */
export function DemoPaymentForm({
  total,
  nextHref,
}: {
  total: string;
  nextHref: string;
}): ReactNode {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'processing'>('idle');

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Card number" value="4242 4242 4242 4242" className="sm:col-span-2" />
        <Field label="Expiry" value="04 / 29" />
        <Field label="CVC" value="123" />
      </div>

      <p className="text-[12px] text-text-muted">
        These fields are a picture. No card details are collected, sent or stored anywhere in this
        demo.
      </p>

      <div className="flex flex-wrap items-center gap-4 border-t border-surface-border pt-5">
        <button
          type="button"
          disabled={state === 'processing'}
          onClick={() => {
            setState('processing');
            // Long enough to read as a payment, short enough not to test
            // anyone's patience. Fixed, so a screen recording is repeatable.
            setTimeout(() => {
              router.push(nextHref);
            }, 900);
          }}
          className="inline-flex items-center rounded-[5px] border border-transparent bg-brand px-5 py-2.5 text-[15px] font-medium text-brand-contrast transition-colors hover:bg-brand-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:bg-brand-tint disabled:text-brand-strong"
        >
          {state === 'processing' ? 'Processing…' : `Pay ${total}`}
        </button>
        <p className="text-[13.5px] text-text-secondary" role="status">
          {state === 'processing'
            ? 'Confirming the booking with your tutor…'
            : 'Demo payment — nothing is charged.'}
        </p>
      </div>
    </div>
  );
}

/** An input's clothes without an input: nothing here can be typed into or submitted. */
function Field({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string;
  className?: string;
}): ReactNode {
  return (
    <div className={className}>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.07em] text-text-muted">
        {label}
      </p>
      <p className="rounded-[4px] border border-surface-border bg-surface-card-secondary px-3 py-2 font-medium tabular-nums text-text-muted">
        {value}
      </p>
    </div>
  );
}
