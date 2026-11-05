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
      <p className="text-sm text-ink-muted dark:text-stone-300">{t('spine.taxHelp')}</p>
      <ul className="space-y-2.5">
        {periods.map((period) => (
          <li
            key={period.firstDate}
            className="rounded-lg border border-hairline border-l-4 border-l-ocean bg-mist/40 p-3.5 dark:border-stone-700 dark:border-l-cyan-500 dark:bg-stone-800/40"
          >
            <p className="text-xs font-medium text-ink-muted dark:text-stone-300">
              {t('explain.vatPeriod', {
                count: formatNumber(period.count, locale),
                first: formatIsoDate(period.firstDate, locale),
                last: formatIsoDate(period.lastDate, locale),
              })}
            </p>
            <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-2">
              <span className="inline-flex rounded bg-ice px-2 py-0.5 text-xs font-semibold text-ocean dark:bg-cyan-950 dark:text-cyan-300">
                {t('explain.vatRate', { rate: formatNumber(period.vatBasisPoints / 100, locale) })}
              </span>
              <span className="font-semibold text-navy tabular-nums dark:text-stone-100">
                {t('explain.monthlyAmount', {
                  amount: formatEuro(period.grossCents, intlLocale[locale]),
                })}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-muted dark:text-stone-400">
              {t('explain.vatAmount', { amount: formatEuro(period.vatCents, intlLocale[locale]) })}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
