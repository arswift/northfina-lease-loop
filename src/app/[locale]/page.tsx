// The catalogue: proven Nordic-ledger evidence, restyled in docs/ui-nordic-ledger.md.
// Every number on this page comes from the data pack or the pricing engine —
// counts, list prices, the VAT rate on today's date and a from-monthly rent.
// Nothing decorative is shown that the data could not support.
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { AssetCard } from '@/components/asset-card';
import {
  Badge,
  ChipLink,
  StatStrip,
  btnPrimary,
  cardClass,
  inputClass,
} from '@/components/ui/ledger';
import { loadCoefficientTable, loadVatRates } from '@/data/load';
import { assetCategorySchema } from '@/data/schemas';
import { calculatePrice } from '@/domain/pricing';
import { taxOn } from '@/domain/vat';
import { formatIsoDate } from '@/i18n/format';
import { getT } from '@/i18n/get-t';
import { isLocale } from '@/i18n/locales';
import { listAssets } from '@/server/assets';
import { cataloguePrices } from '@/server/spine-offers';
import { db } from '@/server/db';
import { todayIso } from '@/server/today';

/** Cards quote a from-price at this term with no down payment; the lease page says why. */
const MONTHLY_FROM_TERM = 24;

const LIFE_FILTERS = ['all', 'first', 'later'] as const;
type LifeFilter = (typeof LIFE_FILTERS)[number];

