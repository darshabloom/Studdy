import { randomUUID } from 'node:crypto';
import { and, count, desc, eq, inArray, lt, sql as raw } from 'drizzle-orm';
import { createDatabaseClient } from '../client';
import { auditEvents, outboxEntries } from '../schema/index';

/**
 * THE ONE-OFF THAT STOPS THE FIRST DRAIN EMAILING THE PAST.
 *
 * The outbox has been written to since payment slice 1 and nothing has ever
 * drained it. `resolveContext` refuses only entries whose RECORDS HAVE GONE,
 * and nothing in this schema is ever hard-deleted — so every historical entry
 * resolves cleanly and would be sent. Without this, switching the drain on
 * tells families to pay for lessons that expired weeks ago and congratulates
 * them on bookings that have already happened.
 *
 * WHY A SCRIPT AND NOT A MIGRATION. A migration would run automatically on
 * every environment including empty ones, is immutable once applied, and would
 * bury an operational judgement inside schema history. This is an operational
 * act taken once per environment by a person who has looked at the numbers,
 * which is exactly what a migration must never be.
 *
 * WHY NOT A DATE CUTOFF IN THE DRAIN (the rejected alternative). A permanent
 * `created_at >=` filter would leave these entries `pending` for ever, and
 * `pending` currently means OWED. Breaking that would make the status
 * unreadable — "owed, or abandoned, and you cannot tell which without knowing
 * a constant" — and would silently pre-decide the same question for the
 * `tutor_request.*` slice, at the one moment it should be asked afresh.
 * Superseding leaves `pending` meaning exactly what it says.
 *
 * WHAT IT REFUSES TO DECIDE. Two populations are never swept up, because both
 * need a person and neither is recoverable afterwards:
 *
 *   1. `payment.refund_required` — an operations alert meaning Studdy holds a
 *      parent's money against a booking it could not confirm. Bulk-settling it
 *      would close the only signal pointing at trapped funds. NEVER touched
 *      by this script, whatever is passed to it.
 *   2. `booking.confirmed` for a lesson that has NOT YET HAPPENED — a real
 *      booking whose family and tutor may never have been told anything.
 *
 * Both are surfaced as blocking findings and must be acknowledged explicitly
 * on the command line. The acknowledgement records the exact ids it covered in
 * the audit event, so "we dealt with those" is a fact with a list attached
 * rather than a memory.
 *
 * Usage:
 *
 *   pnpm db:notifications:supersede
 *       Report only. Changes nothing. Always start here.
 *
 *   pnpm db:notifications:supersede --apply --before=2026-09-20T00:00:00Z \
 *       [--refunds-reconciled] [--bookings-communicated] [--types=a,b]
 */

/**
 * Customer-facing, currently deliverable, and safe to supersede once the two
 * blocking populations have been dealt with by hand.
 *
 * `payment.refund_required` is deliberately absent and is rejected if passed.
 * The `tutor_request.*` and `intended_lesson_request.*` types are absent for a
 * different reason: they are not deliverable yet, so superseding them now would
 * pre-empt a decision that belongs to the slice that starts delivering them.
 * That slice can re-run this script with `--types` and get the same audit
 * trail.
 */
const DEFAULT_SUPERSEDABLE_TYPES = ['payment.required', 'booking.confirmed'] as const;

/** Never superseded in bulk, by any invocation. */
const NEVER_SUPERSEDE = ['payment.refund_required'] as const;

export interface SupersedeOptions {
  readonly apply: boolean;
  readonly before: Date | null;
  readonly types: readonly string[];
  readonly refundsReconciled: boolean;
  readonly bookingsCommunicated: boolean;
  readonly actorUserId?: string | null;
}

export interface PendingByType {
  readonly eventType: string;
  readonly pending: number;
  readonly oldest: Date | null;
  readonly newest: Date | null;
}

