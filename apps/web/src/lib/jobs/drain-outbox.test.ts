import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationWorkItem } from '@studdy/database';
import type { EmailDeliveryReceipt, EmailMessage, EmailProvider } from '@studdy/domain';

/**
 * The drain worker's own behaviour, with the database and the provider stubbed.
 *
 * WHAT IS PROVED HERE IS THE ORDER AND THE ISOLATION — that one recipient's
 * provider failure does not stop the rest of the batch, that each outcome is
 * recorded against its own delivery, that the idempotency key reaches the
 * provider, and that a non-production run with a real provider and nowhere safe
 * to send refuses outright.
 *
 * The durable guarantees underneath — who is resolved, what settles an entry,
 * what a retry re-offers — are proved against a real database in
 * `notifications.integration.test.ts`. Stubbing those here would only test the
 * stub.
 */

const claimNotificationWork = vi.fn();
const recordDeliverySent = vi.fn();
const recordDeliveryFailed = vi.fn();
const settleOutboxEntries = vi.fn();

vi.mock('@studdy/database', () => ({
  claimNotificationWork: (...args: unknown[]) => claimNotificationWork(...args),
  recordDeliverySent: (...args: unknown[]) => recordDeliverySent(...args),
  recordDeliveryFailed: (...args: unknown[]) => recordDeliveryFailed(...args),
  settleOutboxEntries: (...args: unknown[]) => settleOutboxEntries(...args),
}));

const { runOutboxDrain } = await import('./drain-outbox');
type DrainConfiguration = Parameters<typeof runOutboxDrain>[1];

function workItem(overrides: Partial<NotificationWorkItem> = {}): NotificationWorkItem {
  return {
    deliveryId: `delivery-${Math.random().toString(36).slice(2)}`,
    outboxEntryId: 'entry-1',
    eventType: 'booking.confirmed',
    recipientRole: 'family',
    templateCode: 'booking_confirmed_family',
    toAddress: 'parent@example.test',
    idempotencyKey: 'booking.confirmed/entry-1/family',
    attempts: 0,
    context: {
      requestReference: 'LR-1',
      studentFirstName: 'Ari',
      tutorFirstName: 'Aroha',
      lessonStartAt: new Date('2026-09-29T04:30:00.000Z'),
      durationMinutes: 60,
      formatCode: 'online',
      timeZone: 'Pacific/Auckland',
      paymentDeadlineAt: new Date('2026-09-01T08:00:00.000Z'),
      amountMinor: 4000n,
      currencyCode: 'NZD',
      tutorRequestReference: 'TREQ-TESTTEST',
      subjectDisplayName: 'Mathematics',
      respondByAt: new Date('2026-09-01T06:00:00.000Z'),
      offeredStartAts: [],
      closeReasonCode: null,
      paymentReference: 'PAY-1',
      reason: null,
    },
    ...overrides,
  };
}

/** Records what it was asked to send, and can be told to refuse. */
class StubProvider implements EmailProvider {
  readonly sent: EmailMessage[] = [];
  constructor(private readonly failFor: (message: EmailMessage) => boolean = () => false) {}
  async send(message: EmailMessage): Promise<EmailDeliveryReceipt> {
    if (this.failFor(message)) {
      const error = new Error('provider refused') as Error & { code: string };
      error.code = 'rate_limited';
      throw error;
    }
    this.sent.push(message);
    return { providerMessageId: `msg_${this.sent.length}`, acceptedAt: new Date().toISOString() };
  }
}

function configuration(overrides: Partial<DrainConfiguration> = {}): DrainConfiguration {
  return {
    provider: new StubProvider(),
    providerName: 'local',
    siteUrl: 'https://studdy.example',
    opsEmailAddress: 'ops@studdy.test',
    redirectAllTo: null,
    environmentLabel: 'local',
    ...overrides,
  } as DrainConfiguration;
}

