import { beforeAll, describe, expect, it } from 'vitest';
import { loadCoefficientTable, loadCustomers, loadQuestions } from '@/data/load';
import type { CoefficientTable, Customer, Question } from '@/data/schemas';
import { evaluateEligibility } from './eligibility';
import { answersFromCustomer, type Answers } from './question-flow';

let table: CoefficientTable;
let questions: Question[];
let customers: Customer[];
beforeAll(async () => {
  const [coefficients, bank, personas] = await Promise.all([
    loadCoefficientTable(),
    loadQuestions(),
    loadCustomers(),
  ]);
  table = coefficients;
  questions = bank.questions;
  customers = personas;
});

function persona(id: string): Customer {
  const customer = customers.find((value) => value.id === id);
  if (!customer) throw new Error(`fixture ${id} is missing`);
  return customer;
}

function evaluate(
  customer: Customer,
  changes: Answers = {},
  financedCents = 389000,
  monthlyGrossCents = 13466,
  overrides: Partial<Parameters<typeof evaluateEligibility>[0]> = {}
) {
  return evaluateEligibility({
    customer,
    answers: { ...answersFromCustomer(customer), q_usage_purpose: 'commuting', ...changes },
    questions,
    category: 'e_bike',
    financedCents,
    termMonths: 36,
    monthlyGrossCents,
    startDate: '2026-11-05',
    table,
    ...overrides,
  });
}

describe('application decisions', () => {
  it('approves Aino using rules rather than her identifier', () => {
    const renamed = { ...persona('cust-aino'), id: 'a-new-id' };
    const result = evaluate(renamed);
    expect(result.status).toBe('approved');
    expect(result.reasons).toEqual([]);
    expect(result.answers.q_pep).toBeUndefined();
  });

  it('declines an underage applicant even if the form claims an older birth date', () => {
    const result = evaluate(persona('cust-mikko'), { q_birth_date: '1990-01-01' });
    expect(result.status).toBe('declined');
    expect(result.reasons).toEqual(expect.arrayContaining(['under_age', 'profile_conflict']));
  });

  it('uses start-date age and allows a birthday exactly at eighteen', () => {
    const aino = persona('cust-aino');
    if (aino.type !== 'consumer') throw new Error('consumer fixture required');
    expect(evaluate({ ...aino, birth_date: '2008-11-05' }).status).toBe('approved');
    expect(evaluate({ ...aino, birth_date: '2008-11-06' }).reasons).toContain('under_age');
  });

  it('applies affordability below the income-question threshold from profile evidence', () => {
    const aino = persona('cust-aino');
    if (aino.type !== 'consumer') throw new Error('consumer fixture required');
    const customer = { ...aino, monthly_net_income_cents: 100000 };
    expect(evaluate(customer, {}, 199999, 30000).status).toBe('approved');
    const rejected = evaluate(customer, {}, 199999, 30001);
    expect(rejected.status).toBe('declined');
    expect(rejected.reasons).toContain('unaffordable');
    expect(rejected.answers.q_monthly_income).toBeUndefined();
  });

  it('does not lower financial risk merely because an answer claims higher income', () => {
    const result = evaluate(persona('cust-sanna'), { q_monthly_income: 10000000 }, 549000, 27001);
    expect(result.status).toBe('declined');
    expect(result.reasons).toEqual(expect.arrayContaining(['unaffordable', 'profile_conflict']));
  });

  it('keeps a hidden positive PEP fact in manual review', () => {
    const aino = persona('cust-aino');
    const result = evaluate({ ...aino, is_pep: true }, { q_pep: 'no' });
    expect(result.status).toBe('manual_review');
    expect(result.reasons).toContain('pep');
  });

  it('requests signatory handoff and rejects the deliberately broken business ID', () => {
    const norvi = evaluate(persona('cust-norvi'), { q_signatory_email: 'signer@example.com' });
    expect(norvi.status).toBe('manual_review');
    expect(norvi.reasons).toContain('signatory_required');
    expect(evaluate(persona('cust-norvi'), { q_can_sign: 'yes' }).status).toBe('manual_review');
    const broken = evaluate(persona('cust-broken-id'));
    expect(broken.status).toBe('declined');
    expect(broken.reasons).toContain('invalid_business_id');
  });

  it('shows required big-ticket farm questions and ends in PEP review', () => {
    const customer = persona('cust-haapala');
    const result = evaluateEligibility({
      customer,
      answers: {
        ...answersFromCustomer(customer),
        q_farm_registry: 'SYNTHETIC-FARM-01',
        q_pep_details: 'A synthetic owner holds office',
      },
      questions,
      category: 'farm_machine',
      financedCents: 12500000,
      termMonths: 48,
      monthlyGrossCents: 341000,
      startDate: '2026-11-05',
      table,
    });
    expect(result.status).toBe('manual_review');
    expect(result.reasons).toEqual(['pep']);
    expect(result.answers).toHaveProperty('q_annual_revenue');
    expect(result.answers).toHaveProperty('q_beneficial_owners');
    expect(result.answers).not.toHaveProperty('q_usage_purpose');
  });

  it('returns incomplete for blank/malformed required fields rather than approving', () => {
    const result = evaluate(persona('cust-aino'), { q_email: 'bad', q_usage_purpose: '' });
    expect(result.status).toBe('incomplete');
    expect(result.reasons).toEqual(expect.arrayContaining(['answers_invalid', 'answers_missing']));
    expect(result.missingQuestionIds).toEqual(
      expect.arrayContaining(['q_email', 'q_usage_purpose'])
    );
  });

  it('declines unsupported residence/amount and preserves a disclosed adverse country', () => {
    expect(evaluate({ ...persona('cust-aino'), country: 'US' }).reasons).toContain('residency');
    expect(evaluate(persona('cust-aino'), { q_country: 'other' }).reasons).toContain('residency');
    expect(evaluate(persona('cust-aino'), {}, 29999).reasons).toContain('financed_limits');
  });

  it('does not approve a conflict that leaves all thresholds otherwise acceptable', () => {
    const result = evaluate(persona('cust-aino'), { q_country: 'SE' });
    expect(result.status).toBe('manual_review');
    expect(result.reasons).toContain('profile_conflict');
    expect(() => evaluate(persona('cust-aino'), {}, 389000, 0.1)).toThrow(RangeError);
  });
});

