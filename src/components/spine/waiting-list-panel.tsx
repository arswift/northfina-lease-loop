import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { AssetCategory, AssetCondition } from '@/data/schemas';
import {
  joinWaitingInputSchema,
  ownWaitingListSchema,
  waitingActionSchema,
  type OwnWaitingRequests,
} from '@/data/waiting-list-schemas';
import { parseCents } from '@/domain/money-arithmetic';
import { formatEuro } from '@/domain/money';
import { getT } from '@/i18n/get-t';
import { intlLocale, type Locale } from '@/i18n/locales';
import { requestJson, RequestFailure } from './api';
import type { Bootstrap } from './price-panel';
import { buttonClass, Field, inputClass, messageFor, panelClass } from './ui';

export function WaitingListPanel({
  data,
  locale,
  busy,
  onChanged,
}: {
  data: Bootstrap;
  locale: Locale;
  busy: boolean;
  onChanged: () => void;
}) {
  const t = getT(locale);
  const [category, setCategory] = useState<AssetCategory>(data.asset.category);
  const [condition, setCondition] = useState<AssetCondition>('good');
  const [budget, setBudget] = useState('');
  const [term, setTerm] = useState(12);
  const [neededBy, setNeededBy] = useState(data.businessDate);
  const [records, setRecords] = useState<OwnWaitingRequests | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retry = useRef<{ key: string; id: string } | null>(null);
  const selection = { customerId: data.customer.id, businessDate: data.businessDate };
  useEffect(() => {
    const controller = new AbortController();
    requestJson(
      'waiting-list',
      { customerId: data.customer.id, businessDate: data.businessDate },
      ownWaitingListSchema,
      undefined,
      false,
      controller.signal
    )
      .then((rows) => {
        if (!controller.signal.aborted) setRecords(rows);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('REQUEST_FAILED');
      });
    return () => controller.abort();
  }, [data.customer.id, data.businessDate]);
  const money = parseCents(budget);
  const preferences = {
    category,
    minCondition: condition,
    monthlyBudgetCents: money.ok ? money.cents : null,
    termMonths: term,
    neededBy,
  };
  const valid =
    joinWaitingInputSchema.omit({ requestId: true }).safeParse(preferences).success &&
    neededBy >= data.businessDate;
  const alreadyPending = records?.some(
    (row) => row.category === category && row.status === 'pending'
  );
  async function change(id?: string) {
    if (pending || busy) return;
    const key = JSON.stringify(preferences);
    if (!id && (!valid || alreadyPending)) return;
    if (!id && retry.current?.key !== key) retry.current = { key, id: crypto.randomUUID() };
    setPending(true);
    setError(null);
    try {
      if (id)
        await requestJson(
          'waiting-list/' + encodeURIComponent(id) + '/cancel',
          selection,
          waitingActionSchema,
          {}
        );
      else
        await requestJson('waiting-list', selection, waitingActionSchema, {
          ...preferences,
          requestId: retry.current!.id,
        });
      retry.current = null;
      setRecords(await requestJson('waiting-list', selection, ownWaitingListSchema));
      onChanged();
    } catch (cause) {
      setError(cause instanceof RequestFailure ? cause.code : 'REQUEST_FAILED');
    } finally {
      setPending(false);
    }
  }
  return (
    <section className={panelClass} aria-labelledby="waiting-title">
      <h2 id="waiting-title" className="text-xl font-semibold">
        {t('wait.title')}
      </h2>
      <p className="mt-2 font-medium">{t('wait.for', { name: data.customer.name })}</p>
      <p className="mt-2 text-sm">{t('wait.help')}</p>
      <fieldset
        disabled={busy || pending || records === null}
        className="mt-4 grid gap-4 sm:grid-cols-2"
      >
        <Field id="waiting-category" label={t('wait.category')}>
          <select
            id="waiting-category"
            className={inputClass}
            value={category}
            onChange={(event) => setCategory(event.target.value as AssetCategory)}
          >
            {(['e_bike', 'laptop', 'farm_machine'] as const).map((value) => (
              <option key={value} value={value}>
                {messageFor(locale, 'category.' + value)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="waiting-condition" label={t('wait.condition')}>
          <select
            id="waiting-condition"
            className={inputClass}
            value={condition}
            onChange={(event) => setCondition(event.target.value as AssetCondition)}
          >
            {(['fair', 'good', 'like_new', 'new'] as const).map((value) => (
              <option key={value} value={value}>
                {messageFor(locale, 'condition.' + value)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="waiting-budget" label={t('wait.budget')}>
          <input
            id="waiting-budget"
            className={inputClass}
            inputMode="decimal"
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
          />
        </Field>
        <Field id="waiting-term" label={t('spine.term')}>
          <select
            id="waiting-term"
            className={inputClass}
            value={term}
            onChange={(event) => setTerm(Number(event.target.value))}
          >
            {Object.keys(data.coefficientTable.end_of_term_buyout_percent_of_financed)
              .map(Number)
              .sort((a, b) => a - b)
              .map((value) => (
                <option key={value} value={value}>
                  {t('spine.months', { count: value })}
                </option>
              ))}
          </select>
        </Field>
        <Field id="waiting-deadline" label={t('match.deadline')}>
          <input
            id="waiting-deadline"
            className={inputClass}
            type="date"
            min={data.businessDate}
            value={neededBy}
            onChange={(event) => setNeededBy(event.target.value)}
          />
        </Field>
        <div className="self-end">
          <button
            type="button"
            className={buttonClass}
            disabled={!valid || alreadyPending}
            onClick={() => void change()}
          >
            {pending ? t('spine.pending') : t('wait.join')}
          </button>
        </div>
      </fieldset>
      {alreadyPending ? <p className="mt-3 text-sm">{t('wait.alreadyPending')}</p> : null}
      {error ? (
        <p className="mt-3" role="alert">
          {messageFor(locale, 'spine.error.' + error)}
        </p>
      ) : null}
      <div className="mt-4" aria-live="polite">
        <h3 className="font-semibold">{t('wait.yours')}</h3>
        {records === null ? (
          <p>{t('spine.loading')}</p>
        ) : records.length === 0 ? (
          <p>{t('wait.empty')}</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {records.map((row) => (
              <li key={row.id} className="rounded-lg border border-stone-300 p-3">
                <p>
                  {messageFor(locale, 'category.' + row.category)} ·{' '}
                  {messageFor(locale, 'condition.' + row.min_condition)} ·{' '}
                  {t('spine.months', { count: row.preferred_term_months })}
                </p>
                <p>
                  {t('wait.summary', {
                    budget: formatEuro(row.max_monthly_net_rent_cents, intlLocale[locale]),
                    date: row.needed_by,
                  })}
                </p>
                <p className="font-medium">{messageFor(locale, 'wait.' + row.status)}</p>
                {row.status === 'pending' ? (
                  <button
                    type="button"
                    className="mt-2 underline"
                    disabled={busy || pending}
                    onClick={() => void change(row.id)}
                  >
                    {t('wait.cancel')}
                  </button>
                ) : null}
                {row.allocated_asset_id ? (
                  <Link
                    className="mt-2 block underline"
                    href={'/' + locale + '/lease/' + encodeURIComponent(row.allocated_asset_id)}
                  >
                    {t('wait.openItem')}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
