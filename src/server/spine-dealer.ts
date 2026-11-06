import { loadRefurbishmentCosts } from '@/data/load';
import { requireOperator, type DemoContext } from './demo-context';
import type { PrismaClient } from './prisma-client';
import { readMaintenance } from './spine-maintenance';
import { readAssetOffer } from './spine-offers';
import { readValuationBaseline } from './valuation-baseline';

/** The dealer works with physical items, not a customer's application or agreement. */
export async function getDealerWorkspace(db: PrismaClient, context: DemoContext, assetId: string) {
  requireOperator(context);
  const [item, refurbishmentCosts, returnedItems] = await Promise.all([
    readAssetOffer(db, assetId, context.businessDate),
    loadRefurbishmentCosts(),
    db.asset.findMany({
      where: { status: 'returned' },
      orderBy: { id: 'asc' },
      select: { id: true, make: true, model: true },
    }),
  ]);
  return {
    businessDate: context.businessDate,
    asset: item.asset,
    offer: item.offer,
    releaseRevision: item.release?.revision ?? 0,
    refurbishmentCosts,
    maintenance: readMaintenance(item.release),
    returnedItems,
    valuationReason: item.release?.valuation_reason ?? null,
    valuationBaseline: await readValuationBaseline(db, assetId),
  };
}
export type DealerWorkspace = Awaited<ReturnType<typeof getDealerWorkspace>>;
