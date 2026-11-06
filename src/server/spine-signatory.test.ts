import { randomUUID } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { ApplicationPanel } from '@/components/spine/application-panel';
import { ApplicationStatus } from '@/components/spine/application-status';
import { draftSchema, emptyDraft } from '@/components/spine/draft';
import { decodeDraft } from '@/components/spine/draft-store';
import { answersFromCustomer } from '@/domain/question-flow';
import { getT } from '@/i18n/get-t';
import { locales } from '@/i18n/locales';
import { createTestDb } from '../../tests/helpers/test-db';
import { demoContext, resetSpine } from '../../tests/helpers/spine';
import type { PrismaClient } from './prisma-client';
import { submitApplication } from './spine-applications';
import { getBootstrap } from './spine-offers';
import { createQuote } from './spine-quotes';
import { signContract } from './spine-signing';

// Keep the actual HTTP handlers and migrated database; replace only the process singleton.
const state = vi.hoisted(() => ({ db: null as unknown as PrismaClient }));
vi.mock('@/server/db', () => ({
  get db() {
    return state.db;
  },
}));

import { GET as getApplication } from '@/app/api/spine/applications/[id]/route';
import { POST as postSignature } from '@/app/api/spine/contracts/sign/route';

let cleanup: () => Promise<void>;
beforeAll(async () => {
  const fixture = await createTestDb();
  state.db = fixture.db;
  cleanup = fixture.cleanup;
});
afterAll(async () => {
  await cleanup();
});
beforeEach(async () => {
  await resetSpine(state.db);
});

