import { loadPriceLists, loadRefurbishmentCosts, loadResidualCurves } from '@/data/load';
import { maintenanceAfterWork, missingReadinessTasks, refurbishmentPlan } from '@/domain/lifecycle';
import { calculateUsedAssetValuation } from '@/domain/residual';
import type { AssetRelease } from '@/generated/prisma/client';
import { ApiError } from './api-response';
import { toAsset } from './assets';
import { withAudit } from './audit';
import type { DemoContext } from './demo-context';
import { requireOperator } from './demo-context';
import type { PrismaClient } from './prisma-client';
import { rethrowDatabaseConflict, requestHash, requireSameRequest } from './request-integrity';
import { priceTermsSchema, type RelistInput } from './spine-shapes';
import { readMaintenance } from './spine-maintenance';

function releaseView(release: AssetRelease) {
  return {
    assetId: release.asset_id,
    readyOn: release.ready_on,
    offer: {
      priceCents: release.net_price_cents,
      source: `release:${release.revision}`,
      releaseRevision: release.revision,
    },
  };
}

export async function relistAsset(
  db: PrismaClient,
  context: DemoContext,
  assetId: string,
  input: RelistInput
) {
  requireOperator(context);
  const fingerprint = requestHash({ actor: context.actor, assetId, input });
  const [row, previous, lastContract, firstContract, costs, residualCurves, priceLists] =
    await Promise.all([
      db.asset.findUnique({ where: { id: assetId } }),
      db.assetRelease.findUnique({ where: { asset_id: assetId } }),
      db.contract.findFirst({ where: { asset_id: assetId }, orderBy: { life_number: 'desc' } }),
      db.contract.findFirst({ where: { asset_id: assetId }, orderBy: { life_number: 'asc' } }),
      loadRefurbishmentCosts(),
      loadResidualCurves(),
      loadPriceLists(),
    ]);
  if (!row) throw new ApiError(404, 'ASSET_NOT_FOUND', 'The item was not found');
  if ((previous?.revision ?? 0) !== input.releaseRevision) {
    throw new ApiError(
      409,
      'RELIST_NOT_ALLOWED',
      'The item has entered another return cycle; refresh'
    );
  }
  if (previous?.relist_request_id === input.requestId) {
    requireSameRequest(previous.relist_request_hash, fingerprint);
    return releaseView(previous);
  }
  if (
    row.status !== 'returned' ||
    (lastContract?.closed_on && lastContract.closed_on > context.businessDate)
  ) {
    throw new ApiError(
      409,
      'RELIST_NOT_ALLOWED',
      'Only a returned item can be prepared for the next lease'
    );
  }
  const maintenance = readMaintenance(previous);
  const plan = refurbishmentPlan({
    asset: toAsset(row),
    targetCondition: input.condition,
    costs,
    lastServiceUsage: input.lastServiceUsage,
    maintenance,
  });
  if (!plan.ok)
    throw new ApiError(422, 'READINESS_UNAVAILABLE', 'The required work cannot be determined', {
      reason: plan.reason,
    });
  const missing = missingReadinessTasks(plan.tasks, input.completedTaskIds);
  if (missing.length > 0)
    throw new ApiError(422, 'READINESS_INCOMPLETE', 'Complete all required work before relisting', {
      taskIds: missing,
    });
  const firstLeasePriceCents = firstContract
    ? priceTermsSchema.parse(JSON.parse(firstContract.terms_json)).listPriceCents
    : undefined;
  const autoValuation = calculateUsedAssetValuation({
    asset: toAsset(row),
    targetCondition: input.condition,
    onDate: context.businessDate,
    residualCurves,
    priceLists,
    firstLeasePriceCents,
    firstLeaseStartDate: firstContract?.start_date,
    resetsUsage: plan.tasks.some((task) => task.resetsUsage),
  });
  if (!autoValuation.ok) {
    throw new ApiError(
      422,
      'READINESS_UNAVAILABLE',
      'The used-item valuation cannot be determined',
      {
        reason: autoValuation.reason,
      }
    );
  }
  const netPriceCents = input.netPriceCents ?? autoValuation.valuation.netPriceCents;
  const valuationReason = input.valuationReason ?? autoValuation.valuation.valuationReason;

  try {
    const release = await withAudit(
      db,
      {
        actor: context.actor,
        action: 'asset.relisted',
        entityType: 'asset',
        entityId: assetId,
        details: {
          businessDate: context.businessDate,
          revision: input.releaseRevision,
          taskIds: plan.tasks.map((task) => task.id),
        },
      },
      async (tx) => {
        const latest = await tx.assetRelease.findUnique({ where: { asset_id: assetId } });
        if ((latest?.revision ?? 0) !== input.releaseRevision)
          throw new ApiError(409, 'RELIST_NOT_ALLOWED', 'The return cycle changed');
        const updated = await tx.asset.updateMany({
          where: { id: assetId, status: 'returned' },
          data: { condition: input.condition, status: 'available' },
        });
        if (updated.count !== 1)
          throw new ApiError(409, 'RELIST_NOT_ALLOWED', 'The item is no longer awaiting relisting');
        const values = {
          net_price_cents: netPriceCents,
          ready_on: context.businessDate,
          readiness_json: JSON.stringify({
            tasks: plan.tasks,
            totalNetCents: plan.totalNetCents,
            usageBefore: row.usage_value,
            maintenance: maintenanceAfterWork({
              previous: maintenance,
              tasks: plan.tasks,
              usageValue: row.usage_value,
              lastServiceUsage: input.lastServiceUsage,
            }),
          }),
          valuation_reason: valuationReason,
          relist_request_id: input.requestId,
          relist_request_hash: fingerprint,
        };
        // Record service/reset evidence, while preserving the physical item's cumulative meter.
        return tx.assetRelease.upsert({
          where: { asset_id: assetId },
          create: { asset_id: assetId, revision: 0, ...values },
          update: values,
        });
      }
    );
    return releaseView(release);
  } catch (error) {
    const committed = await db.assetRelease.findUnique({ where: { asset_id: assetId } });
    if (committed?.relist_request_id === input.requestId) {
      requireSameRequest(committed.relist_request_hash, fingerprint);
      return releaseView(committed);
    }
    rethrowDatabaseConflict(error);
  }
}
