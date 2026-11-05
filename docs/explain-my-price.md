# Explain my price — Smart Problem 6

This feature extends the working Spine with a readable price breakdown and a comparison
of two lease terms. It uses the existing pricing and invoice rules; it does not add a
second calculator, an AI service or a new quotation API.

## Basis

- Working base: `spine` at `e05bad465f8c87bec4676647f3058688206bdb3f`.
- Preparation guidance: `arswift/lease-loop` at
  `0b6f0c5d01f08e5ea7523687843182c8990c8b21`, including the Explain My Price writing module.
- Authoritative requirements: [CHALLENGE](../CHALLENGE.md), [RULES](../RULES.md) and
  [the data pack](../data/DATA.md).
- Existing implementation choices: [Spine policies](spine-policies.md). These resolve
  the older preparation notes' open questions about upfront VAT, buyout and rounding.

## Information and behaviour

Show the monthly payment for a named invoice date, its net amount and VAT, then the
upfront payment and the full cost under two outcomes: return the item after using it,
or buy it at the end. The optional purchase must remain a separate, visible amount.

Explain the calculation as item price minus upfront payment equals amount financed;
amount financed times the supplied coefficient gives the rounded monthly net rent.
The financed amount is not another payment. The coefficient is not an interest rate.

Both comparison options use the same item, current price source, upfront amount, start
date and tax data. Changing a comparison or choosing a term only edits the draft.
Saving an offer remains a separate action and does not reserve or sign for the item.
Saved offers retain their original net terms when the current catalogue price changes.

All gross totals are estimates using scheduled invoice dates. The upfront forecast uses
the selected business date; the optional purchase forecast uses the term-end date.
Actual invoice issuance can change VAT. The supplied 2027 VAT change is fictional.
No fees, refundable deposits, guaranteed future taxes or market values are invented.

The UI must explain a financing-band change without promising that more upfront always
means lower rent. Invalid amounts, dates, unsupported terms and missing tax data need
specific recovery text and must not leave a valid-looking previous price on screen.

## Independent example for review

For `ebike-003`, list price 389000 cents, zero upfront, start and forecast upfront date
2026-11-05, using the supplied v1 price and coefficient table:

| Amount (cents)                                  | 24 months | 36 months |
| ----------------------------------------------- | --------: | --------: |
| Monthly rent before VAT                         |     13822 |     10730 |
| First monthly payment including VAT             |     17347 |     13466 |
| Monthly payment from January 2027 including VAT |     17416 |     13520 |
| Estimated total to use                          |    417846 |    486612 |
| Optional purchase before VAT                    |     97250 |     58350 |
| Estimated optional purchase including VAT       |    122535 |     73521 |
| Estimated total including purchase              |    540381 |    560133 |

The 36-month option has a smaller monthly payment and a higher total under either
outcome. These figures are test oracles, not fixture-selected application behaviour.

## Acceptance checks

Verify both terms against the example, a one-cent band crossing, dated VAT changes,
source/version changes, incomplete tax data and invalid input. Confirm that comparison
does not create a quote, contract, invoice or audit row. Save the chosen option through
the existing audited service and check that its terms match the displayed breakdown.

Check keyboard controls, narrow screens, light/dark colour schemes and all four locales.
Changing language must retain the selected terms. Run the existing full quality gate,
keep hooks enabled and record the actual local and remote results before delivery.
