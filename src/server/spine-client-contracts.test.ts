// Real migrated SQLite + actual endpoint services: client schemas must accept their replies.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createTestDb } from '../../tests/helpers/test-db';
import { demoContext, prepareApplication, resetSpine } from '../../tests/helpers/spine';
import { loadRefurbishmentCosts } from '@/data/load';
import { refurbishmentPlan } from '@/domain/lifecycle';
import { applicationConsentKey, endConsentKey } from '@/components/spine/consent-context';
import {
  applicationViewSchema,
  auditSchema,
  bootstrapSchema,
  contractListSchema,
  contractViewSchema,
  passportSchema,
  quoteViewSchema,
  relistViewSchema,
} from '@/data/spine-response-schemas';
import { toAsset } from './assets';
import { endLease } from './spine-end';
import { getPassport, getScopedAudit } from './spine-history';
import { issueInvoices } from './spine-invoices';
import { getBootstrap } from './spine-offers';
import type { PrismaClient } from './prisma-client';
import { relistAsset } from './spine-relist';
import { signContract } from './spine-signing';
import { listContracts } from './spine-views';

let db: PrismaClient;
let cleanup: () => Promise<void>;
beforeAll(async () => {
  ({ db, cleanup } = await createTestDb());
});
afterAll(async () => {
  await cleanup();
});

it('accepts actual response shapes throughout the loop and changes consent context when needed', async () => {
  await resetSpine(db);
  const context = await demoContext();
  const data = await getBootstrap(db, context, 'ebike-003');
  expect(bootstrapSchema.parse(data)).toEqual(data);
  const { quote, application } = await prepareApplication(db, context, { termMonths: 12 });
  expect(quoteViewSchema.parse(quote)).toEqual(quote);
  expect(applicationViewSchema.parse(application)).toEqual(application);

  const review = { locale: 'en' as const, data, quote, application, answers: application.answers };
  const accepted = applicationConsentKey(review);
  expect(
    applicationConsentKey({ ...review, data: { ...data, businessDate: '2026-11-06' } })
  ).not.toBe(accepted);
  expect(
    applicationConsentKey({ ...review, application: { ...application, id: randomUUID() } })
  ).not.toBe(accepted);
  expect(
    applicationConsentKey({
      ...review,
      answers: { ...application.answers, q_email: 'changed@example.com' },
    })
  ).not.toBe(accepted);

  let contract = await signContract(db, context, application.id);
  expect(contractViewSchema.parse(contract)).toEqual(contract);
  contract = await issueInvoices(db, context, contract.id);
  expect(contractViewSchema.parse(contract)).toEqual(contract);
  expect(contractListSchema.parse(await listContracts(db, context))).toHaveLength(1);
  expect(passportSchema.parse(await getPassport(db, contract.assetId)).lives).toHaveLength(1);
  expect(auditSchema.parse(await getScopedAudit(db, context)).length).toBeGreaterThan(0);

  const ending = {
    locale: 'en' as const,
    data,
    contract,
    choice: 'return' as const,
    condition: 'good' as const,
    usageText: '18400',
    successorId: '',
  };
  const endAccepted = endConsentKey(ending);
  for (const changed of [
    { ...ending, usageText: '' },
    { ...ending, usageText: '18401' },
    { ...ending, condition: 'fair' as const },
    { ...ending, successorId: 'cust-lena' },
    { ...ending, choice: 'buy' as const },
    { ...ending, data: { ...data, businessDate: contract.endDate } },
  ])
    expect(endConsentKey(changed)).not.toBe(endAccepted);

  const endContext = { ...context, businessDate: contract.endDate };
  await issueInvoices(db, endContext, contract.id);
  const closed = await endLease(db, endContext, contract.id, {
    requestId: randomUUID(),
    choice: 'return',
    condition: 'fair',
    usageValue: 18400,
  });
  expect(contractViewSchema.parse(closed)).toEqual(closed);
  const returned = await getBootstrap(db, endContext, contract.assetId);
  expect(bootstrapSchema.parse(returned)).toEqual(returned);
  const asset = toAsset(await db.asset.findUniqueOrThrow({ where: { id: contract.assetId } }));
  const plan = refurbishmentPlan({
    asset,
    targetCondition: 'good',
    costs: await loadRefurbishmentCosts(),
  });
  if (!plan.ok) throw new Error('Fixture must have a preparation plan');
  const relisted = await relistAsset(
    db,
    { ...endContext, operator: true, actor: `demo:operator:${context.customer.id}` },
    asset.id,
    {
      requestId: randomUUID(),
      releaseRevision: returned.releaseRevision,
      netPriceCents: 130000,
      valuationReason: 'Synthetic inspection valuation for schema regression.',
      condition: 'good',
      completedTaskIds: plan.tasks.map((task) => task.id),
    }
  );
  expect(relistViewSchema.parse(relisted)).toEqual(relisted);
});