describe('decision priorities and evidence', () => {
  it('keeps all reasons when a decline takes priority over incomplete and review', () => {
    const result = evaluate(
      { ...persona('cust-mikko'), is_pep: true },
      { q_email: 'bad', q_country: 'SE' }
    );
    expect(result.status).toBe('declined');
    expect(result.reasons).toEqual([
      'under_age',
      'unaffordable',
      'pep',
      'profile_conflict',
      'answers_invalid',
      'answers_missing',
    ]);
    expect(result.invalidQuestionIds).toEqual(['q_email']);
    expect(result.missingQuestionIds).toEqual(['q_email']);
    expect(new Set(result.reasons).size).toBe(result.reasons.length);
  });

  it('keeps PEP evidence while an incomplete questionnaire takes priority', () => {
    const result = evaluate({ ...persona('cust-aino'), is_pep: true }, { q_email: 'bad' });
    expect(result.status).toBe('incomplete');
    expect(result.reasons).toEqual(['pep', 'answers_invalid', 'answers_missing']);
    expect(result.answers).not.toHaveProperty('q_email');
    expect(result.answers).not.toHaveProperty('q_pep');
  });

  it('distinguishes an absent answer from an invalid one', () => {
    const customer = persona('cust-aino');
    const { q_email: _email, ...answers } = answersFromCustomer(customer);
    const result = evaluate(customer, {}, 389000, 13466, {
      answers: { ...answers, q_usage_purpose: 'commuting' },
    });
    expect(result.status).toBe('incomplete');
    expect(result.reasons).toEqual(['answers_missing']);
    expect(result.missingQuestionIds).toEqual(['q_email']);
    expect(result.invalidQuestionIds).toEqual([]);
  });

  it.each([
    { profilePep: false, answer: 'yes' },
    { profilePep: true, answer: 'no' },
  ])(
    'retains positive PEP evidence with profile=$profilePep and answer=$answer',
    ({ profilePep, answer }) => {
      const result = evaluate(
        { ...persona('cust-aino'), is_pep: profilePep },
        { q_pep: answer, q_pep_details: 'Synthetic public office' },
        1000000
      );
      expect(result.status).toBe('manual_review');
      expect(result.reasons).toEqual(['pep', 'profile_conflict']);
    }
  );

  it('honors a disclosed lack of signing authority even when the profile permits signing', () => {
    const result = evaluate(persona('cust-kettukoodi'), {
      q_can_sign: 'no',
      q_signatory_email: 'signer@example.com',
    });
    expect(result.status).toBe('manual_review');
    expect(result.reasons).toEqual(['signatory_required', 'profile_conflict']);
  });

  it('keeps conflicting owner lists for review without mutating the profile or answers', () => {
    const company = persona('cust-kettukoodi');
    if (company.type !== 'company') throw new Error('company fixture required');
    const customer = { ...company, beneficial_owners: ['Owner A'] };
    const answers = {
      ...answersFromCustomer(customer),
      q_usage_purpose: 'commuting',
      q_beneficial_owners: [' Owner B '],
    };
    Object.freeze(customer.beneficial_owners);
    Object.freeze(customer);
    Object.freeze(answers.q_beneficial_owners);
    Object.freeze(answers);
    const result = evaluate(customer, {}, 5000000, 13466, { answers });
    expect(result.status).toBe('manual_review');
    expect(result.reasons).toEqual(['profile_conflict']);
    expect(result.answers.q_beneficial_owners).toEqual(['Owner B']);
    expect(customer.beneficial_owners).toEqual(['Owner A']);
    expect(answers.q_beneficial_owners).toEqual([' Owner B ']);
    expect(evaluate(customer, {}, 5000000, 13466, { answers })).toEqual(result);
  });
});

