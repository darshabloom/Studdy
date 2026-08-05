export const metadata = { title: 'Pricing' };

export default function PricingPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-4xl font-semibold text-brand-purple-deep">Pricing</h1>
      <div className="mt-6 space-y-4 text-text-secondary">
        <p>
          Tutoring from $30 per hour. Tutors set their own rates, and the full price is always shown
          before you send a request.
        </p>
        <p>
          Your card is not charged when requests are sent. Payment happens only when you choose a
          tutor and confirm the booking.
        </p>
        <p>Joining Studdy is free for families and for tutors. Studdy earns when tutors earn.</p>
      </div>
    </section>
  );
}
