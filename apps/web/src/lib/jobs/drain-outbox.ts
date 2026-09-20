import 'server-only';
import {
  claimNotificationWork,
  recordDeliveryFailed,
  recordDeliverySent,
  settleOutboxEntries,
  type NotificationWorkItem,
} from '@studdy/database';
import type { EmailProvider } from '@studdy/domain';
import { LocalPreviewEmailProvider } from '@studdy/integrations/email/local';
import {
  RESEND_PROVIDER,
  ResendEmailProvider,
  resendClient,
} from '@studdy/integrations/email/resend';
import { createLogger, newCorrelationId } from '@studdy/observability';
import { renderNotification } from '../notifications/templates';

/**
 * One drain of the transactional outbox.
 *
 * THE ORDER OF OPERATIONS IS THE SAFETY MODEL:
 *
 *   1. claim due outbox entries and MATERIALISE a delivery row per recipient,
 *      `pending`, inside one transaction — so the work list is durable before
 *      any provider is called, and a crash cannot lose the fact that a tutor
 *      was owed an email;
 *   2. send each delivery independently, with its deterministic idempotency
 *      key;
 *   3. record each outcome against its OWN row;
 *   4. settle an outbox entry only when every delivery it owes is `sent`.
 *
 * ONE FAILURE NEVER STOPS THE BATCH. Every send is in its own try/catch, so a
 * provider error on one recipient leaves that row `failed` and retryable while
 * every other message still goes. An entry whose records cannot be resolved at
 * all is backed off by the repository rather than retried forever, so a poison
 * event cannot occupy a slot in every future drain.
 *
 * IT OWNS NO RULES. Who gets told what is `@studdy/domain/notifications`; what
 * the facts are is the repository; what the words are is the template. This
 * decides only the order and what to do when the provider says no.
 */

const logger = createLogger({ job: 'drain-outbox' });

/** How many outbox entries one drain will take. Bounded, deliberately. */
const BATCH_SIZE = 25;

export interface OutboxDrainOutcome {
  readonly correlationId: string;
  readonly entriesExamined: number;
  readonly deliveriesPlanned: number;
  readonly deliveriesSent: number;
  readonly deliveriesFailed: number;
  readonly entriesSettled: number;
  readonly entriesUnresolvable: number;
  /** Entries that, on inspection, owed nobody a message. Ordinary. */
  readonly entriesNothingOwed: number;
  /**
   * Deliveries Studdy has stopped retrying, having used all
   * `MAX_DELIVERY_ATTEMPTS`.
   *
   * ALWAYS REPORTED, NEVER INFERRED FROM SILENCE. A message that has been
   * given up on is the one condition in this job that needs a person, and a
   * drain that simply stopped mentioning it would look identical to a drain
   * with nothing to do. `exhaustedDeliveries()` lists them.
   */
  readonly deliveriesExhausted: number;
  readonly durationMs: number;
}

/**
 * Which provider sends, and where mail is allowed to go.
 *
 * THE DEVELOPMENT GUARD IS NOT OPTIONAL. Seeded accounts use
 * `@local.studdy.test` addresses that do not exist, and a staging database can
 * hold real ones. Outside production, mail is either redirected to a single
 * allowlisted mailbox or handed to the in-memory local provider — never
 * addressed to whoever happens to be in the database.
 */
export interface DrainConfiguration {
  readonly provider: EmailProvider;
  readonly providerName: string;
  readonly siteUrl: string;
  readonly opsEmailAddress: string;
  readonly redirectAllTo: string | null;
  readonly environmentLabel: string | null;
}

/** The local preview inbox, shared so tests and dev can read what was "sent". */
export const localEmailInbox = new LocalPreviewEmailProvider();

/**
 * A deployment that cannot tell anybody its money is stuck.
 *
 * Thrown rather than defaulted, and thrown at CONFIGURATION time rather than
 * per message, because this is a deploy-time constant and a wrong one is
 * invisible. See `resolveOpsEmailAddress`.
 */
export class MissingOpsEmailError extends Error {
  override name = 'MissingOpsEmailError';
  constructor() {
    super('STUDDY_OPS_EMAIL must be set in production. Refusing to drain the outbox.');
  }
}

/**
 * Where `payment.refund_required` alerts go.
 *
 * REQUIRED IN PRODUCTION, WITH NO FALLBACK, because the fallback is worse than
 * a crash. `ops@local.studdy.test` is not a routable address: left in place in
 * production, every "money arrived and the booking could not be confirmed"
 * alert would be addressed to a domain that does not exist, fail at the
 * provider, and be retried on a backoff forever — so the single signal
 * pointing at a parent's trapped money would be both undelivered and
 * indistinguishable from an ordinary provider wobble.
 *
 * Outside production the synthetic default stands: local and CI runs use the
 * in-memory provider, and staging is already held behind
 * `EMAIL_DEV_REDIRECT_TO`, so nothing can be addressed to it by accident.
 */
function resolveOpsEmailAddress(isProduction: boolean): string {
  const configured = process.env.STUDDY_OPS_EMAIL;
  if (configured !== undefined && configured.trim() !== '') return configured.trim();
  if (isProduction) throw new MissingOpsEmailError();
  return 'ops@local.studdy.test';
}

