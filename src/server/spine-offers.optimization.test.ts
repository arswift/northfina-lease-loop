import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { loadAssets } from '@/data/load';
import { createTestDb } from '../../tests/helpers/test-db';
import { seedAssets } from './assets';
import type { PrismaClient } from './prisma-client';
import { cataloguePrices } from './spine-offers';

let db: PrismaClient;
let cleanup: () => Promise<void>;
beforeAll(async () => {
  ({ db, cleanup } = await createTestDb());
});
afterAll(async () => {
  await cleanup();
});
beforeEach(async () => {
  await db.assetRelease.deleteMany();
  await db.asset.deleteMany();
  await seedAssets(db, await loadAssets());
});

it('keeps readiness and source precedence when joining release records by asset ID', async () => {
  await db.assetRelease.create({
    data: {
      asset_id: 'ebike-003',
      revision: 1,
      net_price_cents: 130000,
      ready_on: '2026-11-05',
    },
  });
  await db.assetRelease.create({
    data: {
      asset_id: 'ebike-004',
      revision: 2,
      net_price_cents: null,
      ready_on: null,
    },
  });
  await db.assetRelease.create({
    data: {
      asset_id: 'laptop-004',
      revision: 3,
      net_price_cents: 100000,
      ready_on: '2027-01-01',
    },
  });
  const prices = await cataloguePrices(db, '2026-11-05');
  expect(prices['ebike-003']).toEqual({
    priceCents: 130000,
    source: 'release:1',
    releaseRevision: 1,
  });
  expect(prices['ebike-004']).toBeNull();
  expect(prices['laptop-004']).toBeNull();
  expect(prices['ebike-001']).toEqual({ priceCents: 189900, source: 'list:1', releaseRevision: 0 });
});
