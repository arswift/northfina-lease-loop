'use client';

import {
  applicationViewSchema,
  bootstrapSchema,
  contractListSchema,
  contractViewSchema,
  quoteViewSchema,
  relistViewSchema,
} from '@/data/spine-response-schemas';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { answersFromCustomer } from '@/domain/question-flow';
import { answersForSubmission } from './form-values';
import { getT } from '@/i18n/get-t';
import { formatIsoDate } from '@/i18n/format';
import type { Locale } from '@/i18n/locales';
import type { ApplicationView, ContractView, QuoteView, listContracts } from '@/server/spine-views';
import { requestJson, RequestFailure, type DemoSelection } from './api';
import { useDraft } from './use-draft';
import { draftSchema, emptyDraft, selectionSchema } from './draft';
import { AssetArt } from '@/components/asset-art';
import { ApplicationPanel } from './application-panel';
import { ContractPanel } from './contract-panel';
import { SavedPriceExplanation } from './saved-price-explanation';
import { EndPanel, type EndForm } from './end-panel';
import { PricePanel, type Bootstrap } from './price-panel';
import { RelistPanel, type RelistForm } from './relist-panel';
import { HistoryPanel } from './history-panel';
import { buttonClass, Field, inputClass, messageFor, panelClass } from './ui';

const emptySelection: DemoSelection = { customerId: '', businessDate: '' };
type ContractList = Awaited<ReturnType<typeof listContracts>>;

