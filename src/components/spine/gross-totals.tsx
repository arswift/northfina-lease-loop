import type { VatRates } from '@/data/schemas';
import type { PriceTerms } from '@/domain/pricing';
import { leaseTotals, type IssuedAmount } from '@/domain/totals';
import { isIsoDate } from '@/domain/calendar';
import { canScheduleLease } from '@/domain/invoicing';
import { formatEuro } from '@/domain/money';
import { getT, type MessageKey } from '@/i18n/get-t';
import { intlLocale, type Locale } from '@/i18n/locales';

export function GrossTotals({
  terms,
  startDate,
  upfrontDate,
  vatRates,
  issued,
  locale,
}: {
  terms: PriceTerms;
  startDate: string;
  upfrontDate: string;
  vatRates: VatRates;
  issued?: readonly IssuedAmount[];
  locale: Locale;
}) {
  const t = getT(locale);
  if (!isIsoDate(upfrontDate) || !canScheduleLease(startDate, terms.termMonths))
    return (
      <p className="mt-4" role="status">
        {t('spine.invalidTerms')}
      </p>
    );
  const totals = leaseTotals({ terms, startDate, upfrontDate, vatRates, issued });
  if (!totals.ok)
    return (
      <p className="mt-4" role="status">
        {t('spine.error')}
      </p>
    );
  const rows: [MessageKey, number][] = [
    ['spine.forecastRentGross', totals.rentGrossCents],
    ['spine.forecastUseGross', totals.useGrossCents],
    ['spine.forecastOwnGross', totals.ownGrossCents],
  ];
  if (issued) rows.push(['spine.issuedTotal', totals.issuedGrossCents]);
  return (
    <div className="mt-5 space-y-3 rounded-lg border border-ocean/25 bg-ice/60 p-4 text-navy dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-stone-100">
      <dl className="divide-y divide-ocean/15 text-sm dark:divide-cyan-800/50">
        {rows.map(([key, cents]) => (
          <div key={key} className="flex flex-wrap justify-between gap-2 py-1.5">
            <dt className="text-ink-muted dark:text-cyan-200">{t(key)}</dt>
            <dd className="font-semibold text-ocean tabular-nums dark:text-cyan-100">
              {formatEuro(cents, intlLocale[locale])}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-ink-muted dark:text-cyan-300">{t('spine.forecastTotalHelp')}</p>
    </div>
  );
}
