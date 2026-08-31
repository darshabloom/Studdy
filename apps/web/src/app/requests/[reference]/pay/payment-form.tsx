'use client';

import { useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Alert, Button } from '@studdy/design-system';

/**
 * The Payment Element, and the one place a Stripe key is allowed in a browser.
 *
 * ONLY THE PUBLISHABLE KEY. It is designed to be public — it can create and
 * confirm payments the client secret already authorises, and nothing else. The
 * secret key never leaves the server.
 *
 * THE AMOUNT IS NOT HERE, and that is the point. This component receives a
 * client secret and renders Stripe's own fields; the sum being charged was
 * fixed on the server when the PaymentIntent was created. There is no number in
 * this file for anyone to change.
 */

/**
 * Created once at module scope, as Stripe requires — calling `loadStripe` per
 * render would re-download the script on every keystroke.
 *
 * Missing key returns a promise of null, which `Elements` renders as a disabled
 * form rather than crashing the page. A misconfigured environment should look
 * broken, not blank.
 */
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '');

function ConfirmForm({ returnUrl }: { returnUrl: string }): React.JSX.Element {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (stripe === null || elements === null) return;
    setSubmitting(true);
    setMessage(null);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      /*
       * `if_required` keeps the parent on Studdy's page for a card that needs no
       * redirect, so the "we are confirming your booking" state is something
       * they actually see rather than a flash between two navigations. Cards
       * that require 3-D Secure still redirect, and come back to return_url.
       */
      redirect: 'if_required',
    });

    if (result.error !== undefined) {
      /*
       * Stripe's message is shown because it is the one thing here genuinely
       * written for a payer — "your card was declined" is more useful than
       * anything Studdy would invent. A decline is recoverable: the reservation
       * is held until the deadline and the same PaymentIntent can be retried,
       * so the form stays open.
       */
      setMessage(result.error.message ?? 'That payment could not be completed. You can try again.');
      setSubmitting(false);
      return;
    }

    /*
     * CONFIRMED IS NOT BOOKED. Studdy does not write the booking here and this
     * copy must not imply otherwise — fulfilment is webhook-authoritative and
     * lands in a later slice. Reloading shows the server's own view.
     */
    window.location.assign(returnUrl);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <PaymentElement />
      {message === null ? null : (
        <Alert tone="warning" title="That payment did not go through">
          {message} Your tutor’s time is still held until the deadline above.
        </Alert>
      )}
      <Button type="submit" disabled={stripe === null || submitting}>
        {submitting ? 'Paying…' : 'Pay now'}
      </Button>
    </form>
  );
}

export function PaymentForm({
  clientSecret,
  returnUrl,
}: {
  clientSecret: string;
  returnUrl: string;
}): React.JSX.Element {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <ConfirmForm returnUrl={returnUrl} />
    </Elements>
  );
}
