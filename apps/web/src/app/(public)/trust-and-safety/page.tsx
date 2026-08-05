export const metadata = { title: 'Trust and Safety' };

export default function TrustAndSafetyPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-4xl font-semibold text-brand-purple-deep">
        Trust and safety
      </h1>
      <div className="mt-6 space-y-4 text-text-secondary">
        <p>
          Tutors on Studdy are interviewed and approved before they can teach. Identity and claimed
          qualifications are verified where applicable, and profiles show ratings, experience and
          lesson history.
        </p>
        <p>
          Booking requests require tutor acceptance by default, pricing is always visible before you
          commit, and parents can report concerns and receive support at any time.
        </p>
        <p>
          Students&rsquo; learning records are private by default. Access follows strict role-based
          rules — a tutor only ever sees the students and subjects they actually teach.
        </p>
      </div>
    </section>
  );
}
