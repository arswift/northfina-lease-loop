import { useId } from 'react';
import { z } from 'zod';
import { comparePriceOptions } from '@/domain/price-comparison';
import type { PriceExplanation } from '@/domain/price-explanation';
import { isIsoDate } from '@/domain/calendar';
import { formatEuro } from '@/domain/money';
import { parseCents } from '@/domain/money-arithmetic';
import { formatIsoDate, formatNumber } from '@/i18n/format';
import { getT, type MessageKey } from '@/i18n/get-t';
import { intlLocale, type Locale } from '@/i18n/locales';
import type { Bootstrap, TermDraft } from './price-panel';
import { priceFailureMessage } from './price-feedback';
import { priceSourceLabel } from './price-explanation';
import { useDraft } from './use-draft';
import { buttonClass, Field, inputClass } from './ui';

const comparisonSchema = z.tuple([z.number().int().positive(), z.number().int().positive()]);

type Props = {
  data: Bootstrap;
  locale: Locale;
  draft: TermDraft;
  busy: boolean;
  onChoose: (termMonths: number) => void;
};

export function PriceComparison({ data, locale, draft, busy, onChoose }: Props) {
  const t = getT(locale);
  const id = useId();
  const money = (cents: number) => formatEuro(cents, intlLocale[locale]);
  const availableTerms = Object.keys(data.coefficientTable.end_of_term_buyout_percent_of_financed)
    .map(Number)
    .sort((a, b) => a - b);
  const initialLeft = availableTerms.includes(24) ? 24 : (availableTerms[0] ?? 24);
  const initialRight = availableTerms.includes(36)
    ? 36
    : (availableTerms.find((term) => term !== initialLeft) ?? initialLeft);
  const defaults: [number, number] = [initialLeft, initialRight];
  const [preferences, savePreferences, volatile] = useDraft(
    'lease-loop-compare:' + data.asset.id + ':' + data.customer.id,
    defaults,
    comparisonSchema
  );
  const left = availableTerms.includes(preferences[0]) ? preferences[0] : initialLeft;
  const right =
    availableTerms.includes(preferences[1]) && preferences[1] !== left
      ? preferences[1]
      : (availableTerms.find((term) => term !== left) ?? left);
  const chosenTerms: [number, number] = [left, right];
  const down = parseCents(draft.downText);
  const startDate = draft.startDate || data.businessDate;
  const options =
    data.offer && down.ok && isIsoDate(data.businessDate)
      ? comparePriceOptions({
          listPriceCents: data.offer.priceCents,
          downPaymentCents: down.cents,
          termMonths: chosenTerms,
          table: data.coefficientTable,
          startDate,
          upfrontDate: data.businessDate,
          vatRates: data.vatRates,
        })
      : null;
  const rows: { label: MessageKey; value: (model: PriceExplanation) => string }[] = [
    {
      label: 'explain.monthlyCount',
      value: (model) => formatNumber(model.terms.termMonths, locale),
    },
    { label: 'spine.monthlyNet', value: (model) => money(model.terms.monthlyNetCents) },
    { label: 'explain.firstPayment', value: (model) => money(model.firstRent.grossCents) },
    { label: 'explain.upfrontGross', value: (model) => money(model.upfront.grossCents) },
    { label: 'spine.forecastRentGross', value: (model) => money(model.rentGrossCents) },
    { label: 'spine.forecastUseGross', value: (model) => money(model.useGrossCents) },
    { label: 'explain.buyoutGross', value: (model) => money(model.buyout.grossCents) },
    { label: 'spine.forecastOwnGross', value: (model) => money(model.ownGrossCents) },
  ];

  return (
    <section className="mt-8 space-y-4 border-t border-hairline pt-8 dark:border-stone-700">
      <h3 id={id + '-heading'} className="text-xl font-semibold">
        {t('explain.compareTitle')}
      </h3>
      <p className="text-sm text-ink-muted dark:text-stone-300">{t('explain.compareHelp')}</p>
      {data.offer && isIsoDate(data.businessDate) ? (
        <div className="rounded-xl bg-sage p-4 text-sm dark:bg-stone-800">
          <p>
            {t('explain.source', {
              source: priceSourceLabel(data.offer.source, locale),
              date: formatIsoDate(data.businessDate, locale),
            })}
          </p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-ink-muted dark:text-stone-300">{t('spine.list')}</dt>
              <dd className="font-medium tabular-nums">{money(data.offer.priceCents)}</dd>
            </div>
            {down.ok ? (
              <div>
                <dt className="text-ink-muted dark:text-stone-300">{t('spine.down')}</dt>
                <dd className="font-medium tabular-nums">{money(down.cents)}</dd>
              </div>
            ) : null}
            {isIsoDate(startDate) ? (
              <div>
                <dt className="text-ink-muted dark:text-stone-300">{t('spine.start')}</dt>
                <dd className="font-medium">{formatIsoDate(startDate, locale)}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">{t('explain.compareTitle')}</legend>
        {chosenTerms.map((term, index) => (
          <Field
            key={index}
            id={id + '-term-' + index}
            label={t('explain.compareOption', { number: formatNumber(index + 1, locale) })}
          >
            <select
              id={id + '-term-' + index}
              className={inputClass}
              value={term}
              onChange={(event) => {
                const next: [number, number] = [...chosenTerms];
                next[index] = Number(event.target.value);
                savePreferences(next);
              }}
            >
              {availableTerms.map((candidate) => (
                <option
                  key={candidate}
                  value={candidate}
                  disabled={candidate === chosenTerms[1 - index] && availableTerms.length > 1}
                >
                  {t('spine.months', { count: formatNumber(candidate, locale) })}
                </option>
              ))}
            </select>
          </Field>
        ))}
      </fieldset>
      {volatile ? <p role="status">{t('spine.storageWarning')}</p> : null}
      {options ? (
        <div
          className="overflow-x-auto rounded-xl border border-hairline dark:border-stone-700"
          role="region"
          aria-labelledby={id + '-heading'}
          tabIndex={0}
        >
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline dark:border-stone-700">
                <th scope="col" className="w-2/5 p-3 font-medium">
                  {t('spine.term')}
                </th>
                {options.map((option, index) => (
                  <th key={index} scope="col" className="p-3 text-right font-semibold">
                    {t('spine.months', { count: formatNumber(option.termMonths, locale) })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={row.label} className="border-b border-hairline dark:border-stone-700">
                  <th scope="row" className="p-3 font-normal">
                    {t(row.label)}
                  </th>
                  {options.map((option, index) =>
                    option.ok ? (
                      <td key={index} className="p-3 text-right font-medium tabular-nums">
                        {row.value(option.explanation)}
                      </td>
                    ) : rowIndex === 0 ? (
                      <td key={index} rowSpan={rows.length} className="p-3 align-top">
                        <p role="status">{priceFailureMessage(option.reason, data, locale)}</p>
                      </td>
                    ) : null
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="p-3 font-medium">
                  {t('explain.selection')}
                </th>
                {options.map((option, index) => (
                  <td key={index} className="p-3 text-right align-top">
                    <button
                      type="button"
                      className={buttonClass}
                      disabled={busy || !option.ok || option.termMonths === draft.termMonths}
                      aria-pressed={option.termMonths === draft.termMonths}
                      onClick={() => onChoose(option.termMonths)}
                    >
                      {option.termMonths === draft.termMonths
                        ? t('explain.selectedTerm')
                        : t('explain.useTerm', {
                            months: formatNumber(option.termMonths, locale),
                          })}
                    </button>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p role="status">
          {!data.offer
            ? t('spine.unavailable')
            : !isIsoDate(data.businessDate)
              ? t('explain.invalidBusinessDate')
              : priceFailureMessage('invalid_money', data, locale)}
        </p>
      )}
      {options && isIsoDate(startDate) ? (
        <p className="text-sm text-ink-muted dark:text-stone-300">
          {t('explain.comparisonTiming', { date: formatIsoDate(startDate, locale) })}
        </p>
      ) : null}
      <p className="text-sm">{t('explain.comparisonHelp')}</p>
    </section>
  );
}
