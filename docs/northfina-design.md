# Selectable Northfina-inspired design

Branch: `feat/northfina-theme-switcher`. Base: `feat/editorial-price-design`
at `934e9db`. This branch preserves the green design and adds an independent
Northfina-inspired presentation, not an official Northfina product or brand kit.
The pricing model, APIs, database and saved financial records are unchanged.

## Reference inspection

Reviewed on 6 November 2026: the public [home page](https://www.northfina.fi/en),
[dealer page](https://www.northfina.fi/en/dealers) and
[bank page](https://www.northfina.fi/en/banks), at desktop and mobile sizes.
The read-only `Design reference` workflow captures real Chromium screenshots,
HTML and computed styles; no contact forms were submitted. Reference run:
[42191294209](https://github.com/arswift/northfina-lease-loop/actions/runs/42191294209).

The design is derived from observed shapes and hierarchy, not just a blue palette:

**Typography.** The observed family is Zalando Sans SemiExpanded, with a 45px,
weight-400 hero and slightly tight tracking. The blue style uses the same family,
responsive headings and readable controls; green keeps its existing typography.

**Gradients.** The hero combines `#003dfc` to `#0036e5` with pale-blue and cyan
radial layers. Lease Loop uses those layered surfaces for the item and catalogue
introduction, and a controlled darker blue behind small text in the price panel.

**Shapes and depth.** Outlined capsule labels, raised portal badges and layered
illustrative cards echo the reference. Wide rounded hero bases and 30px form
panels sit alongside nearly square 4px-corner input fields.

**Actions and forms.** Dark capsule buttons use `#474747` to `#1b1819` on light
surfaces. The terms panel borrows the pale `#dfe9ff`, `#e6eeff`, `#edf2ff`
gradient, but uses stronger field boundaries for accessibility. The charcoal
footer has 40px upper corners and retains Lease Loop's demo wording.

The inspected public pages explicitly use a light colour scheme. The navy dark
style is a new adaptation, not a claim that Northfina supplies an official dark
palette. It keeps the blue identity but changes surfaces, text, borders and button
contrast rather than simply inverting the page.

Product photos and Northfina logos are not copied. Decorative SVGs remain generic
category illustrations; asset identity and financial information remain in text.

## Using the controls

Open **Appearance** in the header. Choose **Green** or **Northfina**, independently
of **Light**, **Dark** or **System**. The initial choice remains green/system.
The labels and status message are translated into English, Finnish, Swedish and
Estonian. Native radio groups support keyboard navigation; Escape closes the
panel and returns focus to its trigger. Leaving the panel also closes it.

Preferences use `lease-loop-appearance-v1` in browser local storage. They survive
reloads, route/language changes and synchronize across tabs. They are device/browser
preferences, not account settings. Blocked storage still permits switching for the
current page and shows a warning. Corrupt values are validated against an allowlist.
Appearance changes do not save quotes, sign contracts or alter the price draft.

A small static script applies allow-listed attributes before the body is painted.
The explicit colour choice overrides the operating-system setting; system mode
tracks changes live. A CSS media-query fallback keeps the default green experience
usable without JavaScript. Only the root theme attributes suppress the expected
hydration warning; other hydration failures remain test failures.

## Implementation boundaries

- `src/components/appearance/`: validated preferences, early initialization,
  browser subscription and native controls. Unit tests exercise stored data and
  the actual initialization script, including blocked storage.
- `src/app/globals.css`: deterministic stylesheet order and the explicit Tailwind
  `dark` variant. `ui-base.css` contains the original shared accessibility styles.
- `src/app/editorial.css`: retained green style, explicit dark-mode support and
  repaired mobile hero layout. `northfina.css` contains scoped blue overrides.
- `src/app/appearance.css`: responsive preference controls and focus treatment.
- `src/i18n/messages/appearance.*.json`: feature dictionaries merged by `getT`;
  existing key-parity tests still cover every language.
- The exact font uses `next/font/google`, fetched during the build and self-hosted
  by Next.js. The visitor's browser makes no request to a Google font service.
  Green retains its existing system/serif typography and does not preload this font.

The installed Next.js font, script and root-layout guides were inspected from the
runner's `node_modules/next/dist/docs`. See also the official
[font documentation](https://nextjs.org/docs/app/getting-started/fonts) and
[Tailwind colour-mode guidance](https://tailwindcss.com/docs/dark-mode).

## Accessibility and verification

The original site's 40px fields and very pale boundaries are not copied blindly:
controls retain the project's 44–48px targets, 3px focus ring, explicit labels,
error messages, reduced-motion and forced-colour support. Required financial
information is never hidden to create a cleaner visual impression.

Calculated solid-colour examples (not proof of full-page conformance): white on
`#0a44fa` is 6.52:1; muted light text `#555964` on `#f6f7ff` is 6.56:1; dark-mode
secondary text `#b8c5df` on `#131c32` is 9.75:1. The strengthened field boundary
`#6d7891` against `#e6eeff` is 3.80:1. Gradients, focus, text size and actual
composition require browser review, not just these pairs.

The unchanged core CI runs formatting, lint, types, tests with coverage, file-size,
no-AI and production build checks. The UI workflow now includes this branch and
checks every new commit message from the green base, not only the last commit.
The previous editorial branch's formatting errors are repaired, not ignored.

`check-ui.mjs` retains the existing green four-language, light/dark, mobile/desktop
regressions and financial interactions. `check-appearance.mjs` adds the Northfina
matrix, explicit modes opposed to OS preference, open-panel axe checks, keyboard,
text enlargement, forced colours, persistence, tab synchronization, blocked/corrupt
storage and initialization with React bundles blocked. Both use an isolated seeded
database. Actual results and screenshots are stored in each workflow's artifacts;
check the final revision's run rather than treating this planned matrix as a pass.

Source formatting can run in the editing environment. Full dependency installation,
application build and browser checks run in GitHub Actions. Commits are created
through the GitHub connector, which does not execute local Git hooks; no hook or
quality gate is disabled. No manual screen-reader session or testing with real
users is claimed, and automated axe results do not establish WCAG certification.