describe('age, residence and business ID rules', () => {
  it('blocks a disclosed young age even when the profile is an adult', () => {
    const result = evaluate(persona('cust-aino'), { q_birth_date: '2009-01-01' });
    expect(result.status).toBe('declined');
    expect(result.reasons).toEqual(['under_age', 'profile_conflict']);
  });

  it('checks a sole trader age independently of a claimed company type', () => {
    const trader = persona('cust-pekka');
    if (trader.type !== 'sole_trader') throw new Error('sole trader fixture required');
    const result = evaluate(
      { ...trader, birth_date: '2009-01-01' },
      { q_customer_type: 'company' }
    );
    expect(result.status).toBe('declined');
    expect(result.reasons).toEqual(['under_age', 'profile_conflict']);
  });

  it.each([
    { startDate: '2026-02-28', status: 'declined' },
    { startDate: '2026-03-01', status: 'approved' },
  ])('uses the leap-day birthday policy on $startDate', ({ startDate, status }) => {
    const aino = persona('cust-aino');
    if (aino.type !== 'consumer') throw new Error('consumer fixture required');
    const result = evaluate({ ...aino, birth_date: '2008-02-29' }, {}, 389000, 13466, {
      startDate,
    });
    expect(result.status).toBe(status);
    expect(result.reasons).toEqual(status === 'declined' ? ['under_age'] : []);
  });

  it.each(['FI', 'SE', 'EE'])('accepts the supported country %s', (country) => {
    expect(evaluate({ ...persona('cust-aino'), country }).status).toBe('approved');
  });

  it('checks company residence even when its country answer is hidden', () => {
    const result = evaluate({ ...persona('cust-kettukoodi'), country: 'US' }, { q_country: 'FI' });
    expect(result.status).toBe('declined');
    expect(result.reasons).toEqual(['residency']);
    expect(result.answers).not.toHaveProperty('q_country');
  });

  it.each(['cust-pekka', 'cust-kettukoodi'])('checks both business ID sources for %s', (id) => {
    const customer = persona(id);
    if (customer.type === 'consumer') throw new Error('business fixture required');
    expect(evaluate(customer).status).toBe('approved');
    const badAnswer = evaluate(customer, { q_business_id: '1234567-8' });
    expect(badAnswer.status).toBe('declined');
    expect(badAnswer.reasons).toEqual(['invalid_business_id', 'profile_conflict']);
    const badProfile = evaluate(
      { ...customer, business_id: '1234567-8' },
      { q_business_id: customer.business_id }
    );
    expect(badProfile.status).toBe('declined');
    expect(badProfile.reasons).toEqual(['invalid_business_id', 'profile_conflict']);
  });
});

