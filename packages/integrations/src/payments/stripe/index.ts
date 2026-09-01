/**
 * The Stripe integration's public surface.
 *
 * Two halves, one entry point: `connect.ts` makes a tutor payable and
 * `payment-intents.ts` takes and confirms a parent's money. They are separate
 * files because Stripe genuinely separates them — Accounts v2 thin events
 * against v1 snapshot events, two verifiers, two signing secrets — and one
 * module here so consumers keep importing `@studdy/integrations/payments/stripe`
 * and nothing outside this package has to know the seam exists.
 */
export * from './connect';
export * from './payment-intents';
