# Stripe adapter (reserved)

Provider-specific Stripe code belongs here (brief §9), implementing the domain-owned
`PaymentProvider`, `ConnectedAccountProvider`, `RefundProvider` and `PayoutProvider`
interfaces. Stripe SDK types never cross into `@studdy/domain`.

Lands with `feat/stripe-booking-confirmation`, in real Stripe **test mode** — no permanent
mocked payment flow. Live mode requires explicit approval.
