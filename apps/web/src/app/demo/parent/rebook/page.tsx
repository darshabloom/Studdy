import { ParentShell } from '@/components/demo/demo-shells';
import {
  Aside,
  DemoButton,
  Disc,
  Fact,
  Facts,
  PageHead,
  SectionLine,
} from '@/components/demo/kit';
import { JACOB, STACEY, money, priceFor, serviceById } from '@/lib/demo/fixtures';
import { standingSlotLabel } from '@/lib/demo/stories';

export const metadata = { title: 'Book another lesson' };

/**
 * THE SCREEN THAT CARRIES THE WHOLE IDEA.
 *
 * Priya has booked with Stacey fourteen times. Asking her again who the lesson
 * is for, which subject, which tutor, how long and in what format would be the
 * product forgetting a relationship it already has on file.
 *
 * So those five answers are shown as a SETTLED CONTEXT — statements with a
 * quiet way to change them — and exactly one question is left open. That is the
 * difference between this journey and the discovery journey, and it is the
 * reason both are in the demo.
 */
export default function RebookPage() {
  const service = serviceById(JACOB.serviceId);
  const standing = standingSlotLabel();

  return (
    <ParentShell active="/demo/parent">
      <DemoButton href="/demo/parent" tone="quiet" size="sm">
        &larr; Back
      </DemoButton>

      <div className="mt-4">
        <PageHead
          eyebrow="Book another lesson"
          title={`An extra session for ${JACOB.firstName}`}
          sub={`On top of his weekly lesson with ${STACEY.firstName}.`}
        />
      </div>

      <section className="mt-8">
        <SectionLine title="We already know all of this" />
        <div className="mt-4 flex items-center gap-4 border-l-2 border-brand bg-brand-tint/40 px-5 py-4">
          <Disc initials={STACEY.initials} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-[18px] font-medium leading-tight text-text-primary">
              {service?.name ?? 'Maths'} with {STACEY.firstName}
            </p>
            <p className="mt-1 text-[12.5px] text-text-muted">
              {JACOB.firstName} &middot; Year {JACOB.schoolYear} &middot;{' '}
              {JACOB.format === 'online' ? 'Online' : 'In person'} &middot;{' '}
              {JACOB.durationMinutes} minutes &middot; {money(priceFor(JACOB.durationMinutes))}
            </p>
          </div>
        </div>

        <div className="mt-5 max-w-md">
          <Facts>
            <Fact label="Who for" value={`${JACOB.firstName} · Year ${String(JACOB.schoolYear)}`} />
            <Fact label="Subject" value={service?.name ?? 'Maths'} />
            <Fact label="Tutor" value={STACEY.firstName} />
            <Fact label="Length" value={`${String(JACOB.durationMinutes)} minutes`} />
            <Fact label="Format" value={JACOB.format === 'online' ? 'Online' : 'In person'} />
            <Fact label="Cost" value={money(priceFor(JACOB.durationMinutes))} strong />
          </Facts>
        </div>
      </section>

      <section className="mt-9">
        <SectionLine title="One thing left to decide" />
        <p className="mt-3 max-w-[66ch] text-[15px] leading-relaxed text-text-secondary">
          When would suit? Offer more than one time and {STACEY.firstName} can take whichever fits
          her week &mdash; she accepts one of them, and nothing is charged until she does.
        </p>
        <div className="mt-5">
          <DemoButton href="/demo/parent/rebook/times" size="lg">
            Choose a time
          </DemoButton>
        </div>
      </section>

      {standing === null ? null : (
        <div className="mt-9">
          <Aside title={`${JACOB.firstName}’s weekly lesson is not affected`}>
            His standing slot &mdash; {standing} &mdash; stays exactly where it is. This is an extra
            session alongside it.
          </Aside>
        </div>
      )}
    </ParentShell>
  );
}
