import type { CoefficientTable } from '@/data/schemas';
import { isIsoDate } from './calendar';
import { calculatePrice, type PriceFailure } from './pricing';
import {
  explainPrice,
  type PriceExplanationInput,
  type PriceExplanationResult,
} from './price-explanation';

export type PriceComparisonInput = Omit<PriceExplanationInput, 'terms'> & {
  listPriceCents: number;
  downPaymentCents: number;
  termMonths: readonly number[];
  table: CoefficientTable;
};

export type PriceOption = { termMonths: number } & (
  PriceExplanationResult | { ok: false; reason: PriceFailure | 'table_not_yet_valid' }
);

/** Live options share the current offer price, advance and dates; no offer is saved here. */
export function comparePriceOptions(input: PriceComparisonInput): PriceOption[] {
  const { listPriceCents, downPaymentCents, table, startDate, upfrontDate, vatRates } = input;
  return input.termMonths.map((termMonths): PriceOption => {
    // In the live preview, the advance date is the current business/quote date.
    if (!isIsoDate(upfrontDate) || startDate < upfrontDate) {
      return { termMonths, ok: false, reason: 'invalid_date' };
    }
    if (upfrontDate < table.valid_from) {
      return { termMonths, ok: false, reason: 'table_not_yet_valid' };
    }
    const priced = calculatePrice({ listPriceCents, downPaymentCents, termMonths, table });
    if (!priced.ok) return { termMonths, ...priced };
    return {
      termMonths,
      ...explainPrice({ terms: priced.terms, startDate, upfrontDate, vatRates }),
    };
  });
}
