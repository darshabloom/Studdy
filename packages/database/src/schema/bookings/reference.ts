import { randomBytes } from 'node:crypto';

/**
 * Random public reference for a Tutor Request.
 *
 * NOT sequential, deliberately. Every other entity draws from
 * `platform.global_reference_seq`, but a fan-out writes its ILR and its Tutor
 * Requests in one transaction with nothing else consuming the sequence, so
 * sequential references came out contiguous — LR-10000490 followed by
 * TREQ-10000491/492/493. That gave two correlation channels:
 *
 *   1. anyone holding the LR- reference could derive the TREQ- references,
 *      and the gap between them revealed the fan-out size;
 *   2. two tutors comparing their own references could tell they had been
 *      invited to the same request from the adjacency alone.
 *
 * Channel 2 does not depend on the LR- reference staying private, so "never
 * show tutors an LR- reference" was a policy rather than a control.
 *
 * Crockford base32 without I, L, O and U, so a reference can be read aloud and
 * transcribed unambiguously. Ten characters over 32 symbols is ~50 bits; the
 * unique constraint on the column catches any collision.
 *
 * The same value is produced database-side by
 * `bookings.generate_tutor_request_reference()` (reviewed-sql/functions/0006),
 * which is the column default for any writer that is not this application.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generateTutorRequestReference(): string {
  const bytes = randomBytes(10);
  let suffix = '';
  for (const byte of bytes) {
    suffix += ALPHABET[byte % ALPHABET.length];
  }
  return `TREQ-${suffix}`;
}
