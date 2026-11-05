'use client';

import { bootstrapSchema, quoteViewSchema } from '@/data/spine-response-schemas';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { getT } from '@/i18n/get-t';
import type { Locale } from '@/i18n/locales';
import type { QuoteView } from '@/server/spine-views';
import { requestJson, RequestFailure, type DemoSelection } from './api';
import { draftSchema, emptyDraft, selectionSchema } from './draft';
import { GrossTotals } from './gross-totals';
import { PricePanel, type Bootstrap } from './price-panel';
import { useDraft } from './use-draft';
import { buttonClass, Field, inputClass, messageFor, MoneyFacts, panelClass } from './ui';

const emptySelection: DemoSelection = { customerId: '', businessDate: '' };
type Loaded = { signature: string; data: Bootstrap; quote: QuoteView | null };
type QuoteInput = { termMonths: number; downPaymentCents: number; startDate: string };

export function Journey({ assetId, locale }: { assetId: string; locale: Locale }) {
  const t = getT(locale);
  const [selection, setSelection, selectionVolatile] = useDraft(
    'lease-loop-demo',
    emptySelection,
    selectionSchema
  );
  const draftKey = 'lease-loop:' + assetId + ':' + (selection.customerId || 'default');
  const [draft, saveDraft, draftVolatile] = useDraft(draftKey, emptyDraft, draftSchema);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const activeRequest = useRef(false);
  const { customerId, businessDate } = selection;
  const signature = assetId + '|' + customerId + '|' + businessDate;
  const quoteId = draft.quote?.id;

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
      quoteId
        ? requestJson(
            'quotes/' + quoteId,
            context,
            quoteViewSchema,
            undefined,
            false,
            controller.signal
          )
        : Promise.resolve(null),
    ])
      .then(([data, quote]) => {
        if (!controller.signal.aborted)
          setLoaded({ signature: assetId + '|' + customerId + '|' + businessDate, data, quote });
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(cause instanceof RequestFailure ? cause.code : 'REQUEST_FAILED');
      });
    return () => controller.abort();
  }, [assetId, customerId, businessDate, quoteId, revision]);

  const data = loaded?.signature === signature ? loaded.data : null;
  const quote =
    data &&
    loaded?.quote &&
    loaded.quote.id === quoteId &&
    loaded.quote.assetId === assetId &&
    loaded.quote.customerId === data.customer.id
      ? loaded.quote
      : null;

  function editTerms() {
    saveDraft({ ...draft, quote: null, application: null, retries: {} });
    setError(null);
  }

  function reload() {
    setError(null);
    setRevision((value) => value + 1);
  }
  async function saveQuote(input: QuoteInput) {
    if (activeRequest.current) return;
    activeRequest.current = true;
    setBusy(true);
    setError(null);
    try {
      const payload = { assetId, ...input };
      const fingerprint = JSON.stringify(payload);
      const previous = draft.retries.quote;
      const id = previous?.fingerprint === fingerprint ? previous.id : crypto.randomUUID();
      const next = { ...draft, retries: { ...draft.retries, quote: { fingerprint, id } } };
      saveDraft(next);
      const saved = await requestJson('quotes', selection, quoteViewSchema, {
        requestId: id,
        ...payload,
      });
      saveDraft({ ...next, quote: saved, application: null, contractId: null });
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof RequestFailure ? cause.code : 'REQUEST_FAILED');
    } finally {
      activeRequest.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <Link href={'/' + locale} className="underline">
        {t('spine.back')}
      </Link>
      <h1 className="text-3xl font-semibold">
        {data ? data.asset.make + ' ' + data.asset.model : t('spine.title')}
      </h1>
      <aside className={panelClass}>
        <p>{t('spine.demo')}</p>
        <fieldset disabled={busy} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field id="demo-customer" label={t('spine.customer')}>
            <select
              id="demo-customer"
              className={inputClass}
              value={customerId || data?.customer.id || ''}
              onChange={(event) => setSelection({ ...selection, customerId: event.target.value })}
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
              onChange={(event) => setSelection({ ...selection, businessDate: event.target.value })}
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
          <button className={buttonClass} disabled={busy} onClick={reload}>
            {t('spine.retry')}
          </button>
        </div>
      ) : null}
      {!data || (quoteId && !quote) ? <p role="status">{t('spine.loading')}</p> : null}
      {data && quote ? (
        <section className={panelClass}>
          <p>{t('spine.quoteSaved', { date: quote.validThrough })}</p>
          <MoneyFacts terms={quote.terms} locale={locale} />
          <p>{t('spine.savedOffer', { date: quote.pricedOn, source: quote.priceSource })}</p>
          <GrossTotals
            terms={quote.terms}
            startDate={quote.startDate}
            upfrontDate={data.businessDate}
            vatRates={data.vatRates}
            locale={locale}
          />
        </section>
      ) : null}
      {quoteId ? (
        <button className={buttonClass} disabled={busy} onClick={editTerms}>
          {t('spine.editTerms')}
        </button>
      ) : null}
      {data && !quoteId ? (
        <PricePanel
          data={data}
          locale={locale}
          draft={draft.terms}
          busy={busy}
          onChange={(terms) => saveDraft({ ...draft, terms, application: null })}
          onSave={(input) => void saveQuote(input)}
        />
      ) : null}
    </div>
  );
}
