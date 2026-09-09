import { TutorShell } from '@/components/demo/demo-shells';
import {
  Aside,
  CardsHead,
  Chip,
  DemoButton,
  Disc,
  EarningsSplit,
  OpenMark,
  Panel,
  PanelBody,
  PanelHead,
} from '@/components/demo/kit';
import { formatLessonDateTime } from '@/components/requests/request-status';
import { money, netMoney, serviceById } from '@/lib/demo/fixtures';
import { heldRequests, inboxRequests, shortDeadline, spanLabel } from '@/lib/demo/schedule';
import { PLATFORM_TIME_ZONE } from '@/lib/time';
import type { DemoRequest } from '@/lib/demo/schedule';

export const metadata = { title: 'Lesson requests' };

/**
 * A TUTOR SEES ONLY THEIR OWN REQUESTS.
 *
 * The production projection behind this screen selects no Intended Lesson
 * Request identifier, no slot position and no close reason, so nothing here can
 * reveal whether other tutors were asked, how many, who they were, or how they
 * responded. The demo data is shaped the same way — there is no field on this
 * page that could carry it — because a demo that quietly showed more than the
 * product does would misrepresent the thing it is demonstrating.
 *
 * EACH REQUEST IS ONE CARD, and the card is the decision: who is asking, what
 * they want, which hours they offered, what it pays her, and the way in. The
 * offered times used to live in a second grid further down the page, which
 * meant the one fact a tutor needs before answering was somewhere else.
 */
export default function TutorRequestsPage() {
  const now = new Date();
  const requests = inboxRequests(now);
  const held = heldRequests(now);

  return (
    <TutorShell active="/demo/tutor/requests">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
            {requests.length} awaiting your response
          </p>
          <h1 className="mt-1.5 font-display text-[30px] font-semibold leading-tight tracking-[-0.018em] text-text-primary">
            Lesson requests
          </h1>
          <p className="mt-1.5 max-w-[62ch] text-[13.5px] text-text-muted">
            Families ask for a lesson at times that suit them. You accept the one that fits your
            week.
          </p>
        </div>
      </header>

      <div className="mt-6">
        <Aside title="Accepting holds the time">
          Accepting puts that hour on your calendar while the family decides and pays. It is not a
          booking yet, and the hold is released either way when it expires.
        </Aside>
      </div>

      <div className="mt-7 flex flex-col gap-5">
        {requests.map((request) => (
          <RequestCard key={request.reference} request={request} />
        ))}
      </div>

      {/* Accepted, and now waiting on somebody else. Not a decision any more. */}
      {held.length > 0 ? (
        <section className="mt-9">
          <CardsHead title="Accepted, awaiting the family" meta={`${String(held.length)}`} />
          <div className="mt-4 flex flex-col gap-4">
            {held.map((request) => {
              const accepted = request.offered[0];
              return (
                <Panel
                  key={request.reference}
                  tone="quiet"
                  href={`/demo/tutor/requests/${request.slug}/accepted`}
                >
                  <PanelBody className="flex flex-wrap items-center gap-x-5 gap-y-3">
                    <Disc initials={request.studentInitials} size="sm" />
                    <span className="min-w-[200px] flex-1">
                      <span className="block font-display text-[16px] font-medium text-text-primary">
                        {request.studentFirstName}
                      </span>
                      <span className="mt-0.5 block text-[12.5px] text-text-muted">
                        {accepted === undefined
                          ? 'Held'
                          : `${spanLabel(accepted.at, accepted.durationMinutes)} · held, not booked`}
                      </span>
                    </span>
                    <Chip tone="attention">Awaiting payment</Chip>
                    <span className="text-[13.5px] font-semibold tabular-nums text-text-primary">
                      {netMoney(request.priceMinor)}
                    </span>
                    <OpenMark label="" />
                  </PanelBody>
                </Panel>
              );
            })}
          </div>
        </section>
      ) : null}
    </TutorShell>
  );
}

/**
 * ONE REQUEST, WITH ITS ANSWER ONE CLICK AWAY.
 *
 * Only a running deadline gets clay. Four cards all shouting is four cards
 * saying nothing, so the other three carry their context as a plain chip — an
 * existing student, a trial deciding whether to continue, a stranger — and the
 * urgent one is the only card on the page that changes colour.
 */
function RequestCard({ request }: { request: DemoRequest }) {
  const service = serviceById(request.serviceId);
  const context = request.urgent
    ? { tone: 'attention' as const, label: `Reply by ${shortDeadline(request.respondByAt)}` }
    : request.student === null
      ? { tone: 'ghost' as const, label: 'New family' }
      : request.student.cadence === 'trial'
        ? { tone: 'current' as const, label: 'After a trial' }
        : { tone: 'current' as const, label: 'Your student' };

  return (
    <Panel tone={request.urgent ? 'attention' : 'default'}>
      <PanelHead
        title={`${request.studentFirstName} · Year ${String(request.schoolYear)}`}
        meta={request.parentName}
        action={<Chip tone={context.tone}>{context.label}</Chip>}
      />
      <PanelBody className="grid items-start gap-x-7 gap-y-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="flex items-start gap-3.5">
            <Disc initials={request.studentInitials} />
            <div className="min-w-0">
              <p className="font-display text-[16px] font-medium leading-tight text-text-primary">
                {service?.name ?? 'Maths'}
              </p>
              <p className="mt-0.5 text-[12.5px] text-text-muted">
                {request.durationMinutes} minutes &middot;{' '}
                {request.format === 'online' ? 'Online' : 'In person'} &middot;{' '}
                {money(request.priceMinor)} to the family
              </p>
            </div>
          </div>

          <p className="mt-4 max-w-[62ch] text-[13.5px] leading-relaxed text-text-secondary">
            {request.note}
          </p>

          <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
            Times offered &middot; {request.offered.length}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {request.offered.map((option) => (
              <li
                key={option.id}
                className="rounded-[5px] border border-surface-border bg-surface-card-secondary px-3 py-2 text-[12.5px] font-medium tabular-nums text-text-primary"
              >
                {formatLessonDateTime(option.at, PLATFORM_TIME_ZONE)}
              </li>
            ))}
          </ul>
        </div>

        {/* What answering yes is actually worth, after the commission. */}
        <div className="rounded-[5px] border border-surface-border bg-surface-card px-4 py-3.5">
          <EarningsSplit grossMinor={request.priceMinor} label="You would earn" />
          <div className="mt-4">
            <DemoButton
              href={`/demo/tutor/requests/${request.slug}`}
              tone={request.urgent ? 'primary' : 'secondary'}
              className="w-full"
            >
              Open request
            </DemoButton>
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}
