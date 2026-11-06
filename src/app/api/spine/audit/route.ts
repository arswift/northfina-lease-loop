import { z } from 'zod';
import { handleRoute, ok } from '@/server/api-response';
import { db } from '@/server/db';
import { readDemoContext } from '@/server/demo-context';
import { getScopedAudit } from '@/server/spine-history';

const cursorSchema = z.string().regex(/^\d+$/);

export const GET = handleRoute(async (request) => {
  const raw = new URL(request.url).searchParams.get('cursor');
  // No cursor means the first (newest) page; a supplied cursor must be a numeric id.
  const cursor = raw === null || raw === '' ? undefined : cursorSchema.parse(raw);
  return ok(await getScopedAudit(db, await readDemoContext(request), cursor));
});
