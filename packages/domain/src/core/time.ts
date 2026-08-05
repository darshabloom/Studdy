/**
 * Time primitives. All persisted instants are UTC; presentation is localised
 * with the viewer's time zone (Pacific/Auckland is the platform's first
 * market, never a hard-coded assumption).
 */

/** An instant in time, ISO 8601 UTC string form for serialisation safety. */
export type IsoInstant = string & { readonly __isoInstant?: never };

export function isoNow(clock: Clock = systemClock): IsoInstant {
  return clock.now().toISOString() as IsoInstant;
}

/** Injectable clock so domain logic stays deterministic under test. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export function fixedClock(at: Date): Clock {
  return { now: () => new Date(at.getTime()) };
}

/** A half-open interval [start, end) matching tstzrange usage (Database spec §9.6). */
export interface TimeRange {
  readonly startAt: IsoInstant;
  readonly endAt: IsoInstant;
}

export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}
