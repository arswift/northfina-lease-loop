import { beforeAll, describe, expect, it } from 'vitest';
import { loadAssets, loadPriceLists, loadResidualCurves } from '@/data/load';
import type { Asset, PriceList, ResidualCurves } from '@/data/schemas';
import {
  calculateUsedAssetValuation,
  interpolateAgeBasisPoints,
  usageLossBasisPoints,
} from './residual';

let assets: Asset[];
let priceLists: PriceList[];
let curves: ResidualCurves;

beforeAll(async () => {
  [assets, priceLists, curves] = await Promise.all([
    loadAssets(),
    loadPriceLists(),
    loadResidualCurves(),
  ]);
});

function asset(id: string): Asset {
  const found = assets.find((item) => item.id === id);
  if (!found) throw new Error(`Missing fixture ${id}`);
  return found;
}

describe('interpolateAgeBasisPoints', () => {
  it.each([
    [0, 10_000],
    [3, 9_100],
    [6, 8_200],
    [9, 7_600],
    [12, 7_000],
    [18, 6_100],
    [24, 5_200],
    [36, 4_000],
    [48, 3_100],
    [60, 2_500],
    [72, 2_500],
  ])('interpolates e-bike age %i months to %i bp', (ageMonths, expected) => {
    expect(interpolateAgeBasisPoints(curves.curves.e_bike, ageMonths)).toBe(expected);
  });

  it('supports upward segments and clamps ages before the first point', () => {
    const custom = [
      [6, 50],
      [12, 80],
    ] as const;
    expect(interpolateAgeBasisPoints(custom, 0)).toBe(5_000);
    expect(interpolateAgeBasisPoints(custom, 9)).toBe(6_500);
  });

  it.each([-1, 1.5, Number.NaN])('rejects invalid ageMonths: %s', (age) => {
    expect(() => interpolateAgeBasisPoints(curves.curves.e_bike, age)).toThrow(RangeError);
  });

  it('rejects empty or non-increasing curve points', () => {
    expect(() => interpolateAgeBasisPoints([], 0)).toThrow(RangeError);
    expect(() =>
      interpolateAgeBasisPoints(
        [
          [12, 70],
          [12, 60],
        ],
        12
      )
    ).toThrow(RangeError);
  });
});

describe('usageLossBasisPoints', () => {
  it.each([
    ['e_bike' as const, 0, 0],
    ['e_bike' as const, 999, 0],
    ['e_bike' as const, 1_000, 200],
    ['e_bike' as const, 9_500, 1_800],
    ['e_bike' as const, 18_400, 2_000],
    ['laptop' as const, 450, 600],
    ['laptop' as const, 2_000, 1_500],
    ['farm_machine' as const, 1_501, 900],
  ])('calculates capped wear loss for %s at %i units', (category, usage, expected) => {
    expect(usageLossBasisPoints(usage, curves.usage_adjustment[category])).toBe(expected);
  });

  it('rejects negative or non-integer usage values and invalid step rules', () => {
    expect(() => usageLossBasisPoints(-1, curves.usage_adjustment.e_bike)).toThrow(RangeError);
    expect(() => usageLossBasisPoints(100, { ...curves.usage_adjustment.e_bike, step: 0 })).toThrow(
      RangeError
    );
  });
});

describe('calculateUsedAssetValuation', () => {
  it('calculates ebike-003 after a 12-month first lease when battery replacement resets wear', () => {
    const returnedEbike = {
      ...asset('ebike-003'),
      condition: 'fair' as const,
      usage: { unit: 'km' as const, value: 18_400 },
      previous_lives: 1,
      status: 'returned' as const,
    };
    const result = calculateUsedAssetValuation({
      asset: returnedEbike,
      targetCondition: 'good',
      onDate: '2027-11-05',
      residualCurves: curves,
      priceLists,
      firstLeasePriceCents: 389_000,
      firstLeaseStartDate: '2026-11-05',
      resetsUsage: true,
    });
    expect(result).toEqual({
      ok: true,
      valuation: {
        basePriceCents: 389_000,
        baseSource: 'first_contract',
        ageMonths: 12,
        ageBasisPoints: 7_000,
        targetCondition: 'good',
        conditionBasisPoints: 8_500,
        effectiveUsageValue: 0,
        usageLossBasisPoints: 0,
        usageFactorBasisPoints: 10_000,
        netPriceCents: 231_455,
        valuationReason:
          'Auto residual formula (first_contract 389000c, age 12m -> 70%, good -> 85%, usage 0 km -> 100%).',
      },
    });
  });

  it('falls back to earliest price list and model year for imported assets without contract rows', () => {
    const result = calculateUsedAssetValuation({
      asset: asset('ebike-007'),
      targetCondition: 'good',
      onDate: '2026-11-05',
      residualCurves: curves,
      priceLists,
      resetsUsage: false,
    });
    expect(result).toMatchObject({
      ok: true,
      valuation: {
        basePriceCents: 549_000,
        baseSource: 'list:1',
        ageMonths: 46,
        ageBasisPoints: 3_250,
        conditionBasisPoints: 8_500,
        effectiveUsageValue: 18_400,
        usageLossBasisPoints: 2_000,
        usageFactorBasisPoints: 8_000,
        netPriceCents: 121_329,
      },
    });
  });

  it('uses the dated price list when the first lease started on a covered date without stored contract price', () => {
    const result = calculateUsedAssetValuation({
      asset: asset('laptop-004'),
      targetCondition: 'like_new',
      onDate: '2027-05-06',
      residualCurves: curves,
      priceLists,
      firstLeaseStartDate: '2026-11-06',
    });
    expect(result).toMatchObject({
      ok: true,
      valuation: {
        basePriceCents: 321_100,
        baseSource: 'list:2',
        ageMonths: 6,
        ageBasisPoints: 7_500,
        conditionBasisPoints: 9_500,
      },
    });
  });

  it('returns structured failures for missing price lists, unknown assets, bad dates and mismatched curves', () => {
    expect(
      calculateUsedAssetValuation({
        asset: asset('ebike-003'),
        targetCondition: 'good',
        onDate: '2026-11-05',
        residualCurves: curves,
        priceLists: [],
      })
    ).toEqual({ ok: false, reason: 'no_price_list' });

    expect(
      calculateUsedAssetValuation({
        asset: { ...asset('ebike-003'), id: 'unknown-999' },
        targetCondition: 'good',
        onDate: '2026-11-05',
        residualCurves: curves,
        priceLists,
      })
    ).toEqual({ ok: false, reason: 'unknown_asset' });

    expect(
      calculateUsedAssetValuation({
        asset: asset('ebike-003'),
        targetCondition: 'good',
        onDate: 'not-a-date',
        residualCurves: curves,
        priceLists,
      })
    ).toEqual({ ok: false, reason: 'invalid_date' });

    expect(
      calculateUsedAssetValuation({
        asset: { ...asset('ebike-003'), usage: { unit: 'battery_cycles', value: 10 } },
        targetCondition: 'good',
        onDate: '2026-11-05',
        residualCurves: curves,
        priceLists,
      })
    ).toEqual({ ok: false, reason: 'invalid_curve' });
  });

  it('rejects non-positive firstLeasePriceCents', () => {
    expect(() =>
      calculateUsedAssetValuation({
        asset: asset('ebike-003'),
        targetCondition: 'good',
        onDate: '2026-11-05',
        residualCurves: curves,
        priceLists,
        firstLeasePriceCents: 0,
      })
    ).toThrow(RangeError);
  });
});
