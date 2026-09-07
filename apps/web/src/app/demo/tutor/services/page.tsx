import { TutorShell } from '@/components/demo/demo-shells';
import {
  Aside,
  Chip,
  DemoButton,
  PageHead,
  Row,
  RowList,
  RowMain,
  RowMeta,
  SectionLine,
} from '@/components/demo/kit';
import { COMMISSION_RATE, RATE_MINOR, SERVICES, STUDENTS, money, priceFor } from '@/lib/demo/fixtures';

export const metadata = { title: 'Services' };

/**
 * WHAT STACEY OFFERS, AND WHAT IT COSTS.
 *
 * EVERY FIGURE ON THIS PAGE COMES FROM `RATE_MINOR` and is read through
 * `priceFor`. The rate card is written down once in the fixtures, so the price
 * a family sees on a request, on the payment screen and in the tutor's own
 * earnings line cannot drift from the price advertised here. Two screens
 * disagreeing about what a lesson costs is the fastest way to lose a reviewer's
 * trust in everything else on screen.
 */
export default function TutorServicesPage() {
  const durations = Object.keys(RATE_MINOR)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <TutorShell active="/demo/tutor/services">
      <PageHead
        title="Services"
        sub="The levels you teach, the lengths you offer, and what each one costs."
      />

      <section className="mt-8">
        <SectionLine title="Your rates" meta="Same for every level" />
        <div className="mt-4 flex flex-wrap gap-10">
          {durations.map((duration) => (
            <div key={duration}>
              <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
                {duration} minutes
              </p>
              <p className="mt-1 font-display text-[30px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-brand-strong">
                {money(priceFor(duration))}
              </p>
              <p className="mt-1.5 text-[12.5px] text-text-muted">
                You keep {money(BigInt(Math.round(Number(priceFor(duration)) * (1 - COMMISSION_RATE))))}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-5 max-w-[70ch] text-[13.5px] leading-relaxed text-text-secondary">
          Studdy&rsquo;s commission comes <em>out of</em> your listed price rather than being added
          to it, so a family pays exactly the figure they were shown when they chose you.
        </p>
      </section>

      <section className="mt-10">
        <SectionLine title="What you teach" meta={`${SERVICES.length} services`} />
        <div className="mt-1">
          <RowList>
            {SERVICES.map((service) => {
              const taughtBy = STUDENTS.filter((student) => student.serviceId === service.id);
              return (
                <Row key={service.id}>
                  <RowMain
                    name={service.name}
                    detail={
                      <>
                        {service.note}
                        {taughtBy.length > 0 ? (
                          <span className="mt-1 block text-text-muted">
                            {taughtBy.map((student) => student.firstName).join(', ')}
                          </span>
                        ) : null}
                      </>
                    }
                  />
                  <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    <Chip tone="neutral">{service.levels}</Chip>
                    {service.online ? <Chip tone="ghost">Online</Chip> : null}
                    {service.inPerson ? <Chip tone="ghost">In person</Chip> : null}
                  </span>
                  <RowMeta>
                    {service.durations.map((duration) => (
                      <span key={duration} className="block">
                        {duration} min &middot; {money(priceFor(duration))}
                      </span>
                    ))}
                  </RowMeta>
                </Row>
              );
            })}
          </RowList>
        </div>
      </section>

      <section className="mt-10">
        <SectionLine title="Not currently offered" />
        <div className="mt-3">
          <Aside title="Physics, Chemistry and Biology">
            You teach Maths and Calculus only. Families looking for the sciences are shown other
            tutors, which is why {STUDENTS[0]?.parentName ?? 'a parent'} searches separately when{' '}
            {STUDENTS[0]?.firstName ?? 'a student'} needs Physics.
          </Aside>
        </div>
        <div className="mt-4">
          <DemoButton href="/demo/parent/tutors" tone="tertiary" size="sm">
            See how that search looks
          </DemoButton>
        </div>
      </section>
    </TutorShell>
  );
}
