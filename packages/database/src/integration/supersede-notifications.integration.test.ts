import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { createDatabaseClient } from '../client';
import { auditEvents, outboxEntries } from '../schema/index';
import { supersedeHistoricalNotifications } from '../operations/supersede-historical-notifications';

/**
 * The one-off that stops the first drain emailing the past (PD-021).
 *
 * WHAT IS WORTH TESTING HERE IS THE REFUSALS, not the UPDATE. Marking rows is
 * one statement; the value of this script is entirely in what it declines to do
 * — and a guard nobody exercised is a guard that works until the day it
 * matters.
 *
 * ROBUST TO WHATEVER ELSE IS IN THE DATABASE. The blocking populations are read
 * from the real `payments` and reservation tables, which other fixtures in this
 * suite create and clean up. Every assertion below therefore either avoids
 * those paths or acknowledges them explicitly, so this file cannot fail because
 * another test happened to be running.
 */

async function databaseAvailable(): Promise<boolean> {
  try {
    const { sql } = createDatabaseClient();
    await sql`select 1`;
    await sql.end();
    return true;
  } catch {
    return false;
  }
}

const available = await databaseAvailable();

describe.skipIf(!available)('superseding historical notifications (integration)', () => {
  const createdOutboxIds: string[] = [];

  afterEach(async () => {
    const { sql, db } = createDatabaseClient();
    try {
      if (createdOutboxIds.length > 0) {
        await db.delete(outboxEntries).where(inArray(outboxEntries.id, [...createdOutboxIds]));
        createdOutboxIds.length = 0;
      }
    } finally {
      await sql.end();
    }
  });

  /** A pending outbox entry of a given type and age. Nothing else is needed. */
  async function givenPendingEntry(eventType: string, createdAt: Date): Promise<string> {
    const { sql, db } = createDatabaseClient();
    try {
      const [row] = await db
        .insert(outboxEntries)
        .values({
          eventType,
          payload: { tutorRequestId: randomUUID() },
          idempotencyKey: `test:${eventType}:${randomUUID()}`,
          correlationId: `cor_${randomUUID()}`,
          statusCode: 'pending',
          createdAt,
        })
        .returning({ id: outboxEntries.id });
      const id = row!.id;
      createdOutboxIds.push(id);
      return id;
    } finally {
      await sql.end();
    }
  }

  async function statusOf(id: string): Promise<string> {
    const { sql, db } = createDatabaseClient();
    try {
      const [row] = await db
        .select({ statusCode: outboxEntries.statusCode })
        .from(outboxEntries)
        .where(eq(outboxEntries.id, id));
      return row!.statusCode;
    } finally {
      await sql.end();
    }
  }

  const OLD = new Date('2026-01-01T00:00:00Z');
  const CUTOFF = new Date('2026-06-01T00:00:00Z');
  const RECENT = new Date('2026-08-01T00:00:00Z');

  it('reports without changing anything by default', async () => {
    const id = await givenPendingEntry('payment.required', OLD);

    const report = await supersedeHistoricalNotifications({
      apply: false,
      before: CUTOFF,
      types: ['payment.required'],
      refundsReconciled: false,
      bookingsCommunicated: false,
    });

    expect(report.applied).toBe(false);
    expect(report.supersededCount).toBe(0);
    expect(report.candidateCount).toBeGreaterThanOrEqual(1);
    // The entry is untouched, which is the whole point of a default that reports.
    expect(await statusOf(id)).toBe('pending');
  });

  it('refuses to apply without a cutoff', async () => {
    const id = await givenPendingEntry('payment.required', OLD);

    const report = await supersedeHistoricalNotifications({
      apply: true,
      before: null,
      types: ['payment.required'],
      refundsReconciled: true,
      bookingsCommunicated: true,
    });

    expect(report.applied).toBe(false);
    expect(report.refusals.join(' ')).toMatch(/--before/);
    expect(await statusOf(id)).toBe('pending');
  });

  /**
   * THE REFUSAL THAT PROTECTS REAL MONEY. `payment.refund_required` means
   * Studdy is holding a parent's payment against a booking it could not
   * confirm. Bulk-settling it would close the only signal pointing at it, so
   * asking for it is refused rather than obeyed.
   */
  it('never supersedes refund alerts, even when explicitly asked', async () => {
    const id = await givenPendingEntry('payment.refund_required', OLD);

    const report = await supersedeHistoricalNotifications({
      apply: true,
      before: CUTOFF,
      types: ['payment.refund_required'],
      refundsReconciled: true,
      bookingsCommunicated: true,
    });

    expect(report.applied).toBe(false);
    expect(report.refusals.join(' ')).toMatch(/never superseded/i);
    expect(await statusOf(id)).toBe('pending');
  });

  it('supersedes only entries older than the cutoff, and records why', async () => {
    const old = await givenPendingEntry('payment.required', OLD);
    const recent = await givenPendingEntry('payment.required', RECENT);
    // A type that was not asked for stays exactly where it is.
    const otherType = await givenPendingEntry('tutor_request.sent', OLD);

    const report = await supersedeHistoricalNotifications({
      apply: true,
      before: CUTOFF,
      types: ['payment.required'],
      // Acknowledged so this test cannot be blocked by another fixture's rows.
      refundsReconciled: true,
      bookingsCommunicated: true,
    });

    expect(report.refusals).toEqual([]);
    expect(report.applied).toBe(true);

    expect(await statusOf(old)).toBe('superseded');
    // Newer than the cutoff: still owed.
    expect(await statusOf(recent)).toBe('pending');
    // Not deliverable yet, and not this slice's decision to make.
    expect(await statusOf(otherType)).toBe('pending');

    const { sql, db } = createDatabaseClient();
    try {
      const rows = await db
        .select({ newValue: auditEvents.newValue, riskLevel: auditEvents.riskLevel })
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.action, 'notifications.historical_superseded'),
            eq(auditEvents.correlationId, report.correlationId),
          ),
        );
      expect(rows).toHaveLength(1);
      const value = rows[0]!.newValue as Record<string, unknown>;
      expect(value['before']).toBe(CUTOFF.toISOString());
      expect(value['eventTypes']).toEqual(['payment.required']);
      expect(Number(value['supersededCount'])).toBeGreaterThanOrEqual(1);
      // A deliberate suppression of customer communication is not routine.
      expect(rows[0]!.riskLevel).toBe('medium');
    } finally {
      await sql.end();
    }
  });

  /**
   * A superseded entry is invisible to the drain for the same reason a sent one
   * is: the claim query selects `pending` and nothing else. Asserted through
   * the status rather than by running a drain, because the drain's own
   * behaviour is covered next door.
   */
  it('leaves superseded entries out of the pending set', async () => {
    const id = await givenPendingEntry('payment.required', OLD);

    await supersedeHistoricalNotifications({
      apply: true,
      before: CUTOFF,
      types: ['payment.required'],
      refundsReconciled: true,
      bookingsCommunicated: true,
    });

    const { sql, db } = createDatabaseClient();
    try {
      const rows = await db
        .select({ id: outboxEntries.id })
        .from(outboxEntries)
        .where(and(eq(outboxEntries.id, id), eq(outboxEntries.statusCode, 'pending')));
      expect(rows).toHaveLength(0);
    } finally {
      await sql.end();
    }
  });
});
