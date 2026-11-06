import type { Asset, AssetCondition, PriceList, ResidualCurves } from '@/data/schemas';
import { completedMonthsBetween, isIsoDate } from './calendar';
import { decimalToScaled, multiplyRatio } from './money-arithmetic';
import { listPriceOn } from './price-list';

export type UsedAssetValuation = {
  basePriceCents: number;
  baseSource: string;
  ageMonths: number;
  ageBasisPoints: number;
  targetCondition: AssetCondition;
  conditionBasisPoints: number;
  effectiveUsageValue: number;
  usageLossBasisPoints: number;
  usageFactorBasisPoints: number;
  netPriceCents: number;
  valuationReason: string;
};

export type UsedAssetValuationResult =
  | { ok: true; valuation: UsedAssetValuation }
  | {
      ok: false;
      reason: 'unknown_asset' | 'no_price_list' | 'invalid_date' | 'invalid_curve';
    };

/**
 * Linear interpolation in basis points (100% = 10_000 bp), rounded half-up once.
 * Beyond the last curve point, holds the final percentage as documented in data/residual-curves.json.
 */
export function interpolateAgeBasisPoints(
  points: readonly (readonly [number, number])[],
  ageMonths: number
): number {
  if (!Number.isInteger(ageMonths) || ageMonths < 0) {
    throw new RangeError('ageMonths must be a non-negative integer');
  }
  if (points.length === 0) {
    throw new RangeError('residual curve must have at least one point');
  }
  const first = points[0]!;
  for (let index = 1; index < points.length; index++) {
    if (points[index]![0] <= points[index - 1]![0]) {
      throw new RangeError('residual curve points must be strictly increasing by age');
    }
  }
  if (ageMonths <= first[0]) return decimalToScaled(first[1], 2);

  for (let index = 1; index < points.length; index++) {
    const prev = points[index - 1]!;
    const next = points[index]!;
    if (ageMonths <= next[0]) {
      const startBp = decimalToScaled(prev[1], 2);
      const endBp = decimalToScaled(next[1], 2);
      const span = next[0] - prev[0];
      const elapsed = ageMonths - prev[0];
      if (endBp >= startBp) {
        return startBp + multiplyRatio(endBp - startBp, elapsed, span);
      }
      return startBp - multiplyRatio(startBp - endBp, elapsed, span);
    }
  }
  return decimalToScaled(points.at(-1)![1], 2);
}

/**
 * Whole completed usage steps determine wear loss in basis points, capped at `max_total_percent`.
 * Example: 18,400 km with step 1,000 km and -2.0%/step = 18 steps = -36% -> capped at -20% (2,000 bp loss).
 */
