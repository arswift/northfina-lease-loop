// Architectural line-art illustrations for each asset category, rendered on a
// tinted blueprint surface. Pure SVG: no external images, zero client JS.
import type { ReactNode } from 'react';
import type { AssetCategory } from '@/data/schemas';

const surfaceByCategory: Record<
  AssetCategory,
  { bg: string; stroke: string; badge: string; dot: string }
> = {
  e_bike: {
    bg: 'bg-gradient-to-br from-emerald-50 via-teal-50/70 to-cyan-100/60 dark:from-emerald-950/50 dark:via-teal-950/40 dark:to-stone-900',
    stroke: 'text-ocean dark:text-emerald-300',
    badge:
      'border-emerald-200/80 bg-white/90 text-navy dark:border-emerald-800 dark:bg-stone-900/90 dark:text-emerald-200',
    dot: 'bg-emerald-500',
  },
  laptop: {
    bg: 'bg-gradient-to-br from-sky-50 via-indigo-50/60 to-cyan-100/60 dark:from-sky-950/50 dark:via-indigo-950/40 dark:to-stone-900',
    stroke: 'text-ocean dark:text-sky-300',
    badge:
      'border-sky-200/80 bg-white/90 text-navy dark:border-sky-800 dark:bg-stone-900/90 dark:text-sky-200',
    dot: 'bg-indigo-400',
  },
  farm_machine: {
    bg: 'bg-gradient-to-br from-amber-50/90 via-orange-50/50 to-stone-100/80 dark:from-amber-950/40 dark:via-stone-900 dark:to-stone-900',
    stroke: 'text-amber-900 dark:text-amber-300',
    badge:
      'border-amber-200/80 bg-white/90 text-amber-950 dark:border-amber-800 dark:bg-stone-900/90 dark:text-amber-200',
    dot: 'bg-amber-500',
  },
};

export function AssetVisual({
  category,
  assetId,
  topLeft,
  topRight,
}: {
  category: AssetCategory;
  assetId: string;
  topLeft: ReactNode;
  topRight: ReactNode;
}) {
  const theme = surfaceByCategory[category];

  return (
    <div
      className={`relative h-44 overflow-hidden border-b border-hairline ${theme.bg} dark:border-stone-800`}
    >
      {/* Subtle technical grid */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full opacity-35 dark:opacity-15"
      >
        <defs>
          <pattern id={`grid-${assetId}`} width="24" height="24" patternUnits="userSpaceOnUse">
            <path
              d="M 24 0 L 0 0 0 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-ocean/25 dark:text-stone-500"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#grid-${assetId})`} />
      </svg>

      {/* Center illustration */}
      <div className={`absolute inset-0 flex items-center justify-center pt-5 ${theme.stroke}`}>
        {category === 'e_bike' ? <EBikeArtwork /> : null}
        {category === 'laptop' ? <LaptopArtwork /> : null}
        {category === 'farm_machine' ? <TractorArtwork /> : null}
      </div>

      {/* Top overlay badges (Life pill + Status) */}
      <div className="relative z-10 flex items-start justify-between gap-2 p-3.5">
        {topLeft}
        {topRight}
      </div>

      {/* Bottom serial tag */}
      <div className="absolute right-3.5 bottom-2.5 z-10">
        <span
          className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[11px] font-medium tracking-tight backdrop-blur-xs ${theme.badge}`}
        >
          <span aria-hidden="true" className={`size-1.5 rounded-full ${theme.dot}`} />#{assetId}
        </span>
      </div>
    </div>
  );
}

function EBikeArtwork() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 110"
      className="h-28 w-auto"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="46" cy="74" r="24" strokeOpacity="0.85" />
      <circle cx="46" cy="74" r="18" strokeDasharray="3 4" strokeOpacity="0.4" />
      <circle cx="46" cy="74" r="4" fill="currentColor" />
      <circle cx="154" cy="74" r="24" strokeOpacity="0.85" />
      <circle cx="154" cy="74" r="18" strokeDasharray="3 4" strokeOpacity="0.4" />
      <circle cx="154" cy="74" r="4" fill="currentColor" />
      {/* Frame + battery pack */}
      <path d="M46 74 L82 42 L132 42 L100 74 Z" />
      <path d="M82 42 L100 74" strokeWidth="4" strokeOpacity="0.35" />
      <path d="M74 30 L90 30 M82 30 L82 42" />
      <path d="M132 42 L154 74" />
      <path d="M126 26 L142 26 L132 42" />
      {/* Rear rack */}
      <path d="M40 48 L72 48 L82 42 M46 74 L56 48" strokeOpacity="0.7" />
    </svg>
  );
}

function LaptopArtwork() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 110"
      className="h-28 w-auto"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="44" y="18" width="112" height="68" rx="5" fill="currentColor" fillOpacity="0.06" />
      <rect x="52" y="25" width="96" height="52" rx="2" strokeOpacity="0.55" />
      {/* Screen ledger lines */}
      <path
        d="M62 37 H106 M62 46 H134 M62 54 H122 M62 62 H94"
        strokeOpacity="0.45"
        strokeWidth="1.5"
      />
      <circle cx="132" cy="37" r="4" strokeOpacity="0.6" />
      {/* Base */}
      <path d="M28 86 H172 L164 94 H36 Z" fill="currentColor" fillOpacity="0.1" />
      <path d="M90 89 H110" strokeOpacity="0.6" />
    </svg>
  );
}

function TractorArtwork() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 110"
      className="h-28 w-auto"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Cabin */}
      <path d="M64 22 H112 L118 54 H60 Z" fill="currentColor" fillOpacity="0.07" />
      <path d="M72 28 V50 M92 28 V50" strokeOpacity="0.5" />
      {/* Hood + exhaust */}
      <path d="M118 40 H156 V66 H56 V54" fill="currentColor" fillOpacity="0.09" />
      <path d="M142 40 V24 H147" />
      {/* Rear big wheel + front wheel */}
      <circle cx="68" cy="74" r="24" fill="currentColor" fillOpacity="0.08" />
      <circle cx="68" cy="74" r="11" />
      <circle cx="146" cy="80" r="16" fill="currentColor" fillOpacity="0.08" />
      <circle cx="146" cy="80" r="7" />
    </svg>
  );
}