export interface BlockingRefund {
  readonly paymentId: string;
  readonly paymentReference: string;
  readonly totalChargedMinor: string;
  readonly currencyCode: string;
  readonly refundRequiredAt: Date;
}

export interface BlockingFutureBooking {
  readonly outboxEntryId: string;
  readonly requestReference: string;
  readonly lessonStartAt: Date;
}

export interface SupersedeReport {
  readonly correlationId: string;
  readonly pendingByType: readonly PendingByType[];
  readonly blockingRefunds: readonly BlockingRefund[];
  readonly blockingFutureBookings: readonly BlockingFutureBooking[];
  readonly candidateCount: number;
  readonly applied: boolean;
  readonly supersededCount: number;
  readonly refusals: readonly string[];
}

/**
 * Inspect, and — only when explicitly told to, and only when nothing is
 * outstanding — supersede.
 *
 * REPORTING IS THE DEFAULT AND THE APPLY PATH IS A SUPERSET OF IT, so the
 * numbers a person approves are the numbers that are acted on, read in the
 * same transaction rather than in an earlier run they are remembering.
 */
export async function supersedeHistoricalNotifications(
  options: SupersedeOptions,
): Promise<SupersedeReport> {
  const { sql, db } = createDatabaseClient();
  const correlationId = `cor_${randomUUID()}`;
  const now = new Date();

  const forbidden = options.types.filter((type) =>
    (NEVER_SUPERSEDE as readonly string[]).includes(type),
  );

  try {
    return await db.transaction(async (tx) => {
      const refusals: string[] = [];

      // --- what is actually in there, whatever else happens ----------------
      const counts = await tx
        .select({
          eventType: outboxEntries.eventType,
          pending: count(),
          oldest: raw<Date>`min(${outboxEntries.createdAt})`,
          newest: raw<Date>`max(${outboxEntries.createdAt})`,
        })
        .from(outboxEntries)
        .where(eq(outboxEntries.statusCode, 'pending'))
        .groupBy(outboxEntries.eventType)
        .orderBy(desc(count()));

      /*
       * BLOCKING POPULATION 1 — real money Studdy is holding.
       *
       * Read from `payments` rather than from the outbox, because the outbox
       * entry is only the notification OF the problem; the problem is the
       * payment row, and it is still true whether or not anybody was emailed.
       */
      const refundRows = await tx.execute(raw`
        select p.id, p.reference, p.total_charged_minor, p.currency_code, p.refund_required_at
        from payments.payments p
        where p.refund_required_at is not null
          and p.status_code = 'succeeded'
        order by p.refund_required_at asc`);

      const blockingRefunds: BlockingRefund[] = refundRows.map((row) => ({
        paymentId: row['id'] as string,
        paymentReference: row['reference'] as string,
        totalChargedMinor: String(row['total_charged_minor']),
        currencyCode: row['currency_code'] as string,
        refundRequiredAt: row['refund_required_at'] as Date,
      }));

      /*
       * BLOCKING POPULATION 2 — bookings that have not happened yet.
       *
       * A pending `booking.confirmed` whose lesson is still in the future is a
       * confirmed booking nobody may have been told about. Superseding it
       * silently is the one outcome that could cost a family a lesson they
       * paid for, so it stops the run until a person says otherwise.
       */
      /*
       * THE INSTANT CROSSES AS TEXT AND IS CAST IN SQL, not as a `Date`.
       * postgres-js binds a raw template parameter as a string; handed a
       * `Date` it fails inside the driver with "Received an instance of Date",
       * which reads like a bug in the query rather than in its parameter.
       */
      const futureRows = await tx.execute(raw`
        select e.id as outbox_entry_id, ilr.reference as request_reference, r.start_at
        from audit.outbox_entries e
        join bookings.intended_lesson_requests ilr
          on ilr.id = (e.payload ->> 'intendedLessonRequestId')::uuid
        join availability.tutor_time_reservations r
          on r.tutor_request_id = (e.payload ->> 'tutorRequestId')::uuid
         and r.reservation_type_code = 'booking_confirmed'
         and r.status_code = 'active'
        where e.status_code = 'pending'
          and e.event_type = 'booking.confirmed'
          and r.start_at > ${now.toISOString()}::timestamptz
        order by r.start_at asc`);

      const blockingFutureBookings: BlockingFutureBooking[] = futureRows.map((row) => ({
        outboxEntryId: row['outbox_entry_id'] as string,
        requestReference: row['request_reference'] as string,
        lessonStartAt: row['start_at'] as Date,
      }));

      // --- what would be superseded ----------------------------------------
      const cutoff = options.before;
      const candidateWhere =
        cutoff === null
          ? and(
              eq(outboxEntries.statusCode, 'pending'),
              inArray(outboxEntries.eventType, [...options.types]),
            )
          : and(
              eq(outboxEntries.statusCode, 'pending'),
              inArray(outboxEntries.eventType, [...options.types]),
              lt(outboxEntries.createdAt, cutoff),
            );

      const [candidates] = await tx
        .select({ total: count() })
        .from(outboxEntries)
        .where(candidateWhere);
      const candidateCount = candidates?.total ?? 0;

      // --- every reason this must not proceed ------------------------------
      if (forbidden.length > 0) {
        refusals.push(
          `These event types are never superseded in bulk: ${forbidden.join(', ')}. ` +
            'Reconcile the underlying payments instead.',
        );
      }
      if (options.apply && cutoff === null) {
        refusals.push('--before=<ISO 8601 instant> is required with --apply.');
      }
      if (options.apply && blockingRefunds.length > 0 && !options.refundsReconciled) {
        refusals.push(
          `${String(blockingRefunds.length)} payment(s) are flagged refund_required and not yet ` +
            'reconciled. Deal with each, then re-run with --refunds-reconciled.',
        );
      }
      if (options.apply && blockingFutureBookings.length > 0 && !options.bookingsCommunicated) {
        refusals.push(
          `${String(blockingFutureBookings.length)} confirmed booking(s) are still in the future ` +
            'and may never have been announced. Contact those families and tutors, then re-run ' +
            'with --bookings-communicated.',
        );
      }

      const report: SupersedeReport = {
        correlationId,
        pendingByType: counts.map((row) => ({
          eventType: row.eventType,
          pending: row.pending,
          oldest: row.oldest,
          newest: row.newest,
        })),
        blockingRefunds,
        blockingFutureBookings,
        candidateCount,
        applied: false,
        supersededCount: 0,
        refusals,
      };

      if (!options.apply || refusals.length > 0) return report;

      /*
       * Narrowing, not a second rule. `--apply` without `--before` is already
       * refused above; the compiler cannot see that through the array, and an
       * assertion here would be a worse answer than a guard that simply
       * reports instead of writing with no cutoff.
       */
      if (cutoff === null) return report;

      /*
       * THE WRITE. `superseded` is terminal and nothing claims it: the drain
       * selects `status_code = 'pending'` only, so these entries are out of
       * every future batch without a single rule changing anywhere else.
       *
       * `processed_at` is set because they HAVE been dealt with — by a
       * decision rather than by a send, which is what the audit event records.
       */
      const updated = await tx
        .update(outboxEntries)
        .set({ statusCode: 'superseded', processedAt: now, updatedAt: now })
        .where(candidateWhere)
        .returning({ id: outboxEntries.id });

      /*
       * ONE AUDIT ROW FOR THE WHOLE OPERATION, carrying the cutoff, the types,
       * the counts and BOTH acknowledgement lists. The per-entry evidence is
       * the rows themselves — `status_code = 'superseded'` with this
       * `processed_at` — so the pair answers "what was suppressed, and on what
       * basis" without duplicating one row per entry into the audit log.
       */
      await tx.insert(auditEvents).values({
        category: 'business',
        action: 'notifications.historical_superseded',
        entityType: 'outbox_entries',
        entityId: null,
        actorUserId: options.actorUserId ?? null,
        correlationId,
        occurredAt: now,
        newValue: {
          before: cutoff.toISOString(),
          eventTypes: [...options.types],
          supersededCount: updated.length,
          refundsAcknowledged: blockingRefunds.map((refund) => refund.paymentReference),
          bookingsAcknowledged: blockingFutureBookings.map((entry) => entry.requestReference),
        },
        // A deliberate suppression of customer communication. Not routine.
        riskLevel: 'medium',
      });

      return { ...report, applied: true, supersededCount: updated.length };
    });
  } finally {
    await sql.end();
  }
}

