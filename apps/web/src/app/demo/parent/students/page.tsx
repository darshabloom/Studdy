import { ParentShell } from '@/components/demo/demo-shells';
import {
  Chip,
  Disc,
  EditAffordance,
  OpenMark,
  Panel,
  PanelBody,
  PayChip,
} from '@/components/demo/kit';
import { CADENCE_LABEL, JACOB, PRIYA, STACEY, serviceById } from '@/lib/demo/fixtures';
import { isPaid, lessonsForStudent, spanLabel, withPaid } from '@/lib/demo/schedule';

export const metadata = { title: 'Students' };

/**
 * THE CHILDREN ON A FAMILY ACCOUNT — a list, with one entry in it.
 *
 * Navigation used to go straight to "Jacob", which made the product read as if
 * a family could only ever have one child. Studdy's account is the family, and
 * each child has their own tutors and subjects, so the way in is a list of
 * students and an obvious place to add another.
 *
 * `Add child` is inert on purpose and says so: the demo has no backend to
 * create a student in, and pretending otherwise would be the one dishonest
 * control on the page.
 */
export default async function ParentStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string }>;
}) {
  const { paid: paidParam } = await searchParams;
  const paid = isPaid(paidParam);
  const now = new Date();
  const { upcoming, past } = lessonsForStudent(JACOB.slug, now, { family: true, paid });
  const next = upcoming[0] ?? null;
  const service = serviceById(JACOB.serviceId);

  return (
    <ParentShell active="/demo/parent/students" paid={paid}>
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
          {PRIYA.name}
        </p>
        <h1 className="mt-1.5 font-display text-[30px] font-semibold leading-tight tracking-[-0.018em] text-text-primary">
          Students
        </h1>
        <p className="mt-1.5 max-w-[62ch] text-[13.5px] text-text-muted">
          Everyone on your family account, with their own tutors, subjects and lessons.
        </p>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Panel href={withPaid('/demo/parent/student', paid)}>
          <PanelBody className="flex h-full flex-col gap-3.5">
            <div className="flex items-start gap-3.5">
              <Disc initials={JACOB.initials} size="lg" />
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-[20px] font-semibold leading-tight text-text-primary">
                  {JACOB.firstName}
                </h2>
                <p className="mt-1 text-[13px] text-text-muted">Year {JACOB.schoolYear}</p>
              </div>
              <OpenMark label="" />
            </div>

            <div className="rounded-[5px] border border-surface-border bg-surface-card-secondary px-3.5 py-3">
              <div className="flex items-center gap-2.5">
                <Disc initials={STACEY.initials} size="sm" />
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-text-primary">
                    {service?.name ?? 'Maths'}
                  </p>
                  <p className="text-[12.5px] text-text-muted">with {STACEY.firstName}</p>
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <Chip tone="current">{CADENCE_LABEL[JACOB.cadence]} tutoring</Chip>
                <Chip tone="neutral">{JACOB.lessonsSoFar} lessons so far</Chip>
              </div>
            </div>

            <div className="mt-auto border-t border-surface-border pt-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
                Next lesson
              </p>
              {next === null ? (
                <p className="mt-1 text-[13.5px] text-text-secondary">Nothing booked</p>
              ) : (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold tabular-nums text-text-primary">
                    {spanLabel(next.at, next.durationMinutes)}
                  </span>
                  <PayChip payment={next.payment} />
                </div>
              )}
              <p className="mt-1.5 text-[12.5px] text-text-muted">
                {past.length} lesson records &middot; {upcoming.length} coming up
              </p>
            </div>
          </PanelBody>
        </Panel>

        {/* The second slot, which is what says a family can have more than one. */}
        <Panel tone="quiet" className="border-dashed">
          <PanelBody className="flex h-full flex-col items-start justify-center gap-2.5 py-7">
            <span
              aria-hidden
              className="flex h-[44px] w-[44px] items-center justify-center rounded-full border border-dashed border-brand/40 text-[22px] text-brand"
            >
              +
            </span>
            <p className="font-display text-[17px] font-medium text-text-primary">Add a child</p>
            <p className="max-w-[36ch] text-[12.5px] leading-relaxed text-text-muted">
              Each child gets their own year level, subjects, tutors and lesson history, all on one
              family account.
            </p>
            <EditAffordance label="Add child">
              <p>Adding children is not simulated in this demo.</p>
            </EditAffordance>
          </PanelBody>
        </Panel>
      </div>
    </ParentShell>
  );
}