export function usageLossBasisPoints(
  usageValue: number,
  rule: ResidualCurves['usage_adjustment'][Asset['category']]
): number {
  if (!Number.isSafeInteger(usageValue) || usageValue < 0) {
    throw new RangeError('usageValue must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(rule.step) || rule.step <= 0) {
    throw new RangeError('usage step must be a positive safe integer');
  }
  const lossPerStepBp = decimalToScaled(Math.abs(rule.percent_per_step), 2);
  const maxLossBp = decimalToScaled(Math.abs(rule.max_total_percent), 2);
  const steps = Math.floor(usageValue / rule.step);
  return Math.min(maxLossBp, steps * lossPerStepBp);
}

function resolveFirstLeaseBaseline(input: {
  asset: Asset;
  onDate: string;
  priceLists: readonly PriceList[];
  firstLeasePriceCents?: number;
  firstLeaseStartDate?: string;
}):
  | { ok: true; basePriceCents: number; baseSource: string; startDate: string }
  | { ok: false; reason: 'unknown_asset' | 'no_price_list' | 'invalid_date' } {
  const { asset, onDate, priceLists, firstLeasePriceCents, firstLeaseStartDate } = input;
  const fallbackStart = `${String(asset.model_year).padStart(4, '0')}-01-01`;
  const startDate = firstLeaseStartDate ?? fallbackStart;
  if (!isIsoDate(onDate) || !isIsoDate(startDate)) {
    return { ok: false, reason: 'invalid_date' };
  }
  if (firstLeasePriceCents !== undefined) {
    if (!Number.isSafeInteger(firstLeasePriceCents) || firstLeasePriceCents <= 0) {
      throw new RangeError('firstLeasePriceCents must be a positive safe integer');
    }
    return {
      ok: true,
      basePriceCents: firstLeasePriceCents,
      baseSource: 'first_contract',
      startDate,
    };
  }
  if (priceLists.length === 0) return { ok: false, reason: 'no_price_list' };
  const dated = listPriceOn(priceLists, asset.id, startDate);
  if (dated.ok) {
    return {
      ok: true,
      basePriceCents: dated.priceCents,
      baseSource: `list:${dated.priceListVersion}`,
      startDate,
    };
  }
  if (dated.reason === 'unknown_asset') return { ok: false, reason: 'unknown_asset' };

  const earliest = [...priceLists].sort((a, b) => a.valid_from.localeCompare(b.valid_from))[0]!;
  const priceCents = earliest.prices[asset.id];
  if (priceCents === undefined) return { ok: false, reason: 'unknown_asset' };
  return {
    ok: true,
    basePriceCents: priceCents,
    baseSource: `list:${earliest.version}`,
    startDate,
  };
}

function formatPercentBp(bp: number): string {
  const whole = Math.floor(bp / 100);
  const frac = bp % 100;
  return frac === 0 ? `${whole}%` : `${whole}.${String(frac).padStart(2, '0').replace(/0$/, '')}%`;
}

/**
 * Automatic used-item valuation from `data/residual-curves.json`:
 *   used_net_price = round_half_up(
 *     first_lease_net_list_price * curve(age_months) * condition_multiplier * usage_adjustment
 *   )
 * If a completed refurbishment task resets usage (e.g. battery replacement), effective usage for
 * pricing is 0 while the physical odometer on the asset remains untouched.
 */
export function calculateUsedAssetValuation(input: {
  asset: Asset;
  targetCondition: AssetCondition;
  onDate: string;
  residualCurves: ResidualCurves;
  priceLists: readonly PriceList[];
  firstLeasePriceCents?: number;
  firstLeaseStartDate?: string;
  resetsUsage?: boolean;
}): UsedAssetValuationResult {
  const baseline = resolveFirstLeaseBaseline(input);
  if (!baseline.ok) return baseline;

  const { asset, targetCondition, onDate, residualCurves } = input;
  const curve = residualCurves.curves[asset.category];
  const usageRule = residualCurves.usage_adjustment[asset.category];
  if (!curve || curve.length === 0 || !usageRule || usageRule.unit !== asset.usage.unit) {
    return { ok: false, reason: 'invalid_curve' };
  }

  const ageMonths = completedMonthsBetween(baseline.startDate, onDate);
  const ageBasisPoints = interpolateAgeBasisPoints(curve, ageMonths);
  const conditionBasisPoints = decimalToScaled(
    residualCurves.condition_multiplier[targetCondition],
    4
  );
  const effectiveUsageValue = input.resetsUsage ? 0 : asset.usage.value;
  const lossBp = usageLossBasisPoints(effectiveUsageValue, usageRule);
  const usageFactorBasisPoints = 10_000 - lossBp;

  const combinedNumerator = Number(
    BigInt(ageBasisPoints) * BigInt(conditionBasisPoints) * BigInt(usageFactorBasisPoints)
  );
  const rawNetPriceCents = multiplyRatio(
    baseline.basePriceCents,
    combinedNumerator,
    1_000_000_000_000
  );
  const netPriceCents = Math.max(1, rawNetPriceCents);

  const valuationReason =
    `Auto residual formula (${baseline.baseSource} ${baseline.basePriceCents}c, ` +
    `age ${ageMonths}m -> ${formatPercentBp(ageBasisPoints)}, ` +
    `${targetCondition} -> ${formatPercentBp(conditionBasisPoints)}, ` +
    `usage ${effectiveUsageValue} ${asset.usage.unit} -> ${formatPercentBp(usageFactorBasisPoints)}).`;

  return {
    ok: true,
    valuation: {
      basePriceCents: baseline.basePriceCents,
      baseSource: baseline.baseSource,
      ageMonths,
      ageBasisPoints,
      targetCondition,
      conditionBasisPoints,
      effectiveUsageValue,
      usageLossBasisPoints: lossBp,
      usageFactorBasisPoints,
      netPriceCents,
      valuationReason,
    },
  };
}