/* -------------------------------------------------------------------------- */

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function value(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.find((argument) => argument.startsWith(prefix));
  return found === undefined ? null : found.slice(prefix.length);
}

function formatInstant(value: Date | null): string {
  return value === null ? '—' : value.toISOString();
}

async function main(): Promise<void> {
  const beforeRaw = value('before');
  const before = beforeRaw === null ? null : new Date(beforeRaw);
  if (before !== null && Number.isNaN(before.getTime())) {
    console.error(`--before is not a valid instant: ${beforeRaw ?? ''}`);
    process.exitCode = 1;
    return;
  }

  const typesRaw = value('types');
  const types =
    typesRaw === null
      ? [...DEFAULT_SUPERSEDABLE_TYPES]
      : typesRaw
          .split(',')
          .map((entry) => entry.trim())
          .filter((entry) => entry !== '');

  const report = await supersedeHistoricalNotifications({
    apply: flag('apply'),
    before,
    types,
    refundsReconciled: flag('refunds-reconciled'),
    bookingsCommunicated: flag('bookings-communicated'),
  });

  console.log('\nPending outbox entries by event type');
  console.log('------------------------------------');
  if (report.pendingByType.length === 0) {
    console.log('  (none)');
  }
  for (const row of report.pendingByType) {
    console.log(
      `  ${row.eventType.padEnd(34)} ${String(row.pending).padStart(6)}   ` +
        `${formatInstant(row.oldest)} .. ${formatInstant(row.newest)}`,
    );
  }

  console.log(
    `\nWould supersede: ${String(report.candidateCount)} entry(ies) in ${types.join(', ')}`,
  );

  if (report.blockingRefunds.length > 0) {
    console.log('\nBLOCKING — payments flagged refund_required (reconcile each by hand)');
    console.log('--------------------------------------------------------------------');
    for (const refund of report.blockingRefunds) {
      console.log(
        `  ${refund.paymentReference}  ${refund.totalChargedMinor} ${refund.currencyCode}  ` +
          `flagged ${refund.refundRequiredAt.toISOString()}`,
      );
    }
  }

  if (report.blockingFutureBookings.length > 0) {
    console.log('\nBLOCKING — confirmed bookings still in the future (contact them by hand)');
    console.log('-----------------------------------------------------------------------');
    for (const booking of report.blockingFutureBookings) {
      console.log(
        `  ${booking.requestReference}  lesson starts ${booking.lessonStartAt.toISOString()}`,
      );
    }
  }

  if (report.refusals.length > 0) {
    console.log('\nRefused:');
    for (const refusal of report.refusals) console.log(`  - ${refusal}`);
    process.exitCode = 1;
    return;
  }

  if (report.applied) {
    console.log(
      `\nSuperseded ${String(report.supersededCount)} entry(ies). ` +
        `Audit correlation id: ${report.correlationId}`,
    );
  } else {
    console.log('\nReport only. Nothing changed. Re-run with --apply --before=<instant> to act.');
  }
}

/* Run only when invoked directly, so the function stays importable by tests. */
if (
  process.argv[1] !== undefined &&
  process.argv[1].includes('supersede-historical-notifications')
) {
  await main();
}
