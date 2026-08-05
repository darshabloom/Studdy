import type { WorkspaceCode } from '@studdy/permissions';
import type { StuddyUserId } from './ids';
import type { IsoInstant } from './time';

/**
 * Audit foundation (Blueprint §23) — four categories; consequential audit
 * records are written in the same transaction as the business change.
 */
export const AUDIT_CATEGORIES = ['security', 'business', 'financial', 'sensitive_access'] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export interface AuditEventDraft {
  readonly category: AuditCategory;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly actorUserId: StuddyUserId | null;
  readonly actorRoleCode: string | null;
  readonly activeWorkspaceCode: WorkspaceCode | null;
  readonly correlationId: string;
  readonly occurredAt: IsoInstant;
  readonly originalValue?: Readonly<Record<string, unknown>>;
  readonly newValue?: Readonly<Record<string, unknown>>;
  readonly riskLevel: 'low' | 'medium' | 'high';
}

/** Status transition record (Statuses doc, Part One). */
export interface StatusTransitionDraft {
  readonly entityType: string;
  readonly entityId: string;
  readonly fromStatusCode: string | null;
  readonly toStatusCode: string;
  readonly actorUserId: StuddyUserId | null;
  readonly reasonCode: string | null;
  readonly correlationId: string;
  readonly occurredAt: IsoInstant;
}