describe('affordability and financing boundaries', () => {
  it('uses a lower declared income and includes VAT in the supplied monthly amount', () => {
    const result = evaluate(persona('cust-aino'), { q_monthly_income: 40000 });
    expect(result.status).toBe('declined');
    expect(result.reasons).toEqual(['unaffordable', 'profile_conflict']);
  });

  it.each([
    { gross: 0, status: 'approved' },
    { gross: 1, status: 'declined' },
  ])('handles zero income with monthly gross $gross', ({ gross, status }) => {
    const aino = persona('cust-aino');
    if (aino.type !== 'consumer') throw new Error('consumer fixture required');
    const result = evaluate({ ...aino, monthly_net_income_cents: 0 }, {}, 199999, gross);
    expect(result.status).toBe(status);
    expect(result.reasons).toEqual(gross === 0 ? [] : ['unaffordable']);
  });

  it('keeps the exact 30 percent boundary when intermediate products exceed safe integers', () => {
    const aino = persona('cust-aino');
    if (aino.type !== 'consumer') throw new Error('consumer fixture required');
    const customer = { ...aino, monthly_net_income_cents: 9007199254740990 };
    expect(evaluate(customer, {}, 199999, 2702159776422297).status).toBe('approved');
    expect(evaluate(customer, {}, 199999, 2702159776422298).reasons).toEqual(['unaffordable']);
  });

  it.each([
    { financed: 29999, status: 'declined' },
    { financed: 30000, status: 'approved' },
    { financed: 25000000, status: 'approved' },
    { financed: 25000001, status: 'declined' },
  ])('checks the financed amount boundary at $financed cents', ({ financed, status }) => {
    const result = evaluate(persona('cust-aino'), {}, financed);
    expect(result.status).toBe(status);
    expect(result.reasons).toEqual(status === 'declined' ? ['financed_limits'] : []);
  });

  it.each([0, 18, 36.5])('declines an unsupported term of %s months', (termMonths) => {
    const result = evaluate(persona('cust-aino'), {}, 389000, 13466, { termMonths });
    expect(result.status).toBe('declined');
    expect(result.reasons).toEqual(['financed_limits']);
  });

  it.each([-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid monthly gross cents: %s',
    (gross) => {
      expect(() => evaluate(persona('cust-aino'), {}, 389000, gross)).toThrow(RangeError);
    }
  );
});

describe('question-specific blocking rules', () => {
  it.each([
    { answer: 'delivery', active: true, status: 'declined', reasons: ['blocked_answer'] },
    { answer: 'commuting', active: true, status: 'approved', reasons: [] },
    {
      answer: '',
      active: true,
      status: 'incomplete',
      reasons: ['answers_invalid', 'answers_missing'],
    },
    { answer: 'delivery', active: false, status: 'approved', reasons: [] },
  ])('evaluates active=$active usage answer "$answer"', ({ answer, active, status, reasons }) => {
    const bank: Question[] = questions.map((question) =>
      question.id === 'q_usage_purpose'
        ? {
            ...question,
            ask_when: active ? [] : [{ field: 'category', op: 'in', value: ['farm_machine'] }],
            blocks_application_when: [{ rule: 'answer_in', value: ['delivery'] }],
          }
        : question
    );
    const result = evaluate(persona('cust-aino'), { q_usage_purpose: answer }, 389000, 13466, {
      questions: bank,
    });
    expect(result.status).toBe(status);
    expect(result.reasons).toEqual(reasons);
  });
});
