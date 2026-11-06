import type { AssetCategory, CoefficientTable, Customer, Question } from '@/data/schemas';
import { isFinnishBusinessId } from './business-id';
import { ageOn } from './calendar';
import { monthlyFactorFor } from './coefficient';
import { answersFromCustomer, normaliseAnswers, type Answers } from './question-flow';

export type EligibilityReason =
  | 'under_age'
  | 'residency'
  | 'unaffordable'
  | 'invalid_business_id'
  | 'pep'
  | 'signatory_required'
  | 'profile_conflict'
  | 'answers_missing'
  | 'answers_invalid'
  | 'financed_limits'
  | 'blocked_answer';

export type EligibilityDecision = {
  status: 'approved' | 'declined' | 'manual_review' | 'incomplete';
  reasons: EligibilityReason[];
  /** Question ids whose answers differ from the customer's stored profile, asked first. */
  conflictQuestionIds: string[];
  answers: Answers;
  missingQuestionIds: string[];
  invalidQuestionIds: string[];
};

type EligibilityInput = {
  customer: Customer;
  answers: Answers;
  questions: readonly Question[];
  category: AssetCategory;
  financedCents: number;
  termMonths: number;
  monthlyGrossCents: number;
  startDate: string;
  table: CoefficientTable;
};

/** Implements the six named eligibility rules from the supplied synthetic question bank. */
export function evaluateEligibility(input: EligibilityInput): EligibilityDecision {
  const { customer, questions, financedCents, termMonths, monthlyGrossCents, startDate, table } =
    input;
  if (!Number.isSafeInteger(monthlyGrossCents) || monthlyGrossCents < 0) {
    throw new RangeError('monthly gross must be non-negative safe integer cents');
  }
  const flow = normaliseAnswers(
    questions,
    {
      customer_type: customer.type,
      category: input.category,
      financed_amount_cents: financedCents,
      term_months: termMonths,
    },
    input.answers
  );
  const declined = new Set<EligibilityReason>();
  const review = new Set<EligibilityReason>();

  // The server's synthetic profile remains evidence even when a question is not asked.
  if (customer.type !== 'company' && ageOn(customer.birth_date, startDate) < 18)
    declined.add('under_age');
  if (!['FI', 'SE', 'EE'].includes(customer.country)) declined.add('residency');
  if (!monthlyFactorFor(table, financedCents, termMonths).ok) declined.add('financed_limits');
  if (customer.is_pep || flow.answers.q_pep === 'yes') review.add('pep');

  if (customer.type === 'consumer') {
    const statedIncome = flow.answers.q_monthly_income;
    const income =
      typeof statedIncome === 'number'
        ? Math.min(customer.monthly_net_income_cents, statedIncome)
        : customer.monthly_net_income_cents;
    // Compare integer products: dividing income into floats could shift the 30% boundary.
    if (BigInt(monthlyGrossCents) * 100n > BigInt(income) * 30n) declined.add('unaffordable');
  } else {
    const statedId = flow.answers.q_business_id;
    if (
      !isFinnishBusinessId(customer.business_id) ||
      (typeof statedId === 'string' && !isFinnishBusinessId(statedId))
    ) {
      declined.add('invalid_business_id');
    }
  }
  if (
    customer.type === 'company' &&
    (!customer.applicant_can_sign || flow.answers.q_can_sign === 'no')
  ) {
    review.add('signatory_required');
  }

  // A changed form answer is a request to resolve evidence, not authority to overwrite it.
  // The conflicting ids let the UI name the exact questions that need human resolution.
  const profileAnswers = answersFromCustomer(customer);
  const conflicts = new Set<string>();
  for (const [id, answer] of Object.entries(flow.answers)) {
    const profileAnswer = profileAnswers[id];
    if (profileAnswer !== undefined && JSON.stringify(answer) !== JSON.stringify(profileAnswer)) {
      conflicts.add(id);
    }
  }
  if (conflicts.size) review.add('profile_conflict');
  const askedIds = new Set(flow.activeQuestions.map((question) => question.id));
  const conflictQuestionIds = [
    ...flow.activeQuestions.filter((question) => conflicts.has(question.id)).map((q) => q.id),
    ...[...conflicts].filter((id) => !askedIds.has(id)),
  ];

  for (const question of flow.activeQuestions) {
    const answer = flow.answers[question.id];
    for (const rule of question.blocks_application_when ?? []) {
      if (
        rule.rule === 'age_under' &&
        typeof answer === 'string' &&
        ageOn(answer, startDate) < rule.value
      ) {
        declined.add('under_age');
      }
      if (rule.rule === 'answer_in' && typeof answer === 'string' && rule.value.includes(answer)) {
        declined.add(question.id === 'q_country' ? 'residency' : 'blocked_answer');
      }
    }
  }

  const incomplete = flow.missingIds.length > 0 || flow.invalidIds.length > 0;
  const status =
    declined.size > 0
      ? 'declined'
      : incomplete
        ? 'incomplete'
        : review.size > 0
          ? 'manual_review'
          : 'approved';
  const reasons: EligibilityReason[] = [...declined, ...review];
  if (flow.invalidIds.length > 0) reasons.push('answers_invalid');
  if (flow.missingIds.length > 0) reasons.push('answers_missing');
  return {
    status,
    reasons,
    conflictQuestionIds,
    answers: flow.answers,
    missingQuestionIds: flow.missingIds,
    invalidQuestionIds: flow.invalidIds,
  };
}
