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
    <div className="price-summary space-y-6">
      <div>
        <h3 className="mb-4 text-xl font-semibold">{t('explain.title')}</h3>
        <div className="price-headline">
          <p className="font-medium">{t('explain.firstPayment')}</p>
          <p className="price-number">{money(firstRent.grossCents)}</p>
          <p className="ui-note">
            {t('explain.onDate', { date: formatIsoDate(firstRent.invoiceDate, locale) })}
          </p>
          <p className="mt-3">{t('explain.fixedNet', { amount: money(terms.monthlyNetCents) })}</p>
        </div>
        <p className="ui-note mt-3">
          {t('explain.rentTerm', {
            count: formatNumber(terms.termMonths, locale),
            date: formatIsoDate(explanation.endDate, locale),
          })}
        </p>
      </div>

      <div>
        <dl>
          <AmountRow label={t('explain.upfrontGross')} amount={money(upfront.grossCents)} />
        </dl>
        <p className="ui-note">
          {t('explain.upfrontTiming', { date: formatIsoDate(upfrontDate, locale) })}
        </p>
        <p className="ui-note mt-2">{t('explain.firstMonthHelp')}</p>
      </div>

      <div>
        <div className="price-total">
          <dl>
            <AmountRow
              label={t('spine.forecastUseGross')}
              amount={money(explanation.useGrossCents)}
            />
          </dl>
          <p className="ui-note">
            {t('explain.useEquation', {
              upfront: money(upfront.grossCents),
              months: formatNumber(terms.termMonths, locale),
              rent: money(explanation.rentGrossCents),
            })}
          </p>
        </div>
        <div className="price-total">
          <dl>
            <AmountRow label={t('explain.buyoutGross')} amount={money(buyout.grossCents)} />
          </dl>
          <p className="ui-note">
            {t('explain.buyoutTiming', { date: formatIsoDate(explanation.endDate, locale) })}
          </p>
          <dl className="mt-3">
            <AmountRow
              label={t('spine.forecastOwnGross')}
              amount={money(explanation.ownGrossCents)}
            />
          </dl>
          <p className="ui-note">
            {t('explain.ownEquation', {
              use: money(explanation.useGrossCents),
              buyout: money(buyout.grossCents),
            })}
          </p>
        </div>
      </div>

      <PriceTaxTimeline periods={explanation.rentalPeriods} locale={locale} />

      <div>
        <p className="ui-note mb-2">
          {t('explain.source', {
            source: priceSourceLabel(priceSource, locale),
            date: formatIsoDate(pricedOn, locale),
          })}
        </p>
        <dl className="divide-y divide-stone-200 dark:divide-stone-700">
          {priceRows.map(([key, cents]) => (
            <AmountRow key={key} label={t(key)} amount={money(cents)} />
          ))}
        </dl>
        <p className="ui-note mt-2">{t('explain.financedHelp')}</p>
      </div>

      <details className="ui-disclosure">
        <summary>{t('spine.factor')}</summary>
        <div className="space-y-3">
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
          <p className="ui-note">
            {t('explain.factorHelp', {
              band: terms.band,
              version: formatNumber(terms.coefficientTableVersion, locale),
            })}
          </p>
          <p className="ui-note">{t('explain.rounding')}</p>
          <h4 className="pt-2 font-semibold">{t('explain.netTotals')}</h4>
          <dl>
            {totalRows.map(([key, cents]) => (
              <AmountRow key={key} label={t(key)} amount={money(cents)} />
            ))}
          </dl>
        </div>
      </details>
      <p className="ui-note">
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
    <div className="price-row">
      <dt>{label}</dt>
      <dd>{amount}</dd>
    </div>
  );
}