export function resolveDrainConfiguration(): DrainConfiguration {
  const environment = process.env.STUDDY_ENVIRONMENT ?? 'local';
  const isProduction = environment === 'production';
  /*
   * The site URL is SERVER-CONFIGURED, never taken from a request header. An
   * email link built from a host an attacker supplied is a phishing link with
   * Studdy's name on it.
   */
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  const opsEmailAddress = resolveOpsEmailAddress(isProduction);
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_ADDRESS;
  const redirect = process.env.EMAIL_DEV_REDIRECT_TO ?? null;

  /*
   * Resend is used when it is configured. Without a key — the ordinary local
   * case — the local preview provider takes over, so the whole chain is
   * exercisable with no account and no risk of a real send.
   */
  if (apiKey === undefined || apiKey.trim() === '' || fromAddress === undefined) {
    return {
      provider: localEmailInbox,
      providerName: 'local',
      siteUrl,
      opsEmailAddress,
      redirectAllTo: null,
      environmentLabel: environment,
    };
  }

  return {
    provider: new ResendEmailProvider(resendClient(apiKey), {
      fromAddress,
      environmentLabel: isProduction ? null : environment,
    }),
    providerName: RESEND_PROVIDER,
    siteUrl,
    opsEmailAddress,
    // Outside production every message goes to the allowlisted mailbox, or
    // nowhere at all if none is configured.
    redirectAllTo: isProduction ? null : redirect,
    environmentLabel: isProduction ? null : environment,
  };
}

export async function runOutboxDrain(
  correlationId: string = newCorrelationId(),
  configuration: DrainConfiguration = resolveDrainConfiguration(),
): Promise<OutboxDrainOutcome> {
  const startedAt = Date.now();

  /*
   * A REAL PROVIDER OUTSIDE PRODUCTION WITH NOWHERE SAFE TO SEND stops here.
   * Refusing is the only correct answer: the alternative is emailing whoever a
   * development database happens to contain.
   */
  if (
    configuration.providerName !== 'local' &&
    configuration.environmentLabel !== null &&
    configuration.redirectAllTo === null
  ) {
    logger.error('outbox drain refused — non-production Resend with no EMAIL_DEV_REDIRECT_TO');
    return {
      correlationId,
      entriesExamined: 0,
      deliveriesPlanned: 0,
      deliveriesSent: 0,
      deliveriesFailed: 0,
      entriesSettled: 0,
      entriesUnresolvable: 0,
      entriesNothingOwed: 0,
      deliveriesExhausted: 0,
      durationMs: Date.now() - startedAt,
    };
  }

  const { outcome, work } = await claimNotificationWork({
    limit: BATCH_SIZE,
    opsEmailAddress: configuration.opsEmailAddress,
    redirectAllTo: configuration.redirectAllTo,
  });

  let sent = 0;
  let failed = 0;
  const touchedEntries = new Set<string>();

  for (const item of work) {
    touchedEntries.add(item.outboxEntryId);
    try {
      await sendOne(item, configuration);
      sent += 1;
    } catch (error) {
      /*
       * ONE RECIPIENT'S FAILURE IS THIS RECIPIENT'S FAILURE. The row is marked
       * `failed` and retried on the next drain; every other message in the
       * batch still goes, and the outbox entry stays open because something is
       * still owed.
       */
      failed += 1;
      const code =
        error !== null && typeof error === 'object' && 'code' in error
          ? String((error as { code: unknown }).code)
          : 'send_failed';
      await recordDeliveryFailed({ deliveryId: item.deliveryId, errorCode: code });
    }
  }

  const settled = await settleOutboxEntries({ outboxEntryIds: [...touchedEntries] });

  const result: OutboxDrainOutcome = {
    correlationId,
    entriesExamined: outcome.entriesExamined,
    deliveriesPlanned: outcome.deliveriesPlanned,
    deliveriesSent: sent,
    deliveriesFailed: failed,
    entriesSettled: settled.settled,
    entriesUnresolvable: outcome.entriesUnresolvable,
    entriesNothingOwed: outcome.entriesNothingOwed,
    deliveriesExhausted: outcome.deliveriesExhausted,
    durationMs: Date.now() - startedAt,
  };

  /*
   * COUNTS AND TIMING ONLY. Never an address, a name, a reference or a subject
   * line — this is the job whose entire input is who is being written to, so
   * the logging discipline matters here more than anywhere.
   */
  const line = { ...result };
  if (failed > 0 || result.entriesUnresolvable > 0 || result.deliveriesExhausted > 0) {
    logger.error('outbox drain finished with failures', line);
  } else if (result.deliveriesSent > 0 || result.entriesExamined > 0) {
    logger.info('outbox drain complete', line);
  }
  return result;
}

async function sendOne(item: NotificationWorkItem, configuration: DrainConfiguration) {
  const rendered = renderNotification(item, configuration.siteUrl);
  const subject =
    configuration.environmentLabel === null
      ? rendered.subject
      : `[${configuration.environmentLabel}] ${rendered.subject}`;

  const receipt = await configuration.provider.send({
    to: item.toAddress,
    subject,
    html: rendered.html,
    text: rendered.text,
    environmentLabel: configuration.environmentLabel,
    /*
     * THE SAME KEY THE DELIVERY ROW IS UNIQUE ON. This is what makes the gap
     * between "provider accepted" and "Studdy recorded it" safe: a retry after
     * a crash in that window is de-duplicated by the provider rather than
     * producing a second email.
     */
    idempotencyKey: item.idempotencyKey,
  });

  await recordDeliverySent({
    deliveryId: item.deliveryId,
    provider: configuration.providerName,
    providerMessageId: receipt.providerMessageId,
  });
}
