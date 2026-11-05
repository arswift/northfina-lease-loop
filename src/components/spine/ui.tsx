import type { ReactNode } from 'react';
import type { Asset } from '@/data/schemas';
import type { PriceTerms } from '@/domain/pricing';
import { formatEuro } from '@/domain/money';
import { formatNumber } from '@/i18n/format';
import { getT, messages, type MessageKey } from '@/i18n/get-t';
import { intlLocale, type Locale } from '@/i18n/locales';
import { AssetVisual } from '@/components/asset-visual';
import { Badge, categoryAccents } from '@/components/ui/ledger';

export const panelClass =
  'rounded-lg border border-hairline bg-card p-6 shadow-ledger dark:border-stone-800 dark:bg-stone-900';

export const inputClass =
  'mt-1.5 w-full rounded-lg border border-hairline-strong bg-white px-3 py-2 text-sm text-ink transition-colors focus:border-ocean dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100';

export const buttonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-ocean px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ocean-deep disabled:cursor-not-allowed disabled:opacity-50';

export const secondaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-hairline-strong bg-white px-4 py-2.5 text-sm font-medium text-navy transition-colors hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800';

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
      <label htmlFor={id} className="block text-sm font-medium text-navy dark:text-stone-200">
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
    <dl className="divide-y divide-hairline rounded-lg border border-hairline bg-mist/50 px-4 py-1 text-sm dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-800/50">
      {values.map(([key, amount]) => (
        <div key={key} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
          <dt className="text-ink-muted dark:text-stone-300">{t(key)}</dt>
          <dd className="font-semibold text-navy tabular-nums dark:text-stone-100">
            {formatEuro(amount, intlLocale[locale])}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const statusTone = {
  available: 'ice',
  reserved: 'amber',
  returned: 'slate',
} as const;

const statusDot = {
  available: 'bg-emerald-600 dark:bg-emerald-400',
  reserved: 'bg-amber-500 dark:bg-amber-400',
  returned: 'bg-stone-500 dark:bg-stone-400',
} as const;

/** Product showcase card at the top of the lease journey page. */
export function AssetShowcase({
  asset,
  offer,
  locale,
}: {
  asset: Asset;
  offer: { priceCents: number; source: string } | null;
  locale: Locale;
}) {
  const t = getT(locale);
  const lifeNumber = asset.previous_lives + 1;

  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-card shadow-ledger dark:border-stone-800 dark:bg-stone-900">
      <span aria-hidden="true" className={`block h-1 w-full ${categoryAccents[asset.category]}`} />
      <div className="grid md:grid-cols-5">
        <div className="md:col-span-2 [&>div]:h-full [&>div]:min-h-52 [&>div]:border-b md:[&>div]:border-r md:[&>div]:border-b-0">
          <AssetVisual
            category={asset.category}
            assetId={asset.id}
            topLeft={
              <Badge tone={lifeNumber > 1 ? 'life' : 'ice'}>
                {t('asset.lifeBadge', { count: lifeNumber })} · {t(`condition.${asset.condition}`)}
              </Badge>
            }
            topRight={
              <Badge tone={statusTone[asset.status]}>
                <span
                  aria-hidden="true"
                  className={`size-1.5 rounded-full ${statusDot[asset.status]}`}
                />
                <span className="sr-only">{t('status.label')}: </span>
                {t(`status.${asset.status}`)}
              </Badge>
            }
          />
        </div>

        <div className="flex flex-col justify-between p-6 md:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium tracking-wide text-ink-muted uppercase dark:text-stone-400">
                {t(`category.${asset.category}`)} · {asset.make} · {asset.model_year}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-navy sm:text-3xl dark:text-stone-100">
                {asset.make} {asset.model}
              </h1>
            </div>
            {offer ? (
              <div className="rounded-lg border border-ocean/20 bg-ice/80 px-3.5 py-2 text-right dark:border-cyan-800 dark:bg-cyan-950/50">
                <p className="text-xs text-ink-muted dark:text-cyan-300">{t('asset.listPrice')}</p>
                <p className="mt-0.5 text-xl font-semibold text-ocean tabular-nums dark:text-cyan-200">
                  {formatEuro(offer.priceCents, intlLocale[locale])}
                </p>
              </div>
            ) : null}
          </div>

          <dl className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-hairline bg-mist/60 px-3 py-2 dark:border-stone-800 dark:bg-stone-800/60">
              <dt className="text-xs text-ink-muted dark:text-stone-400">{t('condition.label')}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-navy dark:text-stone-100">
                {t(`condition.${asset.condition}`)}
              </dd>
            </div>
            <div className="rounded-lg border border-hairline bg-mist/60 px-3 py-2 dark:border-stone-800 dark:bg-stone-800/60">
              <dt className="text-xs text-ink-muted dark:text-stone-400">{t('asset.usage')}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-navy tabular-nums dark:text-stone-100">
                {t(`usage.${asset.usage.unit}`, {
                  value: formatNumber(asset.usage.value, locale),
                })}
              </dd>
            </div>
            <div className="rounded-lg border border-hairline bg-mist/60 px-3 py-2 dark:border-stone-800 dark:bg-stone-800/60">
              <dt className="text-xs text-ink-muted dark:text-stone-400">
                {t('asset.previousLives')}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-navy tabular-nums dark:text-stone-100">
                {formatNumber(asset.previous_lives, locale)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
