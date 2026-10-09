import { NextResponse } from 'next/server';
import { createLogger } from '@studdy/observability';
import { isAuthorisedJobRequest } from '@/lib/jobs/authorise';
import { executeRefund, reportRefunds, settleOpenRefunds } from '@/lib/jobs/refunds';

export const dynamic = 'force-dynamic';

const logger = createLogger({ job: 'refunds-route' });

/**
 * The operator's way to give a family's money back — and to see what is waiting.
 *
 *   { "paymentReference": "PAY-10000123" }   refund that payment, on purpose
 *   { "report": true }                       what is awaiting a decision, and refund counts
 *   (no body)                                finish refunds already started
 *
 * Guarded by the shared job secret in the Authorization header, and `POST` only:
 * every one of these changes state or reveals money, so a `GET` is refused (405).
 *
 * A REFUND IS NEVER STARTED BY THE SCHEDULER, only by the first form above. The
 * approved late-success rule is that Studdy neither confirms silently nor
 * refunds silently, so a person names the payment, and the family is emailed
 * once Stripe has accepted it.
 *
 * The response carries Studdy references and amounts for an operator. It never
 * carries a Stripe identifier or a person.
 */

const PAYMENT_REFERENCE = /^PAY-\d{8}$/;

export async function POST(request: Request): Promise<NextResponse> {
  if (!isAuthorisedJobRequest(request)) {
    // Deliberately uninformative: no hint whether the secret is unset or wrong.
    logger.warn('refund job rejected');
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  const text = await request.text();
  if (text.trim() !== '') {
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }
  }

  try {
    const reference = body['paymentReference'];
    if (reference !== undefined) {
      if (typeof reference !== 'string' || !PAYMENT_REFERENCE.test(reference)) {
        return NextResponse.json({ error: 'invalid_payment_reference' }, { status: 400 });
      }
      const result = await executeRefund(reference);
      if (result.result === 'refused') {
        // 404 for "no such payment", 409 for "not in a state that can be refunded".
        const status = result.refusal === 'payment_not_found' ? 404 : 409;
        return NextResponse.json({ ok: false, ...result }, { status });
      }
      return NextResponse.json({ ok: result.result !== 'failed', ...result });
    }

    if (body['report'] === true) {
      const report = await reportRefunds();
      return NextResponse.json({
        ok: true,
        awaitingRefund: report.awaitingRefund.map((row) => ({
          paymentReference: row.paymentReference,
          amountMinor: row.amountMinor.toString(),
          currencyCode: row.currencyCode,
          flaggedAt: row.flaggedAt.toISOString(),
        })),
        byStatus: report.byStatus,
      });
    }

    const outcome = await settleOpenRefunds();
    return NextResponse.json({ ok: true, ...outcome });
  } catch {
    // The job has logged the failure with its correlation id; the response says
    // only that it failed.
    return NextResponse.json({ error: 'refund_job_failed' }, { status: 500 });
  }
}

export function GET(): NextResponse {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}