beforeEach(() => {
  vi.clearAllMocks();
  claimNotificationWork.mockResolvedValue({
    outcome: {
      entriesExamined: 0,
      deliveriesPlanned: 0,
      entriesUnresolvable: 0,
      deliveriesExhausted: 0,
    },
    work: [],
  });
  settleOutboxEntries.mockResolvedValue({ settled: 0 });
});

describe('sending', () => {
  it('renders and sends one message per work item', async () => {
    const provider = new StubProvider();
    claimNotificationWork.mockResolvedValue({
      outcome: {
        entriesExamined: 1,
        deliveriesPlanned: 2,
        entriesUnresolvable: 0,
        deliveriesExhausted: 0,
      },
      work: [
        workItem({ recipientRole: 'family', templateCode: 'booking_confirmed_family' }),
        workItem({
          recipientRole: 'tutor',
          templateCode: 'booking_confirmed_tutor',
          toAddress: 'tutor@example.test',
          idempotencyKey: 'booking.confirmed/entry-1/tutor',
        }),
      ],
    });

    const result = await runOutboxDrain('cor', configuration({ provider }));

    expect(result.deliveriesSent).toBe(2);
    expect(result.deliveriesFailed).toBe(0);
    expect(provider.sent.map((m) => m.to)).toEqual(['parent@example.test', 'tutor@example.test']);
    expect(recordDeliverySent).toHaveBeenCalledTimes(2);
  });

  /**
   * THE KEY REACHES THE PROVIDER, which is what makes a crash between "accepted"
   * and "recorded" harmless. Without it the whole retry story is a hope.
   */
  it('passes each delivery’s idempotency key to the provider', async () => {
    const provider = new StubProvider();
    claimNotificationWork.mockResolvedValue({
      outcome: {
        entriesExamined: 1,
        deliveriesPlanned: 1,
        entriesUnresolvable: 0,
        deliveriesExhausted: 0,
      },
      work: [workItem()],
    });

    await runOutboxDrain('cor', configuration({ provider }));

    expect(provider.sent[0]!.idempotencyKey).toBe('booking.confirmed/entry-1/family');
  });

  /** Non-production mail is labelled, so nobody mistakes it for the real thing. */
  it('stamps the environment on the subject outside production', async () => {
    const provider = new StubProvider();
    claimNotificationWork.mockResolvedValue({
      outcome: {
        entriesExamined: 1,
        deliveriesPlanned: 1,
        entriesUnresolvable: 0,
        deliveriesExhausted: 0,
      },
      work: [workItem()],
    });

    await runOutboxDrain('cor', configuration({ provider, environmentLabel: 'staging' }));

    expect(provider.sent[0]!.subject).toMatch(/^\[staging\] /);
  });

  it('does not stamp production mail', async () => {
    const provider = new StubProvider();
    claimNotificationWork.mockResolvedValue({
      outcome: {
        entriesExamined: 1,
        deliveriesPlanned: 1,
        entriesUnresolvable: 0,
        deliveriesExhausted: 0,
      },
      work: [workItem()],
    });

    await runOutboxDrain('cor', configuration({ provider, environmentLabel: null }));

    expect(provider.sent[0]!.subject).not.toContain('[');
  });
});