export default async function CataloguePage({ params, searchParams }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const sp = await searchParams;
  const query = readQuery(sp.q);
  const category = readCategory(sp.category);
  const life = readLife(sp.life);

  // Render on every request: prices depend on today's date and on the database.
  await connection();

  const t = getT(locale);
  const today = todayIso(); // the page decides what "today" is; domain code never reads the clock
  const [assets, offers, coefficientTable, vatRates] = await Promise.all([
    listAssets(db),
    cataloguePrices(db, today),
    loadCoefficientTable(),
    loadVatRates(),
  ]);

  // From-price at the documented default term; the engine decides whether a
  // given price and band even supports that term.
  const monthlyFrom = monthlyFromPrices(offers, coefficientTable);

  // Tax chip: today's VAT rate shown by sampling one euro through taxOn itself.
  const taxSample = taxOn(100 * 100, today, vatRates);
  const vatPercent = taxSample.ok ? formatVatPercent(taxSample.amount.vatBasisPoints) : null;

  const matching = assets.filter((asset) => {
    const matchesQuery =
      !query ||
      [asset.make, asset.model, asset.id].some((field) => field.toLowerCase().includes(query));
    const matchesCategory = category === 'all' || asset.category === category;
    const matchesLife =
      life === 'all' || (life === 'first' ? isFirstLife(asset) : !isFirstLife(asset));
    return matchesQuery && matchesCategory && matchesLife;
  });

  const groups = assetCategorySchema.options
    .filter((option) => category === 'all' || option === category)
    .map((categoryOption) => ({
      category: categoryOption,
      assets: matching.filter((asset) => asset.category === categoryOption),
    }))
    .filter((group) => group.assets.length > 0);

  const firstLifeCount = assets.filter(isFirstLife).length;
  const availableCount = assets.filter((asset) => asset.status === 'available').length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hairline pb-8 dark:border-stone-800">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-petrol-ink sm:text-4xl dark:text-stone-100">
            {t('catalogue.title')}
          </h1>
          <p className="mt-3 text-lg text-ink-muted dark:text-stone-300">{t('catalogue.intro')}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge tone="mint">
              <time dateTime={today}>
                {t('catalogue.pricesOn', { date: formatIsoDate(today, locale) })}
              </time>
            </Badge>
            {vatPercent ? (
              <Badge tone="slate">{t('catalogue.currentVat', { rate: vatPercent })}</Badge>
            ) : null}
          </div>
        </div>

        <form role="search" action={`/${locale}`} className="flex items-end gap-2">
          <input type="hidden" name="category" value={category} />
          <input type="hidden" name="life" value={life} />
          <label htmlFor="catalogue-q" className="sr-only">
            {t('catalogue.search')}
          </label>
          <input
            id="catalogue-q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder={t('catalogue.search')}
            className={`${inputClass} w-56`}
          />
          <button type="submit" className={btnPrimary}>
            {t('catalogue.searchSubmit')}
          </button>
        </form>
      </div>

      <StatStrip
        stats={[
          { label: t('catalogue.statTotal'), value: assets.length },
          { label: t('catalogue.statAvailable'), value: availableCount },
          { label: t('catalogue.statFirstLife'), value: firstLifeCount },
          {
            label: t('catalogue.statLaterLives'),
            value: assets.length - firstLifeCount,
          },
        ]}
      />

      <div aria-label={t('catalogue.filterCategory')} className="mt-6 flex flex-wrap gap-2">
        {assetCategorySchema.options.map((option) => (
          <ChipLink
            key={option}
            href={`/` + locale + withQuery(query, option === category ? 'all' : option, life)}
            active={option === category}
          >
            {t(`category.${option}`)}
          </ChipLink>
        ))}
      </div>
      <div aria-label={t('catalogue.filterLife')} className="mt-2 flex flex-wrap gap-2">
        {LIFE_FILTERS.map((option) => (
          <ChipLink
            key={option}
            href={'/' + locale + withQuery(query, category, option === life ? 'all' : option)}
            active={option === life}
          >
            {option === 'first'
              ? t('catalogue.filterFirstLife')
              : option === 'later'
                ? t('catalogue.filterLaterLives')
                : t('catalogue.filterAll')}
          </ChipLink>
        ))}
      </div>

      {matching.length === 0 ? (
        <p className={`mt-10 p-6 text-ink-muted ${cardClass}`}>{t('catalogue.noMatches')}</p>
      ) : null}

      {groups.map((group) => (
        <section
          key={group.category}
          aria-labelledby={`category-${group.category}`}
          className="mt-10"
        >
          <div className="flex items-baseline justify-between gap-4 border-b border-hairline pb-3 dark:border-stone-800">
            <h2 id={`category-${group.category}`} className="text-lg font-semibold">
              {t(`category.${group.category}`)}
            </h2>
            <p className="text-sm text-ink-muted dark:text-stone-400">
              {t('catalogue.itemCount', { count: group.assets.length })}
            </p>
          </div>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.assets.map((asset) => (
              <li key={asset.id}>
                <AssetCard
                  asset={asset}
                  price={
                    offers[asset.id]
                      ? {
                          ok: true,
                          priceCents: offers[asset.id]!.priceCents,
                          priceListVersion: Number(offers[asset.id]!.source.split(':')[1]),
                        }
                      : { ok: false, reason: 'no_price_list_on_date' }
                  }
                  priceSource={offers[asset.id]?.source}
                  monthlyFromCents={monthlyFrom[asset.id] ?? null}
                  locale={locale}
                  t={t}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** First life = never leased by anyone yet in the data pack. */
function isFirstLife(asset: { previous_lives: number }): boolean {
  return asset.previous_lives === 0;
}

function readQuery(raw: string | string[] | undefined): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, 60);
}

function readCategory(raw: string | string[] | undefined) {
  return typeof raw === 'string' && (assetCategorySchema.options as string[]).includes(raw)
    ? raw
    : 'all';
}

function readLife(raw: string | string[] | undefined): LifeFilter {
  return typeof raw === 'string' && (LIFE_FILTERS as readonly string[]).includes(raw)
    ? (raw as LifeFilter)
    : 'all';
}

/** Rebuilds the URL query, dropping an 'all' or empty filter back out. */
function withQuery(query: string, category: string, life: string): string {
  const sp = new URLSearchParams();
  if (query) sp.set('q', query);
  if (category !== 'all') sp.set('category', category);
  if (life !== 'all') sp.set('life', life);
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

function monthlyFromPrices(
  offers: Awaited<ReturnType<typeof cataloguePrices>>,
  table: Parameters<typeof calculatePrice>[0]['table']
): Record<string, number> {
  const monthly: Record<string, number> = {};
  for (const [assetId, offer] of Object.entries(offers)) {
    if (!offer) continue;
    const result = calculatePrice({
      listPriceCents: offer.priceCents,
      downPaymentCents: 0,
      termMonths: MONTHLY_FROM_TERM,
      table,
    });
    if (result.ok) monthly[assetId] = result.terms.monthlyNetCents;
  }
  return monthly;
}

/** 2550 basis points is a display-only "25.5"; no money crosses this helper. */
function formatVatPercent(basisPoints: number): string {
  const whole = Math.floor(basisPoints / 100);
  const fraction = basisPoints % 100;
  const trimmed = String(fraction).replace(/0+$/, '');
  return trimmed ? `${whole}.${trimmed}` : String(whole);
}
