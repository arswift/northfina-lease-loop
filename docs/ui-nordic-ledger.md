# UI theme: Nordic Circular Ledger

The catalogue is styled after the "Nordic Circular Ledger" brief: institutional
Nordic banking rigor fused with ecological stewardship — calm, hairline-framed,
audited. The primary is the spec's deep forest green (`#1B4332`), used for
authoritative marks, active navigation roots and primary actions; emerald
(`#059669`/`#10B981`) stays reserved for interactivity, success and focus.
This document records the tokens and the honesty rules the UI follows.

## Design principles

- **Clarity over ornamentation** — structured grids, hairline framing, generous
  white space. No expressive gradients, no floating shadows.
- **Audited permanence** — money, dates and lifecycle states are the visual
  anchors; every figure is tabular-aligned so columns of numbers read like a ledger.
- **Natural utility** — forest and sage tones soften the financial structure
  without losing institutional weight.
- **Show only what the data proves** — no decorative metric the data pack cannot
  support. Counts and prices come from `data/*.json` and the pricing engine.

## Tokens (`src/app/globals.css`, Tailwind v4 `@theme`)

| Token               | Value                          | Use                                           |
| ------------------- | ------------------------------ | --------------------------------------------- |
| `paper`             | `#fcf9f5`                      | page canvas (warm off-white for long reading) |
| `card`              | `#ffffff`                      | cards, tables, inputs                         |
| `sage` / `mint`     | `#f2f5f3` / `#e8efea`          | quiet status fills and chips                  |
| `hairline`          | `#e5e5df`                      | 1 px borders (the only framing)               |
| `ink` / `ink-muted` | `#1c1c1a` / `#575753`          | text / metadata, labels, table keys           |
| `forest` / `deep`   | `#1b4332` / `#143527`          | primary actions, brand mark (hover `deep`)    |
| `pine`              | `#012d1d`                      | headings-scale ink                            |
| `amber-fill/ink`    | `#fef3c7` / `#92400e`          | attention only: reserved, review states       |
| `shadow-ledger`     | `0 1px 2px rgba(28,28,26,.03)` | the only shadow                               |

- Typography: self-hosted **DM Sans** variable TTF (`src/app/fonts`, OFL licence)
  wired through `next/font/local` so the demo runs offline. Body ≥ 16 px,
  `tabular-nums` on every money or count figure.
- Corner ceiling: 8 px (`rounded-lg`); badges 4 px; pills full.
- Focus: the pre-existing 2 px emerald `:focus-visible` ring everywhere.

## Components

- `src/components/ui/ledger.tsx` — `Badge` (mint = first-life stock, bright
  `life-fill #85f8c4` = items on a later life, amber = attention, slate =
  neutral), `ChipLink`
  (filter chips, `aria-current`, plain links so filtering needs no JavaScript),
  `StatStrip`, card/button/input classes.
- Catalogue (`src/app/[locale]/page.tsx`): search (GET form) by make, model or
  ID; category and life-stage chips (`?category=…&life=first|later`); a stat
  strip of provable fleet counts; today's VAT rate shown by sampling
  `domain/vat.ts` itself; the from-monthly rent computed by
  `domain/pricing.ts` at the documented default term (24 months, no down
  payment) and labelled as such.
- Asset card (`src/components/asset-card.tsx`): life badge (`Life {n}`, with a
  loop mark and the bright loop tone once an item is past its first life),
  status badge, fact rows framed as ledger rows (label left, evidence right,
  hairline rules, soft `sage/60` container), list price + price source,
  from-rent and one primary action.

## Deliberate exclusions

- **No sidebar navigation** — the app has two pages; a sidebar would only
  advertise screens that do not exist.
- **No photos** — the data pack ships none; inventing or hot-linking images is
  not allowed.
- **No "View Passport" card CTA** — the passport renders inside the lease
  journey (`history-panel`); there is no standalone passport page yet.
- **No invented regulatory claims** — the mockup's "Regulated by
  Finanssivalvonta" / "OP & Nordea" copy and decorative CO₂ statistics are
  replaced by real counts or the synthetic-demo footer note.
- Dark mode keeps the pre-existing stone/emerald pairing; the ledger tokens
  target the light theme. Dark rendering is a supporting fallback, not a
  target: new surfaces only need a reasonable dark pairing.
- **No pagination** — the fleet is 30 seeded assets; hiding any of them behind
  page breaks would risk the judges' scenario cards. Filtering and search are
  the navigation. When the catalogue grows past a screen, the grid switches to
  cursor pagination that composes with the existing `?category`, `?life` and
  `?q` params; a future note here will mark that switch.

## Verification

- `npm run check:all` green (format, lint, types, file size, no-AI, coverage, build).
- `npm test` — 829 tests incl. the four-language message key parity test.
- Filtering and searching are pure links/forms — they work with JS disabled.

## Demo date note

The catalogue uses the real system date; the lease journey uses the simulated
`x-demo-date`. Both carry their own explanation
(`docs/spine-demo.md`, `docs/spine-policies.md`).
