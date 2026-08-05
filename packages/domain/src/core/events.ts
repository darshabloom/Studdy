import type { IsoInstant } from './time';

/**
 * Domain events + transactional outbox (ADR-0004). The event write and the
 * outbox entry are part of the same transaction as the business change;
 * delivery is asynchronous and idempotent.
 */
export interface DomainEventDraft<TPayload = Readonly<Record<string, unknown>>> {
  /** Dot-separated event name, e.g. `booking.confirmed`. */
  readonly eventType: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly payload: TPayload;
  readonly correlationId: string;
  readonly occurredAt: IsoInstant;
}

export interface OutboxEntryDraft {
  readonly eventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
  /** Deterministic key so duplicate processing is detectable. */
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly createdAt: IsoInstant;
}
