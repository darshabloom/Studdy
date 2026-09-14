import { TutorShell } from '@/components/demo/demo-shells';
import {
  Aside,
  CardsHead,
  Chip,
  DemoButton,
  EarningsSplit,
  EditAffordance,
  Panel,
  PanelBody,
  PanelHead,
} from '@/components/demo/kit';
import { RATE_MINOR, SERVICES, STUDENTS, money, netMoney, priceFor } from '@/lib/demo/fixtures';

export const metadata = { title: 'Services' };

/**
 * WHAT STACEY OFFERS, AND WHAT IT PAYS HER.
 *
 * EVERY FIGURE ON THIS PAGE COMES FROM `RATE_MINOR`, read through `priceFor`,
 * and every net figure through `split`. The rate card is written down once in
 * the fixtures, so the price a family sees on a request, on the payment screen
 * and in the tutor's own earnings line cannot drift from the price advertised
 * here — and the commission is arithmetic in one place rather than rounded
 * independently on three screens. Two screens disagreeing about what a lesson
 * costs is the fastest way to lose a reviewer's trust in everything else.
 *
 * SERVICES ARE CARDS BECAUSE THEY ARE OBJECTS SHE OWNS. Each one carries its
 * own Edit, and the page ends with Add service, so it reads as a thing she
 * maintains rather than a table describing her.
 */
export default function TutorServicesPage() {
  const durations = Object.keys(RATE_MINOR)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <TutorShell active="/demo/tutor/services">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
            {SERVICES.length} services
          </p>
          <h1 className="mt-1.5 font-display text-[30px] font-semibold leading-tight tracking-[-0.018em] text-text-primary">
            Services
          </h1>
          <p className="mt-1.5 max-w-[62ch] text-[13.5px] text-text-muted">
            The levels you teach, the lengths you offer, and what each one costs.
          </p>
        </div>
        <EditAffordance label="Add service">
          <p>
            In the product this adds a level, its lengths and its prices to your public profile.
          </p>
        </EditAffordance>
      </header>

      {/* ── The rate card, with the split spelled out ──────────────────── */}
      <div className="mt-6">
        <Panel tone="hero">
          <PanelHead
            title="Your rates"
            meta="The same for every level"
            action={
              <EditAffordance label="Edit rates">
                <p>
                  Changing a rate in the product affects new requests only. Lessons already booked
                  keep the price the family agreed to.
                </p>
              </EditAffordance>
            }
          />
          <PanelBody className="grid gap-5 sm:grid-cols-2">
            {durations.map((duration) => (
              <div
                key={duration}
                className="rounded-[5px] border border-brand/20 bg-surface-card px-4 py-4"
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
                  {duration}-minute lesson
                </p>
                <p className="mt-1.5 font-display text-[32px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-brand-strong">
                  {netMoney(priceFor(duration))}
                </p>
                <p className="mt-1 text-[12.5px] text-text-muted">what you earn</p>
                <div className="mt-4 border-t border-surface-border pt-2">
                  <EarningsSplit grossMinor={priceFor(duration)} />
                </div>
              </div>
            ))}
          </PanelBody>
          <div className="border-t border-brand/20 px-5 py-3.5">
            <p className="max-w-[74ch] text-[13px] leading-relaxed text-text-secondary">
              Studdy&rsquo;s commission comes <em>out of</em> your listed price rather than being
              added to it, so a family pays exactly the figure they were shown when they chose you.
            </p>
          </div>
        </Panel>
      </div>

      {/* ── One card per service ──────────────────────────────────────── */}
      <section className="mt-6 sm:mt-8">
        <CardsHead title="What you teach" meta={`${String(SERVICES.length)}`} />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {SERVICES.map((service) => {
            const taughtBy = STUDENTS.filter((student) => student.serviceId === service.id);
            return (
              <Panel key={service.id}>
                <PanelHead
                  title={service.name}
                  meta={service.levels}
                  action={
                    <EditAffordance label="Edit">
                      <p>
                        In the product this opens the service for editing &mdash; its levels, the
                        lengths you offer and the formats you teach it in.
                      </p>
                    </EditAffordance>
                  }
                />
                <PanelBody className="flex h-full flex-col gap-3.5">
                  <p className="text-[13px] leading-relaxed text-text-secondary">{service.note}</p>

                  <div className="flex flex-wrap gap-2">
                    {service.durations.map((duration) => (
                      <span
                        key={duration}
                        className="rounded-[5px] border border-surface-border bg-surface-card-secondary px-3 py-2 text-[12.5px] tabular-nums text-text-secondary"
                      >
                        {duration} min &middot;{' '}
                        <span className="font-semibold text-text-primary">
                          {money(priceFor(duration))}
                        </span>
                        <span className="ml-1.5 text-text-muted">
                          you earn {netMoney(priceFor(duration))}
                        </span>
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-surface-border pt-3">
                    {service.online ? <Chip tone="ghost">Online</Chip> : null}
                    {service.inPerson ? <Chip tone="ghost">In person</Chip> : null}
                    {taughtBy.length > 0 ? (
                      <Chip tone="current">
                        {taughtBy.map((student) => student.firstName).join(', ')}
                      </Chip>
                    ) : (
                      <Chip tone="neutral">Nobody booked on it yet</Chip>
                    )}
                  </div>
                </PanelBody>
              </Panel>
            );
          })}

          {/* The empty slot, which is what makes the grid read as editable. */}
          <Panel tone="quiet" className="border-dashed">
            <PanelBody className="flex h-full flex-col items-start justify-center gap-2.5 py-7">
              <p className="font-display text-[16.5px] font-medium text-text-primary">
                Add another service
              </p>
              <p className="max-w-[36ch] text-[12.5px] leading-relaxed text-text-muted">
                A new level, its lengths and its prices. It appears on your public profile as soon
                as you save it.
              </p>
              <EditAffordance label="Add service">
                <p>
                  In the product this adds a level, its lengths and its prices to your public
                  profile.
                </p>
              </EditAffordance>
            </PanelBody>
          </Panel>
        </div>
      </section>

      <div className="mt-5">
        <Panel tone="quiet">
          <PanelHead title="Not currently offered" />
          <PanelBody>
            <Aside title="Physics, Chemistry and Biology">
              You teach Maths and Calculus only. Families looking for the sciences are shown other
              tutors, which is why {STUDENTS[0]?.parentName ?? 'a parent'} searches separately when{' '}
              {STUDENTS[0]?.firstName ?? 'a student'} needs Physics.
            </Aside>
            <div className="mt-4">
              <DemoButton href="/demo/parent/tutors" tone="tertiary" size="sm">
                See how that search looks
              </DemoButton>
            </div>
          </PanelBody>
        </Panel>
      </div>
    </TutorShell>
  );
}
