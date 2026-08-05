export const metadata = { title: 'How It Works' };

/**
 * Describes the approved multi-tutor request flow (brief §3) — NOT the older
 * single-tutor sequential flow printed in earlier planning drafts.
 */
const STEPS = [
  'Tell us about the student — subject, year level, goals and preferred times.',
  'See several suitable tutors with clear pricing and verification indicators.',
  'Send your request to more than one tutor at the same time.',
  'Tutors respond independently — no tutor sees who else you asked.',
  'Choose one accepted tutor. Your card is only charged when you confirm the booking.',
  'The other requests close automatically and their held times are released.',
  'Follow lessons, homework and progress in one continuous learning record.',
] as const;

export default function HowItWorksPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-4xl font-semibold text-brand-purple-deep">
        How Studdy works
      </h1>
      <ol className="mt-8 space-y-4">
        {STEPS.map((step, index) => (
          <li key={step} className="flex gap-4">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-lavender text-sm font-semibold text-brand-purple"
            >
              {index + 1}
            </span>
            <p className="pt-1 text-text-secondary">{step}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
