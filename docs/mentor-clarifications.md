# Organiser clarifications reviewed on 6 November 2026

This review covers the implementation on `main` at
`3490b61b471738ae0135d9bfd88f0bf64c3d07a0`. It does not assess unmerged feature branches.
Written organiser clarifications take precedence over older preparation notes.

## Source and scope

- The team supplied the FAQ and two organiser replies from the hackathon Discord.
  The FAQ repeats the existing rules: AI may assist development but is not part of the
  product; retain TypeScript, hooks and CI; never bypass hooks; the open submission PR's
  latest commit at 16:00 Helsinki on 6 November is the judged revision.
- [Upstream correction to scenario card 6](https://github.com/etufillari/northfina-lease-loop/commit/56e7ee54215ce4526e349c1ca3d1429c9bc6d496)
  changes four copies of `ebike-004` to one unique item. No catalogue data changed.
- [The earlier correction to card 4](https://github.com/etufillari/northfina-lease-loop/commit/33ab594a94e6622840992ae2fbfb82f851509cfa)
  already made the lease 36 months. February 2028 is within that term. This correction
  is already present in this implementation and no longer needs a mentor question.

**Scenario card 6 is the company-signature scenario. Smart Problem 6 is Explain My Price.**
They are different lists.

## Card 6: one item, awaiting the authorised signer

The corrected scenario is Norvi Logistics (`cust-norvi`) applying for one `ebike-004`.
When the applicant cannot sign, collect `q_signatory_email`, keep the agreement unsigned
and the lease inactive, and explain whose action is needed next. Quantity support and
fleet contracts are optional Wildcard scope.

The existing question engine already requires that email. The saved application retains
it, and `signContract` refuses any application that is not approved. Submitting an email
is not a signature. Changing the applicant's answer or using the demo operator flag
does not grant signing authority.

The correction makes this saved state explicit in all four languages: the named signer,
the unsigned/inactive state and the next action. Other review reasons remain visible.
There is no `Contract` row until an approved application is signed; the pending state
is represented by the saved application and quote. It survives the existing same-tab
draft restore and server reload. It creates no invoice or active asset allocation.

This demo does not send email or complete a delegated signature. Its interface says so.
Ask the mentor whether card 6 must also demonstrate completion by a separate simulated
signer. That answer determines the next scope; it must not be simulated by silently
approving the original applicant.

## Imported used items: the approved valuation assumptions

For an item whose earlier lease records are absent, the organiser permits this baseline:

1. Original net list price: that item's entry in **price list version 1**.
2. Assumed first-lease date: **1 January of its `model_year`**.
3. Age: elapsed months from that date to the explicit valuation date.
4. Apply the residual age curve, condition multiplier and capped usage adjustment from
   `data/residual-curves.json`. Label another chosen assumption and explain it.

On **6 November 2026**, the organiser's `ebike-007` example is:

| Input                          | Value                                                        |
| ------------------------------ | ------------------------------------------------------------ |
| Original net price, v1         | 549000 cents                                                 |
| Assumed first lease            | 2023-01-01                                                   |
| Age                            | 46 months                                                    |
| Linear age factor              | 32.5% between month 36 (40%) and month 48 (31%)              |
| Current condition              | `fair`, factor 0.65                                          |
| Usage                          | 18400 km; 18 complete 1000-km steps; reduction capped at 20% |
| Estimated current market value | **92781 cents (€927.81 net)**                                |

Independent arithmetic: `549000 × 0.325 × 0.65 × 0.80 = 92781` cents.
Do not replace the original price with today's v2 catalogue price. This is the current
**fair-condition** estimate, not a promised selling price or the value after refurbishment.

The implementation on the reviewed `main` deliberately uses an operator-entered net
valuation and a required explanation. It saves them when the required preparation work
is confirmed. It does not claim to compute residual values automatically or optimise
waiting-list matches. The new clarification supplies an approved reference for that
manual valuation; it does not require a new matching feature for the minimum Spine.

## Real subsequent leases already retain their evidence

Each new signed lease stores its actual `signed_on`, `start_date` and immutable
`terms_json`, including `listPriceCents`, term, down payment and monthly net rent. Its
quote retains the price source. Returning and relisting create a distinct next lease
without overwriting previous contracts. Imported previous-life counts are not fabricated
as historic contracts.

Keep two concepts distinct: the original baseline for a residual curve and the actual
price/date of each later life. A lower re-lease price must not silently become a new
first-lease baseline with age reset to zero.

The public passport shows life dates/status and unknown historical counts. It intentionally
omits private contract prices and customer details; the saved contract keeps the actual
financial history for its customer. The organiser's history clarification does not require
making previous customers' financial data public.

## Focused verification

- `src/server/spine-signatory.test.ts`: real migrated SQLite and HTTP handlers cover the
  named pending signer, required/invalid email, retry safety, private access, reload,
  attempts to claim authority and absence of contracts, invoices and allocations.
- The same regression checks all four locale messages and preservation of other review
  reasons. The displayed recipient comes from saved data, not an unsaved form edit.
- Existing `spine-lifecycle.test.ts` covers multiple distinct leases, preserved terms,
  retained service evidence and privacy of the public passport.
- Existing `spine-persistence.test.ts` covers immutable accepted prices across the v1/v2
  change, idempotent signing and stored invoice history.
- Run `npm run check:all`, the enabled hooks, and commitlint across the actual PR range.
  Check remote CI at the published head; earlier branch checks are not proof of this change.

For a manual check, open `/en/lease/ebike-004`, select Norvi and 2026-11-06, save an offer,
leave signing authority as "no", enter a synthetic signer's email and submit. The page
must name that saved recipient and explain that the lease is inactive, with no sign button.
Reload the same tab and repeat in FI/SV/ET. A separate browser run is not implied by the
database, HTTP-handler or static-render regressions.