export function Journey({ assetId, locale }: { assetId: string; locale: Locale }) {
  const t = getT(locale);
  const [selection, setSelection, selectionVolatile] = useDraft(
    'lease-loop-demo',
    emptySelection,
    selectionSchema
  );
  const draftKey = 'lease-loop:' + assetId + ':' + (selection.customerId || 'default');
  const [draft, saveDraft, draftVolatile] = useDraft(draftKey, emptyDraft, draftSchema);
  const [loaded, setLoaded] = useState<{
    signature: string;
    data: Bootstrap;
    contracts: ContractList;
  } | null>(null);
  const [contractState, setContract] = useState<{ signature: string; data: ContractView } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const activeRequest = useRef(false);
  const { customerId, businessDate } = selection;
  const signature = assetId + '|' + customerId + '|' + businessDate;
  const contractId = draft.contractId;
  const quoteId = draft.quote?.id;
  const applicationId = draft.application?.id;
  const [review, setReview] = useState<{
    signature: string;
    quote: QuoteView;
    application: ApplicationView | null;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const context = { customerId, businessDate };
    Promise.all([
      requestJson(
        'bootstrap?assetId=' + encodeURIComponent(assetId),
        context,
        bootstrapSchema,
        undefined,
        false,
        controller.signal
      ),
      requestJson('contracts', context, contractListSchema, undefined, false, controller.signal),
    ])
      .then(([data, contracts]) => {
        if (controller.signal.aborted) return;
        setLoaded({ signature: assetId + '|' + customerId + '|' + businessDate, data, contracts });
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(cause instanceof RequestFailure ? cause.code : 'REQUEST_FAILED');
      });
    return () => controller.abort();
  }, [assetId, customerId, businessDate, revision]);

  useEffect(() => {
    if (!contractId) return;
    const controller = new AbortController();
    requestJson(
      'contracts/' + encodeURIComponent(contractId),
      { customerId, businessDate },
      contractViewSchema,
      undefined,
      false,
      controller.signal
    )
      .then((data) => {
        if (!controller.signal.aborted)
          setContract({ signature: assetId + '|' + customerId + '|' + businessDate, data });
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(cause instanceof RequestFailure ? cause.code : 'REQUEST_FAILED');
      });
    return () => controller.abort();
  }, [assetId, contractId, customerId, businessDate, revision]);

  useEffect(() => {
    if (!quoteId || contractId) return;
    const controller = new AbortController();
    const context = { customerId, businessDate };
    Promise.all([
      requestJson(
        'quotes/' + quoteId,
        context,
        quoteViewSchema,
        undefined,
        false,
        controller.signal
      ),
      applicationId
        ? requestJson(
            'applications/' + applicationId,
            context,
            applicationViewSchema,
            undefined,
            false,
            controller.signal
          )
        : Promise.resolve(null),
    ])
      .then(([quote, application]) => {
        if (!controller.signal.aborted)
          setReview({
            signature: assetId + '|' + customerId + '|' + businessDate,
            quote,
            application,
          });
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(cause instanceof RequestFailure ? cause.code : 'REQUEST_FAILED');
      });
    return () => controller.abort();
  }, [assetId, quoteId, applicationId, contractId, customerId, businessDate, revision]);

  const data = loaded?.signature === signature ? loaded.data : null;
  const contract =
    contractState?.signature === signature &&
    contractState.data.id === contractId &&
    contractState.data.assetId === assetId
      ? contractState.data
      : null;

  const quote =
    review?.signature === signature &&
    review.quote.id === quoteId &&
    review.quote.assetId === assetId &&
    review.quote.customerId === data?.customer.id
      ? review.quote
      : null;
  const application =
    review?.signature === signature &&
    review.application?.id === applicationId &&
    review.application?.quoteId === quote?.id
      ? review.application
      : null;

  async function run(work: () => Promise<void>) {
    if (activeRequest.current) return;
    activeRequest.current = true;
    setBusy(true);
    setError(null);
    try {
      await work();
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof RequestFailure ? cause.code : 'REQUEST_FAILED');
    } finally {
      activeRequest.current = false;
      setBusy(false);
    }
  }

  function requestId(action: string, payload: unknown) {
    const fingerprint = JSON.stringify(payload);
    const previous = draft.retries[action];
    const id = previous?.fingerprint === fingerprint ? previous.id : crypto.randomUUID();
    const next = { ...draft, retries: { ...draft.retries, [action]: { fingerprint, id } } };
    saveDraft(next);
    return { id, next };
  }

  function saveQuote(input: { termMonths: number; downPaymentCents: number; startDate: string }) {
    void run(async () => {
      const payload = { assetId, ...input };
      const request = requestId('quote', payload);
      const quote = await requestJson('quotes', selection, quoteViewSchema, {
        requestId: request.id,
        ...payload,
      });
      saveDraft({ ...request.next, quote, application: null, contractId: null });
    });
  }

  function apply() {
    if (!quote || !data) return;
    void run(async () => {
      const payload = {
        quoteId: quote.id,
        answers: answersForSubmission(
          data.questions,
          draft.answers ?? answersFromCustomer(data.customer)
        ),
      };
      const request = requestId('application', payload);
      const application = await requestJson('applications', selection, applicationViewSchema, {
        requestId: request.id,
        ...payload,
      });
      // Keep raw editing values, including invalid input; the saved decision stays canonical.
      saveDraft({ ...request.next, application });
    });
  }

  function sign() {
    if (!application || application.decision !== 'approved') return;
    const approvedApplicationId = application.id;
    void run(async () => {
      const result = await requestJson('contracts/sign', selection, contractViewSchema, {
        applicationId: approvedApplicationId,
      });
      saveDraft({ ...draft, contractId: result.id });
      setContract({ signature, data: result });
    });
  }

  function issue() {
    if (!contract) return;
    void run(async () => {
      const result = await requestJson(
        'contracts/' + contract.id + '/invoices',
        selection,
        contractViewSchema,
        {}
      );
      setContract({ signature, data: result });
    });
  }

  function end(input: EndForm) {
    if (!contract) return;
    void run(async () => {
      const request = requestId('end', { contractId: contract.id, ...input });
      const result = await requestJson(
        'contracts/' + contract.id + '/end',
        selection,
        contractViewSchema,
        { requestId: request.id, ...input }
      );
      setContract({ signature, data: result });
    });
  }

  function relist(input: RelistForm) {
    void run(async () => {
      const request = requestId('relist', { assetId, ...input });
      await requestJson(
        'assets/' + assetId + '/relist',
        selection,
        relistViewSchema,
        { requestId: request.id, ...input },
        true
      );
    });
  }

  const onDate = (date: string) => {
    setSelection({ ...selection, businessDate: date });
    setError(null);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      <Link href={'/' + locale} className="asset-back-link">
        {t('spine.back')}
      </Link>
      <div className="asset-hero">
        <div className="asset-hero-content">
          <p className="asset-hero-eyebrow">
            {data ? t(`category.${data.asset.category}`) : t('spine.title')}
          </p>
          <h1 className="asset-hero-title">
            {data ? data.asset.make + ' ' + data.asset.model : t('spine.title')}
          </h1>
          {data ? (
            <p className="asset-hero-detail">
              {t('asset.previousLives')}: {data.asset.previous_lives}
              <span aria-hidden="true"> · </span>
              {t('condition.label')}: {t(`condition.${data.asset.condition}`)}
            </p>
          ) : null}
        </div>
        {data ? (
          <div className="asset-hero-art">
            <AssetArt category={data.asset.category} />
          </div>
        ) : null}
      </div>
      <aside className={panelClass + ' demo-panel'}>
        <p className="font-medium">{t('spine.demo')}</p>
        <fieldset disabled={busy} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field id="demo-customer" label={t('spine.customer')}>
            <select
              id="demo-customer"
              className={inputClass}
              value={customerId || data?.customer.id || ''}
              onChange={(event) => {
                setSelection({ ...selection, customerId: event.target.value });
                setError(null);
              }}
            >
              {loaded?.data.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="demo-date" label={t('spine.date')}>
            <input
              id="demo-date"
              type="date"
              className={inputClass}
              value={businessDate || data?.businessDate || ''}
              onChange={(event) => onDate(event.target.value)}
            />
          </Field>
        </fieldset>
        <p className="mt-3 text-sm">{t('spine.dateHelp')}</p>
      </aside>
      {selectionVolatile || draftVolatile ? (
        <p className={panelClass} role="status">
          {t('spine.storageWarning')}
        </p>
      ) : null}
      {error ? (
        <div className={panelClass} role="alert">
          <p>{messageFor(locale, 'spine.error.' + error)}</p>
          <button
            className={buttonClass + ' mt-3'}
            onClick={() => {
              setError(null);
              setRevision((value) => value + 1);
            }}
          >
            {t('spine.retry')}
          </button>
        </div>
      ) : null}
      {!data ? (
        <p role="status">{t('spine.loading')}</p>
      ) : (
        <>
          {loaded?.contracts.filter((item) => item.asset_id === assetId).length ? (
            <section className={panelClass}>
              <h2 className="font-semibold">{t('spine.savedContracts')}</h2>
              <ul className="mt-3 space-y-2">
                {loaded.contracts
                  .filter((item) => item.asset_id === assetId)
                  .map((item) => (
                    <li key={item.id}>
                      <button
                        className="break-all text-left underline"
                        disabled={busy}
                        onClick={() => {
                          saveDraft({ ...draft, contractId: item.id });
                          setError(null);
                        }}
                      >
                        {t('spine.openContract')} · {item.start_date} ·{' '}
                        {messageFor(locale, 'spine.' + item.status)}
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}
          {contractId && !contract ? <p role="status">{t('spine.loading')}</p> : null}
          {contract ? (
            <>
              <ContractPanel
                contract={contract}
                vatRates={data.vatRates}
                locale={locale}
                busy={busy}
                onIssue={issue}
                onDate={onDate}
              />
              <EndPanel
                key={contract.id}
                contract={contract}
                data={data}
                locale={locale}
                busy={busy}
                onDate={onDate}
                onEnd={end}
              />
              {contract.status !== 'active' && data.asset.status === 'available' ? (
                <button
                  className={buttonClass}
                  disabled={busy}
                  onClick={() => {
                    saveDraft(emptyDraft);
                    if (contract.nextCustomerId)
                      setSelection({ ...selection, customerId: contract.nextCustomerId });
                  }}
                >
                  {t('spine.nextLease')}
                </button>
              ) : null}
            </>
          ) : null}
          {!contractId && draft.quote && !quote ? <p role="status">{t('spine.loading')}</p> : null}
          {!contractId && quote ? (
            <>
              <section className={panelClass}>
                <p>{t('spine.quoteSaved', { date: formatIsoDate(quote.validThrough, locale) })}</p>
                <SavedPriceExplanation quote={quote} data={data} locale={locale} />
                <button
                  className={buttonClass + ' mt-4'}
                  disabled={busy}
                  onClick={() => {
                    saveDraft({ ...draft, quote: null, application: null, retries: {} });
                  }}
                >
                  {t('spine.editTerms')}
                </button>
              </section>
              <ApplicationPanel
                data={data}
                quote={quote}
                application={application}
                answers={draft.answers ?? answersFromCustomer(data.customer)}
                locale={locale}
                busy={busy}
                onSubmit={apply}
                onSign={sign}
                onAnswers={(answers) => {
                  saveDraft({ ...draft, answers, application: null });
                }}
              />
            </>
          ) : null}
          {!contractId && !draft.quote ? (
            <PricePanel
              data={data}
              locale={locale}
              draft={draft.terms}
              busy={busy}
              onSave={saveQuote}
              onChange={(terms) => {
                saveDraft({ ...draft, terms, application: null });
              }}
            />
          ) : null}
          {data.asset.status === 'returned' ? (
            <RelistPanel
              key={data.releaseRevision}
              data={data}
              locale={locale}
              busy={busy}
              onRelist={relist}
            />
          ) : null}
          <HistoryPanel
            assetId={assetId}
            selection={selection}
            locale={locale}
            revision={revision}
          />
        </>
      )}
    </div>
  );
}
