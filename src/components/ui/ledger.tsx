// Nordic Circular Ledger primitives: badges, filter chips, the stats strip and
// the exact card/button styles that come straight from docs/ui-nordic-ledger.md.
// All server-safe (no 'use client'), so they ship only HTML and CSS.
import Link from 'next/link';
import type { ReactNode } from 'react';

/** Hairline-framed surface. 8 px corners — the ledger's roundness ceiling. */
export const cardClass =
  'rounded-lg border shadow-ledger bg-card border-hairline dark:bg-stone-900 dark:border-stone-800';

export const btnPrimary =
  'inline-flex items-center justify-center rounded-lg bg-petrol px-4 py-2 font-medium text-white transition-colors hover:bg-petrol-deep disabled:opacity-50';

export const btnGhost =
  'inline-flex items-center justify-center rounded-lg px-4 py-2 font-medium text-lagoon transition-colors hover:bg-sage dark:text-emerald-300 dark:hover:bg-stone-800';

export const inputClass =
  'w-full rounded-lg border bg-card p-2 border-hairline placeholder:text-ink-muted dark:bg-stone-900 dark:border-stone-800';

type BadgeTone = 'mint' | 'life' | 'amber' | 'slate';

const badgeTones: Record<BadgeTone, string> = {
  mint: 'bg-mint text-petrol-ink dark:bg-emerald-950 dark:text-emerald-200',
  // The active-loop tone: items on a later life stand apart from first-life stock.
  life: 'bg-life-fill text-life-ink dark:bg-emerald-800 dark:text-emerald-100',
  amber: 'bg-amber-fill text-amber-ink dark:bg-amber-950 dark:text-amber-200',
  slate: 'bg-sage text-ink-muted dark:bg-stone-800 dark:text-stone-300',
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

/** Filter chip rendered as a link so filtering works without any client JavaScript. */
export function ChipLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'border-petrol bg-petrol text-white'
          : 'bg-card text-ink border-hairline hover:bg-sage dark:bg-stone-900 dark:border-stone-800 dark:text-stone-200 dark:hover:bg-stone-800'
      }`}
    >
      {children}
    </Link>
  );
}

/** Line of big evidence numbers: counts the data pack can prove, never more. */
export function StatStrip({ stats }: { stats: { label: string; value: number }[] }) {
  return (
    <dl className="flex flex-wrap gap-x-10 gap-y-3 rounded-lg border bg-sage px-4 py-3 shadow-ledger border-hairline dark:bg-stone-900 dark:border-stone-800">
      {stats.map((stat) => (
        <div key={stat.label} className="flex items-baseline gap-2">
          <dd className="text-lg font-semibold tabular-nums">{stat.value}</dd>
          <dt className="text-sm text-ink-muted dark:text-stone-400">{stat.label}</dt>
        </div>
      ))}
    </dl>
  );
}
