import type { VatRates } from '@/data/schemas';
import { GrossTotals } from './gross-totals';
import type { ContractView } from '@/server/spine-views';
import { formatEuro } from '@/domain/money';
import { getT } from '@/i18n/get-t';
import { intlLocale, type Locale } from '@/i18n/locales';
import { buttonClass, messageFor, MoneyFacts, panelClass } from './ui';

type Invoice = ContractView['invoices'][number];
type Forecast = ContractView['forecast'][number];

function InvoiceTable({ rows, locale }: { rows: readonly (Invoice | Forecast)[]; locale: Locale }) {
  const money = (value: number) => formatEuro(value, intlLocale[locale]);
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-hairline bg-card dark:border-stone-700 dark:bg-stone-900">
      <table className="w-full text-left text-sm tabular-nums">
        <thead>
          <tr className="border-b border-hairline bg-mist/80 text-xs tracking-wide text-ink-muted uppercase dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300">
            {['period', 'scheduled', 'invoiceDate', 'due', 'net', 'vat', 'gross'].map((key) => (
              <th key={key} scope="col" className="p-3 font-semibold">
                {messageFor(locale, 'spine.' + key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline dark:divide-stone-800">
          {rows.map((row, index) => (
            <tr key={'id' in row ? row.id : row.period}>
              <th scope="row" className="p-3 font-medium text-navy dark:text-stone-200">
                {'kind' in row && row.kind !== 'rent'
                  ? messageFor(
                      locale,
                      row.kind === 'buyout' ? 'spine.buyoutInvoice' : 'spine.down_payment'
                    )
                  : row.period || index + 1}
              </th>
              <td className="p-3 text-ink-muted dark:text-stone-300">
                {'scheduledFor' in row ? row.scheduledFor : row.invoiceDate}
              </td>
              <td className="p-3 text-ink-muted dark:text-stone-300">{row.invoiceDate}</td>
              <td className="p-3 text-ink-muted dark:text-stone-300">{row.dueDate}</td>
              <td className="p-3">{money(row.netCents)}</td>
              <td className="p-3 text-ink-muted dark:text-stone-300">
                {money(row.vatCents)} ({row.vatBasisPoints / 100}%)
              </td>
              <td className="p-3 font-semibold text-navy dark:text-stone-100">
                {money(row.grossCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ContractPanel({
  contract,
  locale,
  busy,
  onIssue,
  onDate,
  vatRates,
}: {
  contract: ContractView;
  vatRates: VatRates;
  locale: Locale;
  busy: boolean;
  onIssue: () => void;
  onDate: (date: string) => void;
}) {
  const t = getT(locale);
  return (
    <section className={panelClass} aria-labelledby="agreement-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4 dark:border-stone-800">
        <div>
          <h2
            id="agreement-heading"
            className="text-xl font-semibold text-navy dark:text-stone-100"
          >
            {t('spine.contract')}
          </h2>
          <p className="mt-1 font-mono text-xs text-ink-muted break-all dark:text-stone-400">
            {t('spine.contractId')}: {contract.id}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-life-fill px-2.5 py-1 text-xs font-semibold text-life-ink">
          {t('spine.life', { count: contract.lifeNumber })} ·{' '}
          {messageFor(locale, 'spine.' + contract.status)}
        </span>
      </div>
      <p className="mt-3 text-sm font-medium text-navy tabular-nums dark:text-stone-200">
        {t('spine.signed', { date: contract.signedOn })} ·{' '}
        {t('spine.endDate', { date: contract.endDate })}
      </p>
      <div className="mt-5">
        <MoneyFacts terms={contract.terms} locale={locale} />
        <p className="mt-3 text-xs text-ink-muted dark:text-stone-400">
          {t('spine.savedOffer', { date: contract.pricedOn, source: contract.priceSource })}
        </p>
        <GrossTotals
          terms={contract.terms}
          startDate={contract.startDate}
          upfrontDate={contract.signedOn}
          vatRates={vatRates}
          issued={contract.invoices}
          locale={locale}
        />
      </div>
      <p className="mt-4 text-xs text-ink-muted dark:text-stone-400">{t('spine.taxHelp')}</p>
      <h3 className="mt-8 border-t border-hairline pt-6 text-lg font-semibold text-navy dark:border-stone-800 dark:text-stone-100">
        {t('spine.invoices')}
      </h3>
      <p className="mt-1 text-sm text-ink-muted dark:text-stone-300">{t('spine.issuedHelp')}</p>
      {contract.invoices.length ? (
        <InvoiceTable rows={contract.invoices} locale={locale} />
      ) : (
        <p className="mt-3 rounded-lg border border-hairline bg-mist/40 p-3 text-sm text-ink-muted dark:border-stone-800 dark:bg-stone-800/40 dark:text-stone-400">
          {t('spine.noneIssued')}
        </p>
      )}
      {contract.status === 'active' ? (
        <div className="mt-5 flex flex-wrap gap-3">
          <button className={buttonClass} disabled={busy} onClick={onIssue}>
            {t('spine.issue')}
          </button>
          {contract.nextScheduledDate ? (
            <button
              className={buttonClass}
              disabled={busy}
              onClick={() => onDate(contract.nextScheduledDate!)}
            >
              {t('spine.nextDate')}
            </button>
          ) : null}
        </div>
      ) : null}
      <details className="mt-6 rounded-lg border border-hairline bg-mist/35 p-4 dark:border-stone-800 dark:bg-stone-800/35">
        <summary className="cursor-pointer text-sm font-semibold text-navy dark:text-stone-100">
          {t('spine.forecast')}
        </summary>
        <p className="mt-3 text-xs text-ink-muted dark:text-stone-300">{t('spine.forecastHelp')}</p>
        {contract.forecastAvailable ? (
          <InvoiceTable rows={contract.forecast} locale={locale} />
        ) : (
          <p>{t('spine.error')}</p>
        )}
      </details>
    </section>
  );
}
