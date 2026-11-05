import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../tests/helpers/test-db';
import { createLease, demoContext, resetSpine } from '../../tests/helpers/spine';
import type { DemoContext } from './demo-context';
import type { PrismaClient } from './prisma-client';
import { endLease } from './spine-end';
import { issueInvoices } from './spine-invoices';
import { getContract } from './spine-views';

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

async function returned(choice: 'return' | 'pass_on' = 'return') {
  const contract = await createLease(db, aino, { termMonths: 12 });
  const endContext = { ...aino, businessDate: contract.endDate };
  await issueInvoices(db, endContext, contract.id);
  const input = {
    requestId: randomUUID(),
    choice,
    condition: 'fair' as const,
    usageValue: 18400,
    ...(choice === 'pass_on' ? { nextCustomerId: 'cust-lena' } : {}),
  };
  const closed = await endLease(db, endContext, contract.id, input);
  return { contract, endContext, input, closed };
}

describe('closing the agreement', () => {
  it('returns the item and releases its active allocation exactly once', async () => {
    const { contract, endContext, input, closed } = await returned();
    expect(closed.status).toBe('returned');
    expect(
      await endLease(db, { ...endContext, businessDate: '2027-12-01' }, contract.id, input)
    ).toEqual(closed);
    expect(
      (await db.asset.findUniqueOrThrow({ where: { id: contract.assetId } })).previous_lives
    ).toBe(1);
    expect(await db.assetLease.count()).toBe(0);
  });

  it('records a nominated successor without changing the old agreement customer', async () => {
    const { contract, closed } = await returned('pass_on');
    expect(closed.status).toBe('passed_on');
    const original = await db.contract.findUniqueOrThrow({ where: { id: contract.id } });
    expect(original).toMatchObject({
      customer_id: 'cust-aino',
      status: 'passed_on',
      next_customer_id: 'cust-lena',
    });
    const release = await db.assetRelease.findUniqueOrThrow({
      where: { asset_id: contract.assetId },
    });
    expect(release.reserved_for_customer_id).toBe('cust-lena');
    expect(release.net_price_cents).toBeNull();
    expect(await db.assetLease.count()).toBe(0);
  });

  it('buys at the locked net buyout, taxes it on the buyout date and closes the allocation', async () => {
    const contract = await createLease(db, aino, { termMonths: 12 });
    const endContext = { ...aino, businessDate: contract.endDate };
    await issueInvoices(db, endContext, contract.id);
    const input = {
      requestId: randomUUID(),
      choice: 'buy' as const,
      condition: 'good' as const,
      usageValue: 1000,
    };
    const bought = await endLease(db, endContext, contract.id, input);
    expect(bought.status).toBe('bought');
    expect(bought.invoices.find((invoice) => invoice.kind === 'buyout')).toMatchObject({
      netCents: 155600,
      vatCents: 40456,
      grossCents: 196056,
    });
    expect(await endLease(db, endContext, contract.id, input)).toEqual(bought);
    await expect(
      endLease(db, endContext, contract.id, { ...input, choice: 'return' })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(await db.assetLease.count()).toBe(0);
  });
});

describe('lifecycle guards and evidence', () => {
  it('blocks an early end and does not change money, status or audit', async () => {
    const contract = await createLease(db, aino);
    const auditsBefore = await db.auditLog.count();
    await expect(
      endLease(db, aino, contract.id, {
        requestId: randomUUID(),
        choice: 'return',
        condition: 'good',
        usageValue: 0,
      })
    ).rejects.toMatchObject({ code: 'END_NOT_ALLOWED', details: { reason: 'too_early' } });
    expect((await getContract(db, aino, contract.id)).status).toBe('active');
    expect(await db.auditLog.count()).toBe(auditsBefore);
    expect(await db.invoice.count()).toBe(0);
  });

  it('deduplicates two overlapping invoice requests and keeps one audit event', async () => {
    const contract = await createLease(db, aino);
    await Promise.all([issueInvoices(db, aino, contract.id), issueInvoices(db, aino, contract.id)]);
    expect(await db.invoice.count()).toBe(1);
    expect(await db.auditLog.count({ where: { action: 'invoices.issued' } })).toBe(1);
  });
});
