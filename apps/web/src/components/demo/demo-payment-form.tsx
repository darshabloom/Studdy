'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Button } from '@studdy/design-system';

/**
 * A PAYMENT FORM THAT TAKES NO PAYMENT.
 *
 * Nothing here touches Stripe. There is no Payment Element, no publishable key,
 * no client secret and no network request of any kind — the fields are inert
 * markup and the button is a timer followed by a navigation.
 *
 * It still LOOKS like the payment step, because a demo that skipped straight
 * from "choose your tutor" to "booked" would hide the part of the product that
 * actually matters: money is taken before a lesson is confirmed, and the
 * confirmation is a consequence of the payment rather than a step beside it.
 *
 * The pause is deliberate and fixed. An instant jump reads as a broken link in
 * a screen recording; a beat of "Processing" reads as a payment. It always
 * succeeds, so the same click always reaches the same screen.
 */
export function DemoPaymentForm({ total }: { total: string }): ReactNode {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'processing'>('idle');

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Card number" value="4242 4242 4242 4242" className="sm:col-span-2" />
        <Field label="Expiry" value="04 / 29" />
        <Field label="CVC" value="123" />
      </div>

      <p className="text-xs text-text-muted">
        These fields are a picture. No card details are collected, sent or stored anywhere in this
        demo.
      </p>

      <div className="flex flex-wrap items-center gap-3 border-t border-surface-border pt-4">
        <Button
          size="lg"
          disabled={state === 'processing'}
          onClick={() => {
            setState('processing');
            // Long enough to read as a payment, short enough not to test
            // anyone's patience. Fixed, so a screen recording is repeatable.
            setTimeout(() => {
              router.push('/demo/parent/booked');
            }, 900);
          }}
        >
          {state === 'processing' ? 'Processing…' : `Simulate paying ${total}`}
        </Button>
        <p className="text-sm text-text-secondary" role="status">
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
  className,
}: {
  label: string;
  value: string;
  className?: string;
}): ReactNode {
  return (
    <div className={className}>
      <p className="mb-1 text-xs font-medium text-text-secondary">{label}</p>
      <p className="rounded-[var(--radius-gentle)] border border-surface-border bg-surface-card-secondary px-3 py-2 font-medium tabular-nums text-text-muted">
        {value}
      </p>
    </div>
  );
}
