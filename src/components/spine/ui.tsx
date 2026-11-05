import type { ReactNode } from 'react';
import type { PriceTerms } from '@/domain/pricing';
import { formatEuro } from '@/domain/money';
import { getT, messages, type MessageKey } from '@/i18n/get-t';
import { intlLocale, type Locale } from '@/i18n/locales';

export const panelClass =
  'rounded-lg border border-hairline bg-card p-5 shadow-ledger dark:border-stone-800 dark:bg-stone-900';
export const inputClass = 'mt-1 w-full rounded-lg border border-stone-400 bg-transparent p-2';
export const buttonClass =
  'rounded-lg bg-petrol px-4 py-2 font-medium text-white transition-colors hover:bg-petrol-deep disabled:opacity-50';

export function messageFor(
  locale: Locale,
  key: string,
  fallback: MessageKey = 'spine.error'
): string {
  return getT(locale)(key in messages[locale] ? (key as MessageKey) : fallback);
}

export function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

export function MoneyFacts({ terms, locale }: { terms: PriceTerms; locale: Locale }) {
  const t = getT(locale);
  const values: [MessageKey, number][] = [
    ['spine.list', terms.listPriceCents],
    ['spine.down', terms.downPaymentCents],
    ['spine.financed', terms.financedCents],
    ['spine.monthlyNet', terms.monthlyNetCents],
    ['spine.rentTotal', terms.totalRentNetCents],
    ['spine.buyout', terms.buyoutNetCents],
    ['spine.useTotal', terms.downPaymentCents + terms.totalRentNetCents],
    ['spine.ownTotal', terms.downPaymentCents + terms.totalRentNetCents + terms.buyoutNetCents],
  ];
  return (
    <dl className="space-y-3">
      {values.map(([key, amount]) => (
        <div
          key={key}
          className="flex flex-wrap justify-between gap-2 border-b border-stone-200 pb-2 dark:border-stone-800"
        >
          <dt>{t(key)}</dt>
          <dd className="font-semibold tabular-nums">{formatEuro(amount, intlLocale[locale])}</dd>
        </div>
      ))}
    </dl>
  );
}
