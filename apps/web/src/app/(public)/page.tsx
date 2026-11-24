import Link from 'next/link';

const subjectCards = [
  { name: 'Maths', detail: 'Build confidence with numbers', symbol: '∑', href: '/tutors' },
  { name: 'Science', detail: 'Understand the world', symbol: '⚗', href: '/tutors' },
  { name: 'English', detail: 'Communicate with clarity', symbol: 'Aa', href: '/tutors' },
  { name: 'Languages', detail: 'Learn new ways to connect', symbol: '文', href: '/tutors' },
] as const;

const features = [
  { title: 'Easy booking', description: 'Find a time that works for your family.' },
  {
    title: 'Great tutors',
    description: 'Apply, interview and verification processes help build trust.',
  },
  { title: 'Track progress', description: 'See goals, homework and lessons together.' },
] as const;

export default function HomePage() {
  return (
    <main className="bg-white text-[#0B2D5C]">
      <section
        aria-labelledby="studdy-hero-title"
        className="relative isolate overflow-hidden bg-white"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 -top-56 h-[410px] w-[520px] rounded-full bg-[#FFE9C7]/60"
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 md:py-24 lg:grid-cols-[1.04fr_0.96fr] lg:gap-16">
          <div className="relative z-10 max-w-[650px]">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#FFF5DE] px-4 py-2 text-xs font-bold tracking-wide text-[#0B2D5C]">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#F6B61C]" />
              Learning support, made simpler
            </p>
            <h1
              id="studdy-hero-title"
              aria-label="Tutoring that builds confidence."
              className="text-5xl font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-6xl lg:text-[4.5rem]"
            >
              Tutoring that
              <br />
              <span className="relative inline-block">
                builds confidence
                <span
                  aria-hidden="true"
                  className="absolute -bottom-2 left-1 right-1 h-2 -rotate-1 rounded-full bg-[#F6B61C]"
                />
              </span>
              .
            </h1>
            <p className="mt-9 max-w-lg text-lg leading-relaxed text-[#435772]">
              Find trusted tutors, stay organised and see real progress — all in one supportive
              place for families and learners.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/tutors"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#F6B61C] px-8 py-3 text-base font-extrabold text-[#0B2D5C] transition-colors hover:bg-[#ffd049]"
              >
                Find a tutor
              </Link>
              <Link
                href="/for-tutors"
                className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-[#0B2D5C] bg-white px-8 py-3 text-base font-extrabold text-[#0B2D5C] transition-colors hover:bg-[#DDEBFF]"
              >
                Join as a tutor
              </Link>
            </div>
            <p className="mt-8 text-sm font-medium text-[#435772]">
              Explore tutors by subject, year level and learning needs.
            </p>
          </div>

          {/* Product-first visual preview. All sample details are clearly illustrative. */}
          <div className="relative mx-auto w-full max-w-[560px]">
            <div
              aria-hidden="true"
              className="absolute -right-6 -top-8 h-64 w-64 rounded-[45%_55%_43%_57%] bg-[#F6B61C] sm:h-80 sm:w-80"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-7 -left-8 h-40 w-60 rounded-[60%_40%_50%_50%] bg-[#DDEBFF]"
            />
            <div className="relative overflow-hidden rounded-[28px] border border-[#d9e4f1] bg-white p-5 shadow-[0_20px_70px_rgba(11,45,92,0.12)] sm:p-7">
              <div className="flex items-center justify-between gap-3 border-b border-[#e3eaf3] pb-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#62748d]">
                    Your learning journey
                  </p>
                  <h2 className="mt-1 text-xl font-extrabold">Everything in one place</h2>
                </div>
                <div
                  aria-hidden="true"
                  className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FFF2D1] text-2xl"
                >
                  ★
                </div>
              </div>
              <div className="mt-5 rounded-2xl bg-[#f5f8ff] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">Learning goals</span>
                  <span className="rounded-full bg-[#DDEBFF] px-3 py-1 text-xs font-bold">
                    Example
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold">Growing confidence in maths</p>
                  <span className="text-xs font-bold text-[#176457]">On track</span>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#dbe5f2]">
                  <div className="h-full w-[68%] rounded-full bg-[#F6B61C]" />
                </div>
                <p className="mt-3 text-xs text-[#62748d]">
                  Illustrative progress — real progress depends on individual learning.
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[#e3eaf3] p-4">
                  <p className="text-xs font-bold text-[#62748d]">NEXT LESSON</p>
                  <p className="mt-2 text-base font-extrabold">Mathematics</p>
                  <p className="mt-1 text-xs text-[#435772]">Example lesson preview</p>
                </div>
                <div className="rounded-xl border border-[#e3eaf3] p-4">
                  <p className="text-xs font-bold text-[#62748d]">LEARNING PLAN</p>
                  <p className="mt-2 text-base font-extrabold">Keep moving forward</p>
                  <p className="mt-1 text-xs text-[#435772]">Goals · Homework · Feedback</p>
                </div>
              </div>
            </div>
            <p className="relative mt-3 text-center text-xs text-[#62748d]">
              Illustrative interface preview — no real student information
            </p>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="subjects-heading"
        className="border-t border-[#e9edf4] bg-[#F8FAFE]"
      >
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 md:py-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#ba7413]">FIND YOUR FIT</p>
              <h2
                id="subjects-heading"
                className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl"
              >
                Explore tutoring by subject
              </h2>
            </div>
            <Link
              href="/tutors"
              className="font-bold underline underline-offset-4 hover:text-[#F36F2B]"
            >
              Browse tutors
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {subjectCards.map((subject) => (
              <Link
                key={subject.name}
                href={subject.href}
                className="group rounded-2xl border border-[#dfe6f0] bg-white p-6 transition-colors hover:border-[#F6B61C] hover:bg-[#FFF9EC]"
              >
                <span
                  aria-hidden="true"
                  className="grid h-14 w-14 place-items-center rounded-xl bg-[#DDEBFF] text-2xl font-black text-[#0B2D5C]"
                >
                  {subject.symbol}
                </span>
                <h3 className="mt-5 text-xl font-extrabold">{subject.name}</h3>
                <p className="mt-2 text-sm text-[#435772]">{subject.detail}</p>
                <p className="mt-5 text-sm font-bold text-[#0B2D5C] group-hover:underline">
                  Find tutors →
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="why-heading"
        className="mx-auto max-w-7xl px-5 py-16 sm:px-8 md:py-20"
      >
        <div className="mb-8">
          <p className="text-sm font-bold text-[#ba7413]">WHY STUDDY?</p>
          <h2 id="why-heading" className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Support for the whole learning journey
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((feature, index) => (
            <div key={feature.title} className="rounded-2xl border border-[#e5ebf2] bg-white p-6">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[#FFF2D1] text-lg font-extrabold">
                {index + 1}
              </span>
              <h3 className="mt-5 text-xl font-extrabold">{feature.title}</h3>
              <p className="mt-2 text-[#435772]">{feature.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-7 flex flex-wrap items-center gap-6 rounded-2xl bg-[#FFF5E2] px-6 py-7 md:px-9">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#F6B61C] text-2xl"
            aria-hidden="true"
          >
            ♡
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-extrabold">For the whole family</h3>
            <p className="mt-1 text-[#435772]">
              Parents, students and tutors have the context they need, with role-appropriate access.
            </p>
          </div>
          <Link
            href="/how-it-works"
            className="rounded-full border-2 border-[#0B2D5C] px-6 py-3 text-sm font-bold hover:bg-white"
          >
            How it works
          </Link>
        </div>
      </section>

      <section
        aria-labelledby="tutor-cta-heading"
        className="relative overflow-hidden bg-[#0B2D5C] text-white"
      >
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-32 h-80 w-80 rounded-full bg-[#F6B61C]"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-36 right-20 h-64 w-[430px] rounded-[50%] bg-[#DDEBFF]"
        />
        <div className="relative mx-auto max-w-7xl px-5 py-16 sm:px-8 md:py-20">
          <p className="font-bold text-[#F6B61C]">FOR TUTORS</p>
          <h2
            id="tutor-cta-heading"
            className="mt-3 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl"
          >
            Spend more time teaching. Keep your tutoring organised.
          </h2>
          <p className="mt-4 max-w-xl text-[#e1eafa]">
            Manage lesson requests, availability, students and progress in one workspace. Join for
            free; Studdy earns when tutors earn.
          </p>
          <Link
            href="/for-tutors"
            className="mt-7 inline-flex rounded-full bg-[#F6B61C] px-7 py-3 font-extrabold text-[#0B2D5C] hover:bg-[#ffd049]"
          >
            Join as a tutor
          </Link>
        </div>
      </section>
    </main>
  );
}
