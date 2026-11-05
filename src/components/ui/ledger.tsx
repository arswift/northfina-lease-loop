// Nordic Circular Ledger primitives: badges, filter chips, the stats strip and
// the exact card/button styles that come straight from docs/ui-nordic-ledger.md.
// All server-safe (no 'use client'), so they ship only HTML and CSS.
import Link from 'next/link';
import type { ReactNode } from 'react';

/** Hairline-framed surface. 8 px corners — the ledger's roundness ceiling. */
export const cardClass =
  'rounded-lg border shadow-ledger bg-card border-hairline dark:bg-stone-900 dark:border-stone-800';

export const btnPrimary =
  'inline-flex items-center justify-center rounded-lg bg-ocean px-4 py-2 font-medium text-white transition-colors hover:bg-ocean-deep disabled:opacity-50';

export const btnGhost =
  'inline-flex items-center justify-center rounded-lg px-4 py-2 font-medium text-ocean transition-colors hover:bg-mist dark:text-emerald-300 dark:hover:bg-stone-800';

export const inputClass =
  'w-full rounded-lg border bg-card p-2 border-hairline placeholder:text-ink-muted dark:bg-stone-900 dark:border-stone-800';

type BadgeTone = 'ice' | 'life' | 'amber' | 'slate';

const badgeTones: Record<BadgeTone, string> = {
  ice: 'bg-ice text-navy dark:bg-emerald-950 dark:text-emerald-200',
  // The active-loop tone: items on a later life stand apart from first-life stock.
  life: 'bg-life-fill text-life-ink dark:bg-emerald-800 dark:text-emerald-100',
  amber: 'bg-amber-fill text-amber-ink dark:bg-amber-950 dark:text-amber-200',
  slate: 'bg-mist text-ink-muted dark:bg-stone-800 dark:text-stone-300',
};

/** 4 px-corner status chip. Mint = operational, amber = needs attention, slate = neutral. */
export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Category colours, mirrored on card accents so the palette doubles as a legend. */
export const categoryAccents: Record<string, string> = {
  e_bike: 'bg-emerald-500',
  laptop: 'bg-indigo-400',
  farm_machine: 'bg-amber-400',
};

/** Filter chip rendered as a link so filtering works without any client JavaScript. */
export function ChipLink({
  href,
  active,
  dot,
  children,
}: {
  href: string;
  active: boolean;
  dot?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'border-ocean bg-ocean text-white'
          : 'bg-card text-ink border-hairline hover:bg-mist dark:bg-stone-900 dark:border-stone-800 dark:text-stone-200 dark:hover:bg-stone-800'
      }`}
    >
      {dot ? <span aria-hidden="true" className={`me-1.5 size-1.5 rounded-full ${dot}`} /> : null}
      {children}
    </Link>
  );
}

/** Grid of big evidence numbers: counts the data pack can prove, never more. */
export function StatStrip({ stats }: { stats: { label: string; value: number }[] }) {
  return (
    <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={`rounded-lg border px-4 py-3 shadow-ledger ${
            index === 3
              ? 'border-emerald-300/80 bg-life-fill/35 dark:border-emerald-800 dark:bg-emerald-950/40'
              : 'border-hairline bg-card dark:border-stone-800 dark:bg-stone-900'
          }`}
        >
          <dt className="text-xs font-medium tracking-wide text-ink-muted uppercase dark:text-stone-400">
            {stat.label}
          </dt>
          <dd className="mt-1 text-2xl font-semibold tracking-tight text-navy tabular-nums dark:text-stone-100">
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
