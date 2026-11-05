import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { answersFromCustomer } from '@/domain/question-flow';
import { createTestDb } from '../../tests/helpers/test-db';
import { demoContext, prepareApplication, resetSpine } from '../../tests/helpers/spine';
import type { DemoContext } from './demo-context';
import type { PrismaClient } from './prisma-client';
import { submitApplication } from './spine-applications';
import { createQuote } from './spine-quotes';

let db: PrismaClient;
let cleanup: () => Promise<void>;
let aino: DemoContext;
beforeAll(async () => {
  ({ db, cleanup } = await createTestDb());
});
afterAll(async () => {
  await cleanup();
});
beforeEach(async () => {
  await resetSpine(db);
  aino = await demoContext();
});

describe('saved offers and applications', () => {
  it('returns the same offer for a retry and rejects a reused key with different money', async () => {
    const input = {
      requestId: randomUUID(),
      assetId: 'ebike-003',
      termMonths: 36,
      downPaymentCents: 0,
      startDate: '2026-11-06',
    };
    const quote = await createQuote(db, aino, input);
    expect(await createQuote(db, { ...aino, businessDate: '2026-11-06' }, input)).toEqual(quote);
    await expect(createQuote(db, aino, { ...input, downPaymentCents: 1 })).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
    });
    expect(await db.quote.count()).toBe(1);
    expect(await db.auditLog.count()).toBe(1);
  });

  it('rejects an unavailable asset without saving an offer', async () => {
    const input = {
      requestId: randomUUID(),
      assetId: 'ebike-007',
      termMonths: 36,
      downPaymentCents: 0,
      startDate: '2026-11-05',
    };
    await expect(createQuote(db, aino, input)).rejects.toMatchObject({ code: 'ASSET_UNAVAILABLE' });
    expect(await db.quote.count()).toBe(0);
    expect(await db.auditLog.count()).toBe(0);
  });

  it('prunes inactive answers yet recognizes the same raw request on retry', async () => {
    const quote = await createQuote(db, aino, {
      requestId: randomUUID(),
      assetId: 'ebike-003',
      termMonths: 36,
      downPaymentCents: 0,
      startDate: '2026-11-05',
    });
    const input = {
      requestId: randomUUID(),
      quoteId: quote.id,
      answers: {
        ...answersFromCustomer(aino.customer),
        q_usage_purpose: 'commuting',
        q_farm_registry: 'inactive-private-note',
      },
    };
    const application = await submitApplication(db, aino, input);
    expect(application.decision).toBe('approved');
    expect(application.answers).not.toHaveProperty('q_farm_registry');
    expect(await submitApplication(db, { ...aino, businessDate: '2026-12-01' }, input)).toEqual(
      application
    );
    await expect(
      submitApplication(db, aino, {
        ...input,
        answers: { ...input.answers, q_usage_purpose: 'delivery' },
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(await db.application.count()).toBe(1);
    const audit = await db.auditLog.findMany();
    expect(JSON.stringify(audit)).not.toContain('inactive-private-note');
    expect(JSON.stringify(audit)).not.toContain(aino.customer.email);
  });

  it('records a refusal for a minor without reserving the physical item', async () => {
    const mikko = await demoContext('cust-mikko');
    const { application } = await prepareApplication(db, mikko, { assetId: 'laptop-008' });
    expect(application.decision).toBe('declined');
    expect(application.reasons).toContain('under_age');
    expect(await db.contract.count()).toBe(0);
    expect(await db.assetLease.count()).toBe(0);
    expect((await db.asset.findUniqueOrThrow({ where: { id: 'laptop-008' } })).status).toBe(
      'available'
    );
  });
});
