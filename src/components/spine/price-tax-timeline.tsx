import type { RentalVatPeriod } from '@/domain/price-explanation';
import { formatEuro } from '@/domain/money';
import { formatIsoDate, formatNumber } from '@/i18n/format';
import { getT } from '@/i18n/get-t';
import { intlLocale, type Locale } from '@/i18n/locales';

export function PriceTaxTimeline({
  periods,
  locale,
}: {
  periods: readonly RentalVatPeriod[];
  locale: Locale;
}) {
  const t = getT(locale);
  return (
    <div className="space-y-3">
      <h4 className="font-semibold">{t('explain.timelineTitle')}</h4>
      <p className="text-sm text-stone-600 dark:text-stone-300">{t('spine.taxHelp')}</p>
      <ul className="space-y-3">
        {periods.map((period) => (
          <li
            key={period.firstDate}
            className="rounded-xl border border-stone-200 p-3 dark:border-stone-700"
          >
            <p className="text-sm">
              {t('explain.vatPeriod', {
                count: formatNumber(period.count, locale),
                first: formatIsoDate(period.firstDate, locale),
                last: formatIsoDate(period.lastDate, locale),
              })}
            </p>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm">
                {t('explain.vatRate', { rate: formatNumber(period.vatBasisPoints / 100, locale) })}
              </span>
              <span className="font-semibold tabular-nums">
                {t('explain.monthlyAmount', {
                  amount: formatEuro(period.grossCents, intlLocale[locale]),
                })}
              </span>
            </div>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
              {t('explain.vatAmount', { amount: formatEuro(period.vatCents, intlLocale[locale]) })}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