describe('one failure does not stop the batch', () => {
  /**
   * THE ISOLATION PROPERTY. A provider error on one recipient must leave that
   * row failed and retryable while every other message still goes — and must
   * not be recorded against anybody else's delivery.
   */
  it('sends the others and records the failure against its own delivery', async () => {
    const poison = workItem({
      deliveryId: 'delivery-poison',
      toAddress: 'broken@example.test',
    });
    const healthy = workItem({ deliveryId: 'delivery-ok', toAddress: 'fine@example.test' });
    const provider = new StubProvider((message) => message.to === 'broken@example.test');

    claimNotificationWork.mockResolvedValue({
      outcome: {
        entriesExamined: 1,
        deliveriesPlanned: 2,
        entriesUnresolvable: 0,
        deliveriesExhausted: 0,
      },
      work: [poison, healthy],
    });

    const result = await runOutboxDrain('cor', configuration({ provider }));

    expect(result.deliveriesSent).toBe(1);
    expect(result.deliveriesFailed).toBe(1);
    expect(provider.sent.map((m) => m.to)).toEqual(['fine@example.test']);

    expect(recordDeliveryFailed).toHaveBeenCalledTimes(1);
    expect(recordDeliveryFailed.mock.calls[0]![0]).toMatchObject({
      deliveryId: 'delivery-poison',
      errorCode: 'rate_limited',
    });
    expect(recordDeliverySent).toHaveBeenCalledTimes(1);
    expect(recordDeliverySent.mock.calls[0]![0]).toMatchObject({ deliveryId: 'delivery-ok' });
  });

  /** Ten items, three broken: the other seven still go. */
  it('keeps going across many failures', async () => {
    const work = Array.from({ length: 10 }, (_, index) =>
      workItem({ deliveryId: `d-${String(index)}`, toAddress: `p${String(index)}@example.test` }),
    );
    const provider = new StubProvider((message) =>
      ['p2@example.test', 'p5@example.test', 'p9@example.test'].includes(message.to),
    );
    claimNotificationWork.mockResolvedValue({
      outcome: {
        entriesExamined: 10,
        deliveriesPlanned: 10,
        entriesUnresolvable: 0,
        deliveriesExhausted: 0,
      },
      work,
    });

    const result = await runOutboxDrain('cor', configuration({ provider }));

    expect(result.deliveriesSent).toBe(7);
    expect(result.deliveriesFailed).toBe(3);
  });

  /** A failed send is never recorded as sent. */
  it('never acknowledges a message the provider refused', async () => {
    const provider = new StubProvider(() => true);
    claimNotificationWork.mockResolvedValue({
      outcome: {
        entriesExamined: 1,
        deliveriesPlanned: 1,
        entriesUnresolvable: 0,
        deliveriesExhausted: 0,
      },
      work: [workItem()],
    });

    await runOutboxDrain('cor', configuration({ provider }));

    expect(recordDeliverySent).not.toHaveBeenCalled();
    expect(recordDeliveryFailed).toHaveBeenCalledTimes(1);
  });
});

describe('settlement', () => {
  /** Every entry touched is offered for settlement, once. */
  it('settles the entries it touched', async () => {
    claimNotificationWork.mockResolvedValue({
      outcome: {
        entriesExamined: 2,
        deliveriesPlanned: 3,
        entriesUnresolvable: 0,
        deliveriesExhausted: 0,
      },
      work: [
        workItem({ outboxEntryId: 'entry-a' }),
        workItem({ outboxEntryId: 'entry-a', recipientRole: 'tutor' }),
        workItem({ outboxEntryId: 'entry-b' }),
      ],
    });

    await runOutboxDrain('cor', configuration());

    expect(settleOutboxEntries).toHaveBeenCalledTimes(1);
    const ids = (settleOutboxEntries.mock.calls[0]![0] as { outboxEntryIds: string[] })
      .outboxEntryIds;
    expect([...ids].sort()).toEqual(['entry-a', 'entry-b']);
  });
});

