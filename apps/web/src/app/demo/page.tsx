import type { ReactNode } from 'react';
import { Chip, DemoButton, Disc, Panel, PanelBody } from '@/components/demo/kit';
import { JACOB, PRIYA, STACEY, STUDENTS } from '@/lib/demo/fixtures';

export const metadata = { title: 'Demo' };

/**
 * THE WAY IN — three doors, and the explanation above the fold.
 *
 * The previous version buried both the explanation and the second parent
 * journey in small text at the bottom of the page, where a reviewer found them
 * by accident if at all. Everything someone can do here is now a card they can
 * see without scrolling, and what the demo IS sits immediately under the
 * heading rather than after it.
 */
export default function DemoHomePage() {
  return (
    <div className="mx-auto max-w-[1020px] px-5 py-12 md:py-16">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-brand">
        Interactive demo
      </p>
      <h1 className="mt-3 font-display text-[40px] font-semibold leading-[1.06] tracking-[-0.022em] text-brand-strong text-balance md:text-[48px]">
        A tutoring platform,
        <br />
        from both sides.
      </h1>

      {/* The explanation, where it can actually be read. */}
      <div className="mt-6 max-w-[70ch] border-l-2 border-brand bg-brand-tint/40 px-5 py-4">
        <p className="text-[15px] leading-relaxed text-text-secondary">
          Studdy is where families and tutors arrange lessons that actually happen. Families ask at
          times that suit them, tutors accept the one that fits their week, and nothing is booked
          until it is paid for.
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-text-secondary">
          <span className="font-semibold text-brand-strong">Everything here is invented.</span> No
          database, no payment taken, no email sent &mdash; the screens are the product&rsquo;s own,
          driven by fixed sample data. You can click anything, including choosing your own lesson
          times.
        </p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        <Door
          eyebrow="Start here"
          initials={PRIYA.initials}
          title="Book with a tutor you already use"
          who={`${PRIYA.name} · parent`}
          body={`${PRIYA.firstName} has booked ${JACOB.firstName}'s Maths lessons with ${STACEY.firstName} since March. Book an extra session before his assessment — four screens, because everything except when is already known.`}
          beats={['Pick your own times on a real calendar', 'Review, pay, confirmed']}
          href="/demo/parent"
          cta="Open the family workspace"
          tone="hero"
        />
        <Door
          eyebrow="The longer road"
          initials="?"
          title="Find a tutor from scratch"
          who={`${JACOB.firstName} needs Physics`}
          body={`A subject ${STACEY.firstName} does not teach, so ${PRIYA.firstName} searches properly: compare four tutors, read a profile, choose times, pay. Nine screens — and the contrast with the four above is the point.`}
          beats={['Compare tutors by price, level and week', 'The full first-time journey']}
          href="/demo/parent/tutors"
          cta="Start a tutor search"
        />
        <Door
          eyebrow="The other side"
          initials={STACEY.initials}
          title="Run a tutoring practice"
          who={`${STACEY.firstName} · ${String(STUDENTS.length)} students`}
          body="An established tutor's week: recurring lessons, a one-off, a trial, a paused student, and four requests waiting on a decision. Her bookings, services and lesson records."
          beats={['Accept a request and hold the time', 'Lesson summaries and homework']}
          href="/demo/tutor"
          cta="Open the tutor workspace"
        />
      </div>

      <p className="mt-8 text-[13px] text-text-muted">
        Switch sides at any point using the bar at the top. Nothing you click changes any real
        state.
      </p>
    </div>
  );
}

function Door({
  eyebrow,
  initials,
  title,
  who,
  body,
  beats,
  href,
  cta,
  tone = 'default',
}: {
  eyebrow: string;
  initials: string;
  title: string;
  who: string;
  body: string;
  beats: readonly string[];
  href: string;
  cta: string;
  tone?: 'default' | 'hero';
}): ReactNode {
  return (
    <Panel tone={tone} className="flex flex-col">
      <PanelBody className="flex flex-1 flex-col">
        <div className="flex items-center justify-between gap-2">
          <Chip tone={tone === 'hero' ? 'current' : 'ghost'}>{eyebrow}</Chip>
          <Disc initials={initials} size="sm" />
        </div>

        <h2 className="mt-4 font-display text-[20px] font-semibold leading-snug text-brand-strong text-balance">
          {title}
        </h2>
        <p className="mt-1 text-[12px] text-text-muted">{who}</p>

        <p className="mt-3 text-[13.5px] leading-relaxed text-text-secondary">{body}</p>

        <ul className="mt-4 flex flex-1 flex-col gap-1.5 border-l-2 border-surface-border pl-3.5 text-[12.5px] text-text-muted">
          {beats.map((beat) => (
            <li key={beat}>{beat}</li>
          ))}
        </ul>

        <div className="mt-5">
          <DemoButton href={href} tone={tone === 'hero' ? 'primary' : 'secondary'}>
            {cta}
          </DemoButton>
        </div>
      </PanelBody>
    </Panel>
  );
}
