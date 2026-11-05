import { z } from 'zod';
import {
  loadCoefficientTable,
  loadRefurbishmentCosts,
  loadResidualCurves,
  loadSecondLifeDemand,
} from '@/data/load';
import { matchingSelectionSchema, type MatchingPreviewInput } from '@/data/second-life-schemas';
import { matchSecondLife } from '@/domain/second-life-matching';
import { ApiError } from './api-response';
import { toAsset } from './assets';
import type { TransactionClient } from './audit';
import { requireOperator, type DemoContext } from './demo-context';
import type { PrismaClient } from './prisma-client';
import { readMaintenance } from './spine-maintenance';

const auditDetails = z.object({ matching: matchingSelectionSchema.optional() });

/** Read-only projection; the relist transaction calls this again before allocating. */
export async function previewSecondLife(
  db: PrismaClient | TransactionClient,
  context: DemoContext,
  assetId: string,
  input: MatchingPreviewInput
) {
  requireOperator(context);
  if (input.readyOn < context.businessDate)
    throw new ApiError(422, 'MATCH_CHANGED', 'Refresh the readiness date');
  const [row, release, audits, table, costs, rules, requests] = await Promise.all([
    db.asset.findUnique({ where: { id: assetId } }),
    db.assetRelease.findUnique({ where: { asset_id: assetId } }),
    db.auditLog.findMany({ where: { action: 'asset.relisted' }, select: { details_json: true } }),
    loadCoefficientTable(),
    loadRefurbishmentCosts(),
    loadResidualCurves(),
    loadSecondLifeDemand(),
  ]);
  if (!row) throw new ApiError(404, 'ASSET_NOT_FOUND', 'The item was not found');
  const allocatedRequestIds = audits.flatMap((row) => {
    const parsed = auditDetails.safeParse(row.details_json ? JSON.parse(row.details_json) : {});
    return parsed.success && parsed.data.matching ? [parsed.data.matching.waitingRequestId] : [];
  });
  return {
    releaseRevision: release?.revision ?? 0,
    ...matchSecondLife({
      ...input,
      asset: toAsset(row),
      table,
      costs,
      rules,
      requests,
      maintenance: readMaintenance(release),
      onDate: context.businessDate,
      allocatedRequestIds,
    }),
  };
}
