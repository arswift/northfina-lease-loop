# A calm, understandable price journey

Design review: 5 November 2026. Implementation base: `3490b61` on `main`.
Work is isolated in `feat/accessible-price-design`; it does not replace the pricing
model, API, database, translations or saved-offer rules.

## What the person needs to decide

Can I afford the payment now, the monthly payments and the whole lease? What changes
if I choose another term? Do I have to buy the item at the end? What does continuing
actually do?

The screen answers those questions before explaining the coefficient. Reducing visual
noise must not reduce financial disclosure. A small monthly price is not evidence of
a low total cost. Neither an estimate nor a synthetic demo is a binding real offer.

## Skills evaluated

| Resource | Useful contribution | Boundary in this application |
| --- | --- | --- |
| Anthropic `frontend-design` | Deliberate hierarchy, coherent visual direction, avoiding a generic collection of cards | Novelty, decorative typography and animation are not goals; retain the system font and familiar native controls |
| Vercel `web-design-guidelines` | Reviewable implementation checks for semantics, focus, forms, motion and layout | A checklist is not an accessibility certificate or permission to change financial behavior |
| Existing `plan-ux-content` and `lease-ux-demo` preparation skills | Decision-first content order, consistent vocabulary, four locales and honest demo states | Apply to the current app, not to a retired prototype or hypothetical business policy |
| New `lease-accessible-ui` | A small, project-specific synthesis of the above and W3C/GOV.UK guidance | Agent-side instructions only; no AI feature, external installer or runtime dependency |

The new skill is at `.agents/skills/lease-accessible-ui/SKILL.md`. External skills
were inspected as reference material, not installed blindly or copied wholesale.

## Decisions implemented

**One visual family.** Keep stone surfaces, emerald accents, system typography and
the existing locale shell. Centralize only the colors and repeated presentation
patterns that this interface actually needs. No new component framework or font
service. Give the main payment one clear visual emphasis; use whitespace and
alignment instead of placing a separate border around every explanatory sentence.

**Payments before mechanics.** Show the dated first monthly gross payment, fixed net
amount, upfront payment, estimated total to use, optional end purchase and estimated
total with purchase. Keep the VAT schedule and forecast assumptions visible. Item
price, upfront net amount, financed amount and source/date remain available in the
main explanation. Only formulas, coefficient provenance and secondary net totals
are in a native disclosure.

**Comparison without horizontal travel.** Each option has the same labeled facts,
monthly amount and total costs. Options sit side by side on wide screens and stack
in a consistent reading order on narrow screens. No misleading recommended badge,
no invented savings and no compulsory sideways scrolling through a wide table.
Selecting another option edits the draft only; saving remains the separate primary
action. The selected option has a text label, not just a green border.

**Controls that remain recognizable.** Keep native sliders with precise text/select
alternatives. Use actual form submission, associated labels, descriptive errors and
normal keyboard behavior. Put invalid-input feedback with the controls, clear the
invalid estimate, and retain the entered value so the person can correct it.

**Comfortable access targets.** Standalone controls target at least 44 CSS pixels;
inputs and action buttons use 48. This is a project choice above WCAG 2.2 AA's
24-pixel minimum with its exceptions, not a claim that AA requires 44. Use a visible
three-pixel focus outline, sufficient foreground contrast, system dark mode, forced
colors and reduced-motion support. Avoid fixed action bars that cover focused text
or buttons at zoom. Keep translated labels and large amounts free to wrap.

**Same data, clearer presentation.** All monetary values still come from the existing
integer-cent domain models. The same four dictionaries and locale-aware formatters
are used. No schema migration, tax-rate edit, extra pricing endpoint or new financial
formula is part of this work.

## Code map

- `src/app/globals.css`: small shared presentation vocabulary, contrast pairs,
  responsive layouts, keyboard focus and system accessibility preferences.
- `src/components/spine/ui.tsx`: shared fields, buttons, panels and money facts.
- `src/components/spine/price-panel.tsx`: native form, precise controls and recovery.
- `src/components/spine/price-explanation.tsx`: essential payments versus calculations.
- `src/components/spine/price-tax-timeline.tsx`: explicit dated payment changes.
- `src/components/spine/price-comparison.tsx`: comparable, responsive term options.
- `src/components/asset-card.tsx`: catalogue continuity and readable item facts.
- `scripts/check-ui.mjs`: focused browser regression and automated accessibility checks.

## Verification and its limits

The existing repository CI is unchanged. The additional UI workflow runs the full
`npm run check:all` gate, then checks the production build in Chromium against an
isolated seeded database. Playwright and axe-core are installed into the runner's
temporary directory, not added to the product's dependencies or lockfile.

The browser checks cover four languages, light/dark schemes, 320- and 1280-pixel
viewports, horizontal overflow, automated WCAG-tagged findings, keyboard sliders and
disclosures, invalid input, comparison without a write, language-switch draft
persistence, the one-cent band crossing, large amounts, enlarged text, forced colors
and saving/reopening an offer. Screenshots and full audit reports are retained as
workflow artifacts. Test scenarios are not special cases in application code.

A 320-pixel viewport exercises reflow; changing the root font to 200% exercises text
enlargement. Neither is represented as a completed manual 400% browser-zoom test.
Axe findings and a green build do not prove complete WCAG conformance, screen-reader
usability or comprehension by real 17- or 70-year-old users. Manual assistive-technology
and user testing remain necessary. See the workflow run for actual results, rather
than treating this planned coverage as a passed verification record.

Changes in this branch were committed through the GitHub connector. Local Git hooks
are not executed by the contents API; no hook or CI check was disabled. Remote checks
are recorded separately from local execution. The editing environment could not
resolve GitHub directly, so no local application build is claimed.

## Sources

Reviewed as primary guidance, 5 November 2026:

- [Anthropic frontend-design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md).
- [Vercel web-design-guidelines skill](https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md) and [review rules](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md).
- [W3C: clear and understandable content](https://www.w3.org/WAI/WCAG2/supplemental/objectives/o3-clear-content/).
- [W3C: make important information easy to find](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o2p04-page-important/).
- [GOV.UK: details component](https://design-system.service.gov.uk/components/details/).
- [WCAG 2.2: contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), and [focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html).
- [Playwright: accessibility testing and its limitations](https://playwright.dev/docs/accessibility-testing).
