import { GrossTotals } from './gross-totals';
import type { getBootstrap } from '@/server/spine-offers';
import { calculatePrice } from '@/domain/pricing';
import { parseCents } from '@/domain/money-arithmetic';
import { taxOn } from '@/domain/vat';
import { formatEuro } from '@/domain/money';
import { getT } from '@/i18n/get-t';
import { intlLocale, type Locale } from '@/i18n/locales';
import { buttonClass, Field, inputClass, MoneyFacts, panelClass } from './ui';

export type Bootstrap = Awaited<ReturnType<typeof getBootstrap>>;
export type TermDraft = { termMonths: number; downText: string; startDate: string };

type Props = {
  data: Bootstrap;
  locale: Locale;
  draft: TermDraft;
  busy: boolean;
  onChange: (draft: TermDraft) => void;
  onSave: (input: { termMonths: number; downPaymentCents: number; startDate: string }) => void;
};

export function PricePanel({ data, locale, draft, busy, onChange, onSave }: Props) {
  const t = getT(locale);
  if (!data.offer || data.asset.status !== 'available') {
    return <p className={panelClass}>{t('spine.unavailable')}</p>;
  }
  const terms = Object.keys(data.coefficientTable.end_of_term_buyout_percent_of_financed)
    .map(Number)
    .sort((a, b) => a - b);
  const down = parseCents(draft.downText);
  const price = down.ok
    ? calculatePrice({
        listPriceCents: data.offer.priceCents,
        downPaymentCents: down.cents,
        termMonths: draft.termMonths,
        table: data.coefficientTable,
      })
    : null;
  const tax = price?.ok
    ? taxOn(price.terms.monthlyNetCents, draft.startDate || data.businessDate, data.vatRates)
    : null;
  const maxDown = Math.max(
    0,
    data.offer.priceCents - (data.coefficientTable.bands[0]?.min_financed_cents ?? 0)
  );

  return (
    <section className={panelClass} aria-labelledby="terms-heading">
      <h2 id="terms-heading" className="mb-5 text-xl font-semibold">
        {t('spine.terms')}
      </h2>
      <div className="grid gap-8 md:grid-cols-2">
        <fieldset disabled={busy} className="space-y-5">
          <Field id="term" label={t('spine.term')}>
            <input
              id="term"
              type="range"
              className="mt-3 w-full accent-emerald-700"
              min={0}
              max={terms.length - 1}
              step={1}
              value={Math.max(0, terms.indexOf(draft.termMonths))}
              aria-valuetext={t('spine.months', { count: draft.termMonths })}
              onChange={(event) =>
                onChange({ ...draft, termMonths: terms[Number(event.target.value)] ?? 12 })
              }
            />
            <output htmlFor="term">{t('spine.months', { count: draft.termMonths })}</output>
          </Field>
          <Field id="down" label={t('spine.down')}>
            <input
              id="down"
              className={inputClass}
              inputMode="decimal"
              value={draft.downText}
              aria-describedby="down-help"
              onChange={(event) => onChange({ ...draft, downText: event.target.value })}
            />
            <input
              aria-label={t('spine.down')}
              type="range"
              className="mt-3 w-full accent-emerald-700"
              min={0}
              max={maxDown}
              step={1}
              value={down.ok ? Math.min(maxDown, down.cents) : 0}
              aria-valuetext={down.ok ? formatEuro(down.cents, intlLocale[locale]) : draft.downText}
              onChange={(event) =>
                onChange({ ...draft, downText: String(Number(event.target.value) / 100) })
              }
            />
            <p id="down-help" className="mt-2 text-sm">
              {t('spine.downHelp')}
            </p>
          </Field>
          <Field id="start" label={t('spine.start')}>
            <input
              id="start"
              type="date"
              className={inputClass}
              value={draft.startDate || data.businessDate}
              min={data.businessDate}
              onChange={(event) => onChange({ ...draft, startDate: event.target.value })}
            />
          </Field>
          <p className="text-sm">{t('spine.bandHelp')}</p>
          <button
            className={buttonClass}
            disabled={!price?.ok || !down.ok || !tax?.ok}
            onClick={() => {
              if (down.ok && price?.ok)
                onSave({
                  termMonths: draft.termMonths,
                  downPaymentCents: down.cents,
                  startDate: draft.startDate || data.businessDate,
                });
            }}
          >
            {busy ? t('spine.pending') : t('spine.saveQuote')}
          </button>
        </fieldset>
        <div aria-live="polite" aria-atomic="true">
          {price?.ok ? (
            <>
              <MoneyFacts terms={price.terms} locale={locale} />
              <GrossTotals
                terms={price.terms}
                startDate={draft.startDate || data.businessDate}
                upfrontDate={data.businessDate}
                vatRates={data.vatRates}
                locale={locale}
              />
              {tax?.ok ? (
                <p className="mt-4 font-semibold">
                  {t('spine.monthlyGross', { date: draft.startDate || data.businessDate })}:{' '}
                  {formatEuro(tax.amount.grossCents, intlLocale[locale])}
                </p>
              ) : null}
              <details className="mt-4">
                <summary>{t('spine.factor')}</summary>
                <p className="mt-2">
                  {t('spine.factorDetail', {
                    factor: String(price.terms.factorMillionths / 1000000),
                    band: price.terms.band,
                  })}
                </p>
              </details>
              <p className="mt-4 text-sm">{t('spine.taxHelp')}</p>
              <p className="mt-4 text-sm">{t('spine.endHelp')}</p>
            </>
          ) : (
            <p role="status">{t('spine.invalidTerms')}</p>
          )}
        </div>
      </div>
    </section>
  );
}
