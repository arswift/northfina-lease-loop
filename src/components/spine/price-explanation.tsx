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
      <div className="rounded-xl bg-emerald-50 p-4 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100">
        <h3 className="font-semibold">{t('explain.title')}</h3>
        <p className="mt-3 text-sm">{t('explain.firstPayment')}</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
          {money(firstRent.grossCents)}
        </p>
        <p className="mt-1 text-sm">
          {t('explain.onDate', { date: formatIsoDate(firstRent.invoiceDate, locale) })}
        </p>
        <p className="mt-3 text-sm">
          {t('explain.fixedNet', { amount: money(terms.monthlyNetCents) })}
        </p>
      </div>

      <p className="text-sm">
        {t('explain.rentTerm', {
          count: formatNumber(terms.termMonths, locale),
          date: formatIsoDate(explanation.endDate, locale),
        })}
      </p>
      <div>
        <p className="mb-3 text-sm text-stone-600 dark:text-stone-300">
          {t('explain.source', {
            source: priceSourceLabel(priceSource, locale),
            date: formatIsoDate(pricedOn, locale),
          })}
        </p>
        <dl className="space-y-3">
          {priceRows.map(([key, cents]) => (
            <AmountRow key={key} label={t(key)} amount={money(cents)} />
          ))}
        </dl>
        <p className="mt-3 text-sm text-stone-600 dark:text-stone-300">
          {t('explain.financedHelp')}
        </p>
      </div>

      <div className="rounded-xl border border-stone-200 p-4 dark:border-stone-700">
        <dl>
          <AmountRow label={t('explain.upfrontGross')} amount={money(upfront.grossCents)} />
        </dl>
        <p className="mt-2 text-sm">
          {t('explain.upfrontTiming', { date: formatIsoDate(upfrontDate, locale) })}
        </p>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
          {t('explain.firstMonthHelp')}
        </p>
      </div>

      <div className="space-y-4 rounded-xl bg-stone-100 p-4 dark:bg-stone-800">
        <div>
          <dl>
            <AmountRow
              label={t('spine.forecastUseGross')}
              amount={money(explanation.useGrossCents)}
            />
          </dl>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
            {t('explain.useEquation', {
              upfront: money(upfront.grossCents),
              months: formatNumber(terms.termMonths, locale),
              rent: money(explanation.rentGrossCents),
            })}
          </p>
        </div>
        <div className="border-t border-stone-300 pt-4 dark:border-stone-600">
          <dl>
            <AmountRow label={t('explain.buyoutGross')} amount={money(buyout.grossCents)} />
          </dl>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
            {t('explain.buyoutTiming', { date: formatIsoDate(explanation.endDate, locale) })}
          </p>
        </div>
        <div className="border-t border-stone-300 pt-4 dark:border-stone-600">
          <dl>
            <AmountRow
              label={t('spine.forecastOwnGross')}
              amount={money(explanation.ownGrossCents)}
            />
          </dl>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
            {t('explain.ownEquation', {
              use: money(explanation.useGrossCents),
              buyout: money(buyout.grossCents),
            })}
          </p>
        </div>
      </div>

      <details className="rounded-xl border border-stone-200 p-4 dark:border-stone-700">
        <summary className="cursor-pointer font-medium">{t('spine.factor')}</summary>
        <div className="mt-4 space-y-3 text-sm">
          <p>
            {t('explain.financedFormula', {
              price: money(terms.listPriceCents),
              upfront: money(terms.downPaymentCents),
              financed: money(terms.financedCents),
            })}
          </p>
          <p className="font-semibold tabular-nums">
            {t('explain.factorFormula', {
              financed: money(terms.financedCents),
              factor,
              monthly: money(terms.monthlyNetCents),
            })}
          </p>
          <p>
            {t('explain.factorHelp', {
              band: terms.band,
              version: formatNumber(terms.coefficientTableVersion, locale),
            })}
          </p>
          <p>{t('explain.rounding')}</p>
          <h4 className="pt-2 font-semibold">{t('explain.netTotals')}</h4>
          <dl className="space-y-3">
            {totalRows.map(([key, cents]) => (
              <AmountRow key={key} label={t(key)} amount={money(cents)} />
            ))}
          </dl>
        </div>
      </details>

      <PriceTaxTimeline periods={explanation.rentalPeriods} locale={locale} />
      <p className="text-sm text-stone-600 dark:text-stone-300">
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
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
      <dt className="min-w-0 flex-1 basis-44">{label}</dt>
      <dd className="font-semibold tabular-nums">{amount}</dd>
    </div>
  );
}
