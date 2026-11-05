import type { PriceExplanation as PriceExplanationModel } from '@/domain/price-explanation';
import { formatEuro } from '@/domain/money';
import { formatIsoDate, formatNumber } from '@/i18n/format';
import { getT, type MessageKey } from '@/i18n/get-t';
import { intlLocale, type Locale } from '@/i18n/locales';
import { PriceTaxTimeline } from './price-tax-timeline';

export function priceSourceLabel(source: string, locale: Locale): string {
  const [kind, version] = source.split(':');
  return getT(locale)(kind === 'release' ? 'spine.releasePrice' : 'asset.priceListVersion', {
    version: version ?? '',
  });
}

type Props = {
  explanation: PriceExplanationModel;
  locale: Locale;
  pricedOn: string;
  priceSource: string;
  upfrontDate: string;
};

export function PriceExplanation({
  explanation,
  locale,
  pricedOn,
  priceSource,
  upfrontDate,
}: Props) {
  const t = getT(locale);
  const money = (cents: number) => formatEuro(cents, intlLocale[locale]);
  const { terms, firstRent, upfront, buyout } = explanation;
  const factor = new Intl.NumberFormat(intlLocale[locale], {
    maximumFractionDigits: 6,
  }).format(terms.factorMillionths / 1_000_000);
  const priceRows: [MessageKey, number][] = [
    ['spine.list', terms.listPriceCents],
    ['spine.down', terms.downPaymentCents],
    ['spine.financed', terms.financedCents],
  ];
  const totalRows: [MessageKey, number][] = [
    ['spine.rentTotal', explanation.rentNetCents],
    ['spine.buyout', buyout.netCents],
    ['spine.useTotal', explanation.useNetCents],
    ['spine.ownTotal', explanation.ownNetCents],
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-ocean/25 bg-gradient-to-br from-ice via-mist to-emerald-50/70 p-5 text-navy shadow-ledger dark:border-cyan-800 dark:from-cyan-950/70 dark:via-stone-900 dark:to-emerald-950/50 dark:text-stone-100">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-ocean uppercase dark:text-cyan-300">
            {t('explain.title')}
          </h3>
          <span className="rounded bg-white/85 px-2 py-0.5 text-xs font-medium text-navy dark:bg-stone-900/80 dark:text-stone-200">
            {t('explain.fixedNet', { amount: money(terms.monthlyNetCents) })}
          </span>
        </div>
        <p className="mt-3 text-xs font-medium text-ink-muted dark:text-stone-300">
          {t('explain.firstPayment')}
        </p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-ocean tabular-nums dark:text-cyan-200">
          {money(firstRent.grossCents)}
        </p>
        <p className="mt-1 text-xs text-ink-muted dark:text-stone-300">
          {t('explain.onDate', { date: formatIsoDate(firstRent.invoiceDate, locale) })}
        </p>
      </div>

      <p className="text-sm font-medium text-navy dark:text-stone-200">
        {t('explain.rentTerm', {
          count: formatNumber(terms.termMonths, locale),
          date: formatIsoDate(explanation.endDate, locale),
        })}
      </p>
      <div className="rounded-lg border border-hairline bg-mist/50 p-4 dark:border-stone-800 dark:bg-stone-800/50">
        <p className="mb-3 text-xs font-medium text-ink-muted dark:text-stone-300">
          {t('explain.source', {
            source: priceSourceLabel(priceSource, locale),
            date: formatIsoDate(pricedOn, locale),
          })}
        </p>
        <dl className="divide-y divide-hairline text-sm dark:divide-stone-700">
          {priceRows.map(([key, cents]) => (
            <AmountRow key={key} label={t(key)} amount={money(cents)} />
          ))}
        </dl>
        <p className="mt-3 text-xs text-ink-muted dark:text-stone-300">
          {t('explain.financedHelp')}
        </p>
      </div>

      <div className="rounded-lg border border-hairline bg-card p-4 dark:border-stone-700 dark:bg-stone-900">
        <dl className="text-sm">
          <AmountRow label={t('explain.upfrontGross')} amount={money(upfront.grossCents)} />
        </dl>
        <p className="mt-1 text-xs text-ink-muted dark:text-stone-300">
          {t('explain.upfrontTiming', { date: formatIsoDate(upfrontDate, locale) })}
        </p>
        <p className="mt-1.5 text-xs text-ink-muted dark:text-stone-400">
          {t('explain.firstMonthHelp')}
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-hairline bg-mist p-4 dark:border-stone-800 dark:bg-stone-800">
        <div>
          <dl className="text-sm">
            <AmountRow
              label={t('spine.forecastUseGross')}
              amount={money(explanation.useGrossCents)}
            />
          </dl>
          <p className="mt-1 text-xs text-ink-muted dark:text-stone-300">
            {t('explain.useEquation', {
              upfront: money(upfront.grossCents),
              months: formatNumber(terms.termMonths, locale),
              rent: money(explanation.rentGrossCents),
            })}
          </p>
        </div>
        <div className="border-t border-hairline-strong pt-3 dark:border-stone-700">
          <dl className="text-sm">
            <AmountRow label={t('explain.buyoutGross')} amount={money(buyout.grossCents)} />
          </dl>
          <p className="mt-1 text-xs text-ink-muted dark:text-stone-300">
            {t('explain.buyoutTiming', { date: formatIsoDate(explanation.endDate, locale) })}
          </p>
        </div>
        <div className="border-t border-hairline-strong pt-3 dark:border-stone-700">
          <dl className="text-sm">
            <AmountRow
              label={t('spine.forecastOwnGross')}
              amount={money(explanation.ownGrossCents)}
            />
          </dl>
          <p className="mt-1 text-xs text-ink-muted dark:text-stone-300">
            {t('explain.ownEquation', {
              use: money(explanation.useGrossCents),
              buyout: money(buyout.grossCents),
            })}
          </p>
        </div>
      </div>

      <details className="rounded-lg border border-hairline bg-card p-4 dark:border-stone-700 dark:bg-stone-900">
        <summary className="cursor-pointer text-sm font-semibold text-navy dark:text-stone-100">
          {t('spine.factor')}
        </summary>
        <div className="mt-4 space-y-3 border-t border-hairline pt-3 text-sm dark:border-stone-800">
          <p>
            {t('explain.financedFormula', {
              price: money(terms.listPriceCents),
              upfront: money(terms.downPaymentCents),
              financed: money(terms.financedCents),
            })}
          </p>
          <p className="rounded bg-ice/70 px-3 py-2 font-semibold text-ocean tabular-nums dark:bg-cyan-950/60 dark:text-cyan-200">
            {t('explain.factorFormula', {
              financed: money(terms.financedCents),
              factor,
              monthly: money(terms.monthlyNetCents),
            })}
          </p>
          <p className="text-xs text-ink-muted dark:text-stone-300">
            {t('explain.factorHelp', {
              band: terms.band,
              version: formatNumber(terms.coefficientTableVersion, locale),
            })}
          </p>
          <p className="text-xs text-ink-muted dark:text-stone-300">{t('explain.rounding')}</p>
          <h4 className="pt-2 text-xs font-semibold tracking-wide text-ink-muted uppercase dark:text-stone-300">
            {t('explain.netTotals')}
          </h4>
          <dl className="divide-y divide-hairline dark:divide-stone-800">
            {totalRows.map(([key, cents]) => (
              <AmountRow key={key} label={t(key)} amount={money(cents)} />
            ))}
          </dl>
        </div>
      </details>

      <PriceTaxTimeline periods={explanation.rentalPeriods} locale={locale} />
      <p className="text-xs text-ink-muted dark:text-stone-400">
        {t('explain.assumptions', {
          upfront: formatIsoDate(upfrontDate, locale),
          end: formatIsoDate(explanation.endDate, locale),
        })}
      </p>
    </div>
  );
}

function AmountRow({ label, amount }: { label: string; amount: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-1.5">
      <dt className="min-w-0 flex-1 basis-44 text-ink-muted dark:text-stone-300">{label}</dt>
      <dd className="font-semibold text-navy tabular-nums dark:text-stone-100">{amount}</dd>
    </div>
  );
}
