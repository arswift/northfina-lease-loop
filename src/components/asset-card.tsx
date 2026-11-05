// One catalogue item, styled as a ledger entry (docs/ui-nordic-ledger.md).
// A server component: it renders to HTML and ships no JavaScript.
import Link from 'next/link';
import type { Asset, AssetStatus } from '@/data/schemas';
import { formatEuro } from '@/domain/money';
import type { ListPriceResult } from '@/domain/price-list';
import { formatNumber } from '@/i18n/format';
import type { Translate } from '@/i18n/get-t';
import { intlLocale, type Locale } from '@/i18n/locales';
import { Badge, btnPrimary, cardClass, categoryAccents } from '@/components/ui/ledger';

const statusTone: Record<AssetStatus, 'ice' | 'amber' | 'slate'> = {
  available: 'ice',
  reserved: 'amber',
  returned: 'slate',
};

const statusDot: Record<AssetStatus, string> = {
  available: 'bg-emerald-600 dark:bg-emerald-400',
  reserved: 'bg-amber-500 dark:bg-amber-400',
  returned: 'bg-stone-500 dark:bg-stone-400',
};

/** Card colour comes from the shared category palette in components/ui/ledger. */
type AssetCardProps = {
  asset: Asset;
  price: ListPriceResult;
  priceSource?: string;
  /** From-monthly rent at the documented default term, or null when unsupportable. */
  monthlyFromCents: number | null;
  locale: Locale;
  t: Translate;
};

export function AssetCard({
  asset,
  price,
  priceSource,
  monthlyFromCents,
  locale,
  t,
}: AssetCardProps) {
  const headingId = `asset-${asset.id}`;
  const lifeNumber = asset.previous_lives + 1;

  return (
    <article
      aria-labelledby={headingId}
      className={`${cardClass} relative flex h-full flex-col overflow-hidden p-5 transition-shadow hover:shadow-md`}
    >
      {/* Category accent: the colour mirrors the dot on the filter chip. */}
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-1 ${categoryAccents[asset.category]}`}
      />
      <div className="flex items-start justify-between gap-3">
        <Badge tone={lifeNumber > 1 ? 'life' : 'ice'}>
          {lifeNumber > 1 ? <SecondLifeMark /> : null}
          {t('asset.lifeBadge', { count: lifeNumber })}
        </Badge>
        <Badge tone={statusTone[asset.status]}>
          <span aria-hidden="true" className={`size-1.5 rounded-full ${statusDot[asset.status]}`} />
          <span className="sr-only">{t('status.label')}: </span>
          {t(`status.${asset.status}`)}
        </Badge>
      </div>

      <div className="mt-3">
        <p className="text-sm text-ink-muted dark:text-stone-400">{asset.make}</p>
        <h3 id={headingId} className="text-lg leading-snug font-semibold">
          {asset.model}
        </h3>
      </div>

      <dl className="mt-4 mb-5 rounded-lg bg-mist/60 px-3 py-1.5 dark:bg-stone-800/60">
        <Fact label={t('condition.label')} value={t(`condition.${asset.condition}`)} />
        <Fact label={t('asset.modelYear')} value={String(asset.model_year)} />
        <Fact
          label={t('asset.usage')}
          value={t(`usage.${asset.usage.unit}`, { value: formatNumber(asset.usage.value, locale) })}
        />
        <Fact label={t('asset.previousLives')} value={formatNumber(asset.previous_lives, locale)} />
      </dl>

      <div className="mt-auto flex items-end justify-between gap-3 border-t border-hairline pt-4 dark:border-stone-800">
        <div>
          <p className="text-xs text-ink-muted dark:text-stone-400">{t('asset.listPrice')}</p>
          <p className="mt-0.5 text-base font-semibold tabular-nums">
            {price.ok ? formatEuro(price.priceCents, intlLocale[locale]) : t('asset.noPrice')}
          </p>
          {price.ok && priceSource ? (
            <p className="mt-0.5 text-xs text-ink-muted dark:text-stone-400">
              {priceSource.startsWith('release:')
                ? t('spine.releasePrice', { version: priceSource.split(':')[1] ?? '' })
                : t('asset.priceListVersion', { version: price.priceListVersion })}
            </p>
          ) : null}
        </div>
        {monthlyFromCents !== null ? (
          <div className="rounded-lg bg-ice px-3 py-2 text-right dark:bg-cyan-950/60">
            <p className="text-xs text-ink-muted dark:text-cyan-300">{t('asset.monthlyCaption')}</p>
            <p className="mt-0.5 text-xl font-semibold text-ocean tabular-nums dark:text-cyan-300">
              {formatEuro(monthlyFromCents, intlLocale[locale])}
            </p>
          </div>
        ) : null}
      </div>
      <Link
        href={'/' + locale + '/lease/' + encodeURIComponent(asset.id)}
        className={`${btnPrimary} mt-5 w-full`}
      >
        {asset.status === 'returned' ? t('spine.relist') : t('spine.open')}
      </Link>
    </article>
  );
}

/** One ledger row: label left, evidence right, hairline rule underneath. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-1.5 text-sm last:border-b-0 dark:border-stone-800">
      <dt className="text-ink-muted dark:text-stone-400">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

/** Same loop as the brand mark: an item that already lived before. */
function SecondLifeMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8a5 5 0 0 1 8.7-3.4L13 6" />
      <path d="M13 2.5V6h-3.5" />
      <path d="M13 8a5 5 0 0 1-8.7 3.4L3 10" />
      <path d="M3 13.5V10h3.5" />
    </svg>
  );
}
