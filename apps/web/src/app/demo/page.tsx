import Link from 'next/link';
import { DemoButton, Disc } from '@/components/demo/kit';
import { JACOB, PRIYA, STACEY, STUDENTS } from '@/lib/demo/fixtures';

export const metadata = { title: 'Demo' };

/**
 * THE WAY IN.
 *
 * A reviewer arriving here has thirty seconds of patience and no context, so
 * the page answers in order: what Studdy is, whose side do you want, and how
 * long will it take. Two choices, both leading somewhere immediately.
 */
export default function DemoHomePage() {
  return (
    <div className="mx-auto max-w-[980px] px-5 py-14 md:py-20">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-brand">
        Interactive demo
      </p>
      <h1 className="mt-3 font-display text-[42px] font-semibold leading-[1.04] tracking-[-0.022em] text-brand-strong text-balance md:text-[52px]">
        A tutoring platform,
        <br />
        from both sides.
      </h1>
      <p className="mt-5 max-w-[62ch] text-[17px] leading-relaxed text-text-secondary">
        Studdy is where families and tutors arrange lessons that actually happen. Families ask at
        times that suit them, tutors accept the one that fits their week, and nothing is booked
        until it is paid for. Follow the same lesson from either side.
      </p>

      <div className="mt-12 grid gap-10 md:grid-cols-2">
        <section>
          <div className="flex items-center gap-3">
            <Disc initials={PRIYA.initials} />
            <div>
              <h2 className="font-display text-[22px] font-semibold text-brand-strong">
                As a parent
              </h2>
              <p className="text-[13px] text-text-muted">{PRIYA.name}</p>
            </div>
          </div>
          <p className="mt-4 text-[15px] leading-relaxed text-text-secondary">
            {PRIYA.firstName} has been booking {JACOB.firstName}&rsquo;s Maths lessons with{' '}
            {STACEY.firstName} since March. Book an extra session before his assessment — four
            screens, because everything except <em>when</em> is already known.
          </p>
          <ul className="mt-4 flex flex-col gap-1.5 border-l-2 border-surface-border pl-4 text-[13.5px] text-text-muted">
            <li>A standing Tuesday lesson and fourteen lessons of history</li>
            <li>Rebooking that does not re-ask what it already knows</li>
            <li>Payment, then a confirmed lesson</li>
          </ul>
          <div className="mt-6">
            <DemoButton href="/demo/parent" size="lg">
              Open the family workspace
            </DemoButton>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-3">
            <Disc initials={STACEY.initials} />
            <div>
              <h2 className="font-display text-[22px] font-semibold text-brand-strong">
                As a tutor
              </h2>
              <p className="text-[13px] text-text-muted">
                {STACEY.firstName} &middot; {STUDENTS.length} students
              </p>
            </div>
          </div>
          <p className="mt-4 text-[15px] leading-relaxed text-text-secondary">
            An established tutor&rsquo;s week: recurring lessons, a one-off, a trial, a paused
            student, and three requests waiting on a decision. Her services, her bookings, her
            lesson history.
          </p>
          <ul className="mt-4 flex flex-col gap-1.5 border-l-2 border-surface-border pl-4 text-[13.5px] text-text-muted">
            <li>A workspace built around what needs answering today</li>
            <li>Accepting holds the time — it does not book it</li>
            <li>The confirmed lesson, on the calendar families see</li>
          </ul>
          <div className="mt-6">
            <DemoButton href="/demo/tutor" tone="secondary" size="lg">
              Open the tutor workspace
            </DemoButton>
          </div>
        </section>
      </div>

      <div className="mt-14 border-t border-surface-border pt-6">
        <h2 className="text-[13.5px] font-semibold text-text-primary">About this demo</h2>
        <p className="mt-2 max-w-[76ch] text-[13.5px] leading-relaxed text-text-secondary">
          Every person, price and lesson here was invented for the demo. There is no database behind
          it, no payment is taken, no email is sent, and nothing you click changes any real state —
          the screens are the product&rsquo;s own, driven by fixed sample data. If you would rather
          start from a cold search,{' '}
          <Link href="/demo/parent/tutors" className="text-brand underline underline-offset-4">
            find a new tutor instead
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