function request(path: string, body?: unknown, customerId = 'cust-norvi') {
  return new Request(`http://localhost/api/spine/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost',
      'x-demo-customer': customerId,
      'x-demo-date': '2026-11-06',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function norviOffer() {
  const context = await demoContext('cust-norvi', '2026-11-06');
  const quote = await createQuote(state.db, context, {
    requestId: randomUUID(),
    assetId: 'ebike-004',
    termMonths: 36,
    // A premature signature would issue an upfront invoice as well as allocating the item.
    downPaymentCents: 50000,
    startDate: context.businessDate,
  });
  return {
    context,
    quote,
    input: {
      requestId: randomUUID(),
      quoteId: quote.id,
      answers: {
        ...answersFromCustomer(context.customer),
        q_usage_purpose: 'delivery',
        q_signatory_email: 'director@example.com',
      },
    },
  };
}

it('persists the named signatory handoff without signing, invoicing or allocating the item', async () => {
  const { context, input, quote } = await norviOffer();
  const application = await submitApplication(state.db, context, input);
  expect(application).toMatchObject({
    decision: 'manual_review',
    reasons: ['signatory_required'],
    missingQuestionIds: [],
    invalidQuestionIds: [],
    answers: { q_can_sign: 'no', q_signatory_email: 'director@example.com' },
  });
  expect(await submitApplication(state.db, context, input)).toEqual(application);
  // On reload useDraft decodes this snapshot; Journey then re-reads the saved application ID.
  const restored = decodeDraft(
    '0:' + JSON.stringify({ ...emptyDraft, quote, application, answers: input.answers }),
    emptyDraft,
    draftSchema
  );
  const applicationId = restored.application?.id ?? '';
  expect(applicationId).toBe(application.id);
  expect(restored.contractId).toBeNull();
  const params = { params: Promise.resolve({ id: applicationId }) };
  const reloaded = await getApplication(request('applications/' + applicationId), params);
  expect(reloaded.status).toBe(200);
  expect((await reloaded.json()).data).toEqual(application);
  const privateRead = await getApplication(
    request('applications/' + application.id, undefined, 'cust-aino'),
    params
  );
  expect(privateRead.status).toBe(404);

  const signing = await postSignature(
    request('contracts/sign', { applicationId: application.id }),
    undefined
  );
  expect(signing.status).toBe(409);
  expect((await signing.json()).error.code).toBe('APPLICATION_NOT_APPROVED');
  await expect(
    signContract(state.db, { ...context, operator: true }, application.id)
  ).rejects.toMatchObject({ code: 'APPLICATION_NOT_APPROVED' });
  expect(await state.db.application.count()).toBe(1);
  expect(await state.db.contract.count()).toBe(0);
  expect(await state.db.invoice.count()).toBe(0);
  expect(await state.db.assetLease.count()).toBe(0);
  expect((await state.db.asset.findUniqueOrThrow({ where: { id: 'ebike-004' } })).status).toBe(
    'available'
  );
  expect(await state.db.auditLog.count({ where: { action: 'application.submitted' } })).toBe(1);
  expect(await state.db.auditLog.count({ where: { action: 'contract.signed' } })).toBe(0);
  expect(JSON.stringify(await state.db.auditLog.findMany())).not.toContain('director@example.com');
});

it('requires a valid signatory email and cannot grant authority by changing the applicant answer', async () => {
  const { context, input } = await norviOffer();
  const { q_signatory_email: _email, ...answers } = input.answers;
  const missing = await submitApplication(state.db, context, { ...input, answers });
  expect(missing.decision).toBe('incomplete');
  expect(missing.missingQuestionIds).toContain('q_signatory_email');
  const invalid = await submitApplication(state.db, context, {
    ...input,
    requestId: randomUUID(),
    answers: { ...answers, q_signatory_email: 'invalid-address' },
  });
  expect(invalid.decision).toBe('incomplete');
  expect(invalid.invalidQuestionIds).toContain('q_signatory_email');
  const claimedAuthority = await submitApplication(state.db, context, {
    ...input,
    requestId: randomUUID(),
    answers: { ...input.answers, q_can_sign: 'yes' },
  });
  expect(claimedAuthority.decision).toBe('manual_review');
  expect(claimedAuthority.reasons).toEqual(['signatory_required', 'profile_conflict']);
  expect(claimedAuthority.answers).not.toHaveProperty('q_signatory_email');

  for (const application of [missing, invalid, claimedAuthority]) {
    await expect(signContract(state.db, context, application.id)).rejects.toMatchObject({
      code: 'APPLICATION_NOT_APPROVED',
    });
    const status = renderToStaticMarkup(
      createElement(ApplicationStatus, { application, locale: 'en' })
    );
    expect(status).not.toContain('Waiting for the company’s signer');
  }
  expect(await state.db.contract.count()).toBe(0);
  expect(await state.db.invoice.count()).toBe(0);
  expect(await state.db.assetLease.count()).toBe(0);
});

it('shows the saved recipient and next step in four locales without hiding other review reasons', async () => {
  const { context, input, quote } = await norviOffer();
  const application = await submitApplication(state.db, context, input);
  const data = await getBootstrap(state.db, context, 'ebike-004');
  for (const locale of locales) {
    const t = getT(locale);
    const markup = renderToStaticMarkup(
      createElement(ApplicationPanel, {
        data,
        quote,
        application,
        answers: { ...input.answers, q_signatory_email: 'unsaved@example.com' },
        locale,
        busy: false,
        onAnswers: () => undefined,
        onSubmit: () => undefined,
        onSign: () => undefined,
      })
    );
    expect(markup).toContain(t('spine.signatory.waiting'));
    expect(markup).toContain(t('spine.signatory.recipient', { email: 'director@example.com' }));
    expect(markup).not.toContain(t('spine.signatory.recipient', { email: 'unsaved@example.com' }));
    expect(markup).toContain(t('spine.signatory.state'));
    expect(markup).toContain(t('spine.signatory.next'));
    expect(markup).toContain(t('spine.signatory.demoLimit'));
    expect(markup).not.toContain(t('spine.sign'));
    const needsReview = renderToStaticMarkup(
      createElement(ApplicationStatus, {
        application: { ...application, reasons: [...application.reasons, 'pep'] },
        locale,
      })
    );
    expect(needsReview).toContain(t('spine.manual_review'));
    expect(needsReview.replaceAll('&#x27;', "'")).toContain(t('spine.reason.pep'));
    expect(needsReview).toContain(
      t('spine.signatory.recipient', { email: 'director@example.com' })
    );
  }
});
