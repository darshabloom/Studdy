import { Inngest } from 'inngest';

/**
 * The Inngest client.
 *
 * INNGEST IS TRANSPORT. It decides WHEN Studdy's own commands run and retries
 * them when they fail; it owns no rule about bookings, deadlines, holds or
 * payments. Every scheduled function in `./functions` authenticates nothing and
 * decides nothing — it calls a repository command that already exists, is
 * already tested, and would behave identically if invoked by hand.
 *
 * That separation is the point. The expiry rules were written before any
 * scheduler existed and are exercised by integration tests with no scheduler in
 * sight; swapping Inngest for something else later must be a transport change,
 * not a domain one.
 *
 * KEYS ARE SERVER-ONLY. `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` are read
 * from the server environment by the SDK itself and must never be exposed as
 * `NEXT_PUBLIC_*` — a signing key in the browser bundle would let anyone invoke
 * Studdy's scheduled work.
 */
export const inngest = new Inngest({
  id: 'studdy',
});
