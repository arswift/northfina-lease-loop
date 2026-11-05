import { loadAssets, loadCustomers } from '@/data/load';
import { seedAssets } from '@/server/assets';
import type { DemoContext } from '@/server/demo-context';
import type { PrismaClient } from '@/server/prisma-client';

export async function resetSpine(db: PrismaClient) {
  await db.invoice.deleteMany();
  await db.assetLease.deleteMany();
  await db.contract.deleteMany();
  await db.application.deleteMany();
  await db.quote.deleteMany();
  await db.assetRelease.deleteMany();
  await db.auditLog.deleteMany();
  await db.asset.deleteMany();
  await seedAssets(db, await loadAssets());
}

export async function demoContext(
  customerId = 'cust-aino',
  businessDate = '2026-11-05',
  operator = false
): Promise<DemoContext> {
  const customer = (await loadCustomers()).find((item) => item.id === customerId);
  if (!customer) throw new Error('Unknown fixture customer');
  return {
    customer,
    businessDate,
    operator,
    simulated: true,
    actor: `demo:${operator ? 'operator' : 'customer'}:${customerId}`,
  };
}
