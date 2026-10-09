import { NextResponse } from 'next/server';
import { createLogger } from '@studdy/observability';
import { isAuthorisedJobRequest } from '@/lib/jobs/authorise';
import { reportSettlement, requeueSettlement, runSettlement } from '@/lib/jobs/settlement';

export const dynamic = 'force-dynamic';

const logger = createLogger({ job: 'settlement-route' });

/**
 * The operator's way to pay tutors — and to see what is owed first.
 *
 *   { "report": true }                                   what is owed, what is held and why
 *   { "execute": true, "expectedTotalMinor": "36000" }   send it, IF the eligible total is that
 *   { "requeue": "PAY-10000123" }                        retry an obligation that failed
 *
 * THERE IS NO DEFAULT ACTION. An empty or unrecognised body is refused, because
 * this endpoint can move real money and nothing should do so by omission.
 *
 * The execute form is a two-step by design: read the report, then send with the
 * eligible total you reviewed. If what is eligible has changed — a refund
 * flagged, a booking cancelled, a lesson newly ended — nothing is sent and the
 * response says what the total is now. Settlement is manual and weekly in the
 * approved alpha design; nothing calls this on a timer.
 *
 * Guarded by the shared job secret in the Authorization header, `POST` only. The
 * response carries Studdy references and amounts for an operator; it never
 * carries a Stripe identifier, a person, or an email address.
 */

const PAYMENT_REFERENCE = /^PAY-\d{8}$/;
// Minor units as a plain integer string: bounded so a typo cannot be a number
// larger than a safe integer, and a string so no precision is lost in transit.
const MINOR_UNITS = /^\d{1,12}$/;

export async function POST(request: Request): Promise<NextResponse> {
  if (!isAuthorisedJobRequest(request)) {
    // Deliberately uninformative: no hint whether the secret is unset or wrong.
    logger.warn('settlement job rejected');
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(await request.text());
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    if (body['report'] === true) {
      return NextResponse.json({ ok: true, ...(await reportSettlement()) });
    }

    if (body['execute'] === true) {
      const expected = body['expectedTotalMinor'];
      if (typeof expected !== 'string' || !MINOR_UNITS.test(expected)) {
        return NextResponse.json({ error: 'invalid_expected_total' }, { status: 400 });
      }
      const result = await runSettlement(BigInt(expected));
      if (result.result === 'total_changed' || result.result === 'mixed_currency') {
        return NextResponse.json({ ok: false, ...result }, { status: 409 });
      }
      return NextResponse.json({ ok: result.failed === 0, ...result });
    }

    const requeue = body['requeue'];
    if (requeue !== undefined) {
      if (typeof requeue !== 'string' || !PAYMENT_REFERENCE.test(requeue)) {
        return NextResponse.json({ error: 'invalid_payment_reference' }, { status: 400 });
      }
      const result = await requeueSettlement(requeue);
      if (result.status === 'refused') {
        const status = result.refusal === 'payment_not_found' ? 404 : 409;
        return NextResponse.json({ ok: false, ...result }, { status });
      }
      return NextResponse.json({ ok: true, status: result.status });
    }

    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  } catch {
    // The job has logged the failure with its correlation id; the response says
    // only that it failed.
    return NextResponse.json({ error: 'settlement_job_failed' }, { status: 500 });
  }
}

export function GET(): NextResponse {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}
