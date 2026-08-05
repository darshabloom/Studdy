import { platformSchema } from '../shared/schemas';

/**
 * One concurrency-safe global sequence feeding every human-readable
 * reference (USER-…, FAM-…, BOOK-…; Database spec §3). Declared in Drizzle
 * so schema creation and the sequence ship in the generated migrations.
 */
export const globalReferenceSeq = platformSchema.sequence('global_reference_seq', {
  startWith: '10000001',
  increment: '1',
  cycle: false,
});
