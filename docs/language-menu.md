# Language menu

The language control is a compact globe/current-code disclosure. Opening it shows
English, Suomi, Svenska and Eesti with decorative flags and a checked current
language. Names and `aria-current` communicate the choice without relying on flags
or colour. Native `details`/`summary` keeps links reachable without JavaScript.
This follows the [WAI disclosure navigation pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/),
not an application-style ARIA menu with a special Tab model.

Enter/Space toggles the disclosure; Tab follows the normal link order. Arrow keys
and Home/End are optional shortcuts. Escape closes it and returns focus to the
trigger. Clicking outside, leaving with the keyboard or choosing a language closes
it. Opening Appearance closes Language and vice versa. Transient null focus
transfers do not close either control; the `7034ac4` appearance fix is retained.

The links preserve the current route, and JavaScript also retains query parameters
and the fragment when opening the menu. Existing appearance preferences and lease
drafts are not replaced. No new dictionary keys, dependencies or financial writes
are introduced. Menu surfaces, selection and focus derive from the current theme;
Northfina has a white outlined trigger on its blue header. Both modes and styles
use native language names rather than country flags as accessible labels.

`language-switcher.css` is scoped to the new control. `check-language-menu.mjs`
checks open menus in both designs, both explicit colour modes, four locales and
320/1280px widths; it also exercises keyboard dismissal, the other header panel,
200% text enlargement, forced colours, route/query/fragment retention, saved
drafts and navigation without JavaScript. Existing UI and appearance regressions
still run, with their language transitions opening the menu first. Actual pass
results belong to the matching CI artifact, not this description of test coverage.
