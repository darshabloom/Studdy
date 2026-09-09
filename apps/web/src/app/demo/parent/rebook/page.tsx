import { ParentShell } from '@/components/demo/demo-shells';
import {
  Aside,
  Chip,
  DemoButton,
  Disc,
  Fact,
  Facts,
  Panel,
  PanelBody,
  PanelHead,
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
 * So the layout is the argument: a large SETTLED card holding five answers
 * nobody needs to give again, and one small card holding the single open
 * question. That is the difference between this journey and the discovery
 * journey, and it is the reason both are in the demo.
 */
export default function RebookPage() {
  const service = serviceById(JACOB.serviceId);
  const standing = standingSlotLabel();

  return (
    <ParentShell active="/demo/parent">
      <DemoButton href="/demo/parent" tone="quiet" size="sm">
        &larr; Back
      </DemoButton>

      <header className="mt-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
          Book another lesson
        </p>
        <h1 className="mt-1.5 font-display text-[30px] font-semibold leading-tight tracking-[-0.018em] text-text-primary text-balance">
          An extra session for {JACOB.firstName}
        </h1>
        <p className="mt-1.5 text-[13.5px] text-text-muted">
          On top of his weekly lesson with {STACEY.firstName}.
        </p>
      </header>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* ── Everything already known ──────────────────────────────── */}
        <Panel tone="hero">
          <PanelHead
            title="We already know all of this"
            action={<Chip tone="current">Settled</Chip>}
          />
          <PanelBody>
            <div className="flex items-center gap-4">
              <Disc initials={STACEY.initials} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-[19px] font-medium leading-tight text-text-primary">
                  {service?.name ?? 'Maths'} with {STACEY.firstName}
                </p>
                <p className="mt-1 text-[12.5px] text-text-muted">
                  {JACOB.firstName} &middot; Year {JACOB.schoolYear} &middot;{' '}
                  {JACOB.format === 'online' ? 'Online' : 'In person'}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-[5px] border border-brand/20 bg-surface-card px-4 py-1">
              <Facts>
                <Fact
                  label="Who for"
                  value={`${JACOB.firstName} · Year ${String(JACOB.schoolYear)}`}
                />
                <Fact label="Subject" value={service?.name ?? 'Maths'} />
                <Fact label="Tutor" value={STACEY.firstName} />
                <Fact label="Length" value={`${String(JACOB.durationMinutes)} minutes`} />
                <Fact label="Format" value={JACOB.format === 'online' ? 'Online' : 'In person'} />
                <Fact label="Cost" value={money(priceFor(JACOB.durationMinutes))} strong />
              </Facts>
            </div>
          </PanelBody>
        </Panel>

        {/* ── The one open question ─────────────────────────────────── */}
        <Panel>
          <PanelHead title="One thing left to decide" meta="Step 1 of 2" />
          <PanelBody className="flex flex-col gap-4">
            <p className="text-[14px] leading-relaxed text-text-secondary">
              When would suit? Offer more than one time and {STACEY.firstName} can take whichever
              fits her week &mdash; she accepts one of them, and nothing is charged until she does.
            </p>
            <DemoButton href="/demo/parent/rebook/times" size="lg">
              Choose a time
            </DemoButton>
          </PanelBody>
        </Panel>
      </div>

      {standing === null ? null : (
        <div className="mt-5">
          <Aside title={`${JACOB.firstName}’s weekly lesson is not affected`}>
            His standing slot &mdash; {standing} &mdash; stays exactly where it is. This is an extra
            session alongside it.
          </Aside>
        </div>
      )}
    </ParentShell>
  );
}
