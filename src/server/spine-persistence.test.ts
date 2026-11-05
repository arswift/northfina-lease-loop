import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../tests/helpers/test-db';
import { demoContext, resetSpine } from '../../tests/helpers/spine';
import type { DemoContext } from './demo-context';
import type { PrismaClient } from './prisma-client';
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

describe('saved offers', () => {
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
});
