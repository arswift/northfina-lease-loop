import { ApiError } from './api-response';
import { toAsset } from './assets';
import type { DemoContext } from './demo-context';
import type { PrismaClient } from './prisma-client';

/** Rows fetched per audit page; one extra row detects the next page without a count query. */
export const AUDIT_PAGE_SIZE = 10;
const LIMIT = AUDIT_PAGE_SIZE;

/** Public item history deliberately excludes identities, agreement IDs, answers and prices. */
export async function getPassport(db: PrismaClient, assetId: string) {
  const [row, lives] = await Promise.all([
    db.asset.findUnique({ where: { id: assetId } }),
    db.contract.findMany({
      where: { asset_id: assetId },
      orderBy: { life_number: 'asc' },
      select: {
        life_number: true,
        start_date: true,
        end_date: true,
        closed_on: true,
        status: true,
      },
    }),
  ]);
  if (!row) throw new ApiError(404, 'ASSET_NOT_FOUND', 'The item was not found');
  const completedKnownLives = lives.filter((life) => life.status !== 'active').length;
  return {
    asset: toAsset(row),
    lives,
    earlierLivesWithoutRecords: Math.max(0, row.previous_lives - completedKnownLives),
  };
}

/** The demo operator can inspect the trail; a customer sees actions for their selected persona. */
export async function getScopedAudit(db: PrismaClient, context: DemoContext, pageParam?: string) {
  const withId = typeof pageParam === 'string' && pageParam.trim().length > 0;
  const parsedId = withId ? Number.parseInt(pageParam.trim(), 10) : NaN;
  if (withId && (!Number.isSafeInteger(parsedId) || parsedId < 0)) {
    throw new ApiError(422, 'AUDIT_CURSOR_INVALID', 'Use a valid audit cursor');
  }
  const rows = await db.auditLog.findMany({
    where: withId
      ? {
          id: { lt: parsedId },
          ...(context.operator ? {} : { actor: { endsWith: `:${context.customer.id}` } }),
        }
      : context.operator
        ? {}
        : { actor: { endsWith: `:${context.customer.id}` } },
    orderBy: [{ id: 'desc' }],
    take: LIMIT + 1,
  });
  const hasMore = rows.length > LIMIT;
  const page = (hasMore ? rows.slice(0, LIMIT) : rows).map((row) => ({
    id: row.id,
    at: row.created_at.toISOString(),
    actor: row.actor,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
  }));
  return { rows: page, cursor: hasMore ? String(page.at(-1)!.id) : null };
}
