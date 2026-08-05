import { randomUUID } from 'node:crypto';

/** Correlation id shared across a logical operation (RequestContext, audit, outbox). */
export function newCorrelationId(): string {
  return `cor_${randomUUID()}`;
}

/** Request id unique to one HTTP request. */
export function newRequestId(): string {
  return `req_${randomUUID()}`;
}