describe('the development guard', () => {
  /**
   * A REAL PROVIDER OUTSIDE PRODUCTION WITH NOWHERE SAFE TO SEND REFUSES.
   *
   * Seeded accounts use `@local.studdy.test` addresses that do not exist and a
   * staging database can hold real ones. Refusing is the only correct answer;
   * the alternative is emailing whoever the database happens to contain.
   */
  it('refuses to run with a real provider and no redirect outside production', async () => {
    const provider = new StubProvider();
    const result = await runOutboxDrain(
      'cor',
      configuration({
        provider,
        providerName: 'resend',
        environmentLabel: 'staging',
        redirectAllTo: null,
      }),
    );

    expect(result.deliveriesSent).toBe(0);
    expect(claimNotificationWork).not.toHaveBeenCalled();
    expect(provider.sent).toHaveLength(0);
  });

  it('runs with a real provider outside production once a redirect is configured', async () => {
    const provider = new StubProvider();
    claimNotificationWork.mockResolvedValue({
      outcome: {
        entriesExamined: 1,
        deliveriesPlanned: 1,
        entriesUnresolvable: 0,
        deliveriesExhausted: 0,
      },
      work: [workItem({ toAddress: 'developer@studdy.test' })],
    });

    const result = await runOutboxDrain(
      'cor',
      configuration({
        provider,
        providerName: 'resend',
        environmentLabel: 'staging',
        redirectAllTo: 'developer@studdy.test',
      }),
    );

    expect(result.deliveriesSent).toBe(1);
    expect(provider.sent[0]!.to).toBe('developer@studdy.test');
  });

  /** The local preview provider is always safe: it sends nowhere. */
  it('runs with the local provider and no redirect', async () => {
    claimNotificationWork.mockResolvedValue({
      outcome: {
        entriesExamined: 1,
        deliveriesPlanned: 1,
        entriesUnresolvable: 0,
        deliveriesExhausted: 0,
      },
      work: [workItem()],
    });

    const result = await runOutboxDrain('cor', configuration({ providerName: 'local' }));
    expect(result.deliveriesSent).toBe(1);
  });

  /** Production sends to the real recipient, unredirected. */
  it('sends to the real recipient in production', async () => {
    const provider = new StubProvider();
    claimNotificationWork.mockResolvedValue({
      outcome: {
        entriesExamined: 1,
        deliveriesPlanned: 1,
        entriesUnresolvable: 0,
        deliveriesExhausted: 0,
      },
      work: [workItem()],
    });

    await runOutboxDrain(
      'cor',
      configuration({
        provider,
        providerName: 'resend',
        environmentLabel: null,
        redirectAllTo: null,
      }),
    );

    expect(provider.sent[0]!.to).toBe('parent@example.test');
  });
});

describe('links', () => {
  /**
   * The origin comes from configuration, never from a request. An email link
   * built from a host an attacker supplied is a phishing link with Studdy's
   * name on it.
   */
  it('builds absolute links from the configured site URL', async () => {
    const provider = new StubProvider();
    claimNotificationWork.mockResolvedValue({
      outcome: {
        entriesExamined: 1,
        deliveriesPlanned: 1,
        entriesUnresolvable: 0,
        deliveriesExhausted: 0,
      },
      work: [workItem({ templateCode: 'payment_required_family' })],
    });

    await runOutboxDrain('cor', configuration({ provider, siteUrl: 'https://app.studdy.example' }));

    expect(provider.sent[0]!.html).toContain('https://app.studdy.example/requests/LR-1/pay');
  });
});

describe('giving up on a delivery', () => {
  /**
   * THE COUNT MUST REACH THE CALLER. The claim decides what has run out of
   * attempts; this job's only job here is not to swallow it — a drain that
   * reported nothing would make giving up indistinguishable from an idle tick.
   */
  it('reports what the claim gave up on', async () => {
    const provider = new StubProvider();
    claimNotificationWork.mockResolvedValue({
      outcome: {
        entriesExamined: 1,
        deliveriesPlanned: 0,
        entriesUnresolvable: 0,
        entriesNothingOwed: 0,
        deliveriesExhausted: 2,
      },
      work: [],
    });

    const result = await runOutboxDrain('cor', configuration({ provider }));

    expect(result.deliveriesExhausted).toBe(2);
    // Nothing was retried: an exhausted delivery is never handed back as work.
    expect(provider.sent).toHaveLength(0);
    expect(recordDeliveryFailed).not.toHaveBeenCalled();
  });

  it('is an idle tick when nothing has been given up on', async () => {
    const provider = new StubProvider();
    const result = await runOutboxDrain('cor', configuration({ provider }));
    expect(result.deliveriesExhausted).toBe(0);
  });
});
