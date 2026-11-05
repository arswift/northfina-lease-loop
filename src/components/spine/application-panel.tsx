import type { Answer, Answers } from '@/domain/question-flow';
import { normaliseAnswers } from '@/domain/question-flow';
import { answersForSubmission, moneyInputText } from './form-values';
import { ConsentAction } from './consent-action';
import { applicationConsentKey } from './consent-context';
import { getT } from '@/i18n/get-t';
import type { Locale } from '@/i18n/locales';
import type { ApplicationView, QuoteView } from '@/server/spine-views';
import type { Bootstrap } from './price-panel';
import { buttonClass, Field, inputClass, messageFor, MoneyFacts, panelClass } from './ui';

type Props = {
  data: Bootstrap;
  quote: QuoteView;
  application: ApplicationView | null;
  answers: Answers;
  locale: Locale;
  busy: boolean;
  onAnswers: (answers: Answers) => void;
  onSubmit: () => void;
  onSign: () => void;
};

export function ApplicationPanel(props: Props) {
  const { data, quote, application, answers, locale, busy } = props;
  const t = getT(locale);
  const context = {
    customer_type: data.customer.type,
    category: data.asset.category,
    financed_amount_cents: quote.terms.financedCents,
    term_months: quote.terms.termMonths,
  };
  const flow = normaliseAnswers(
    data.questions,
    context,
    answersForSubmission(data.questions, answers)
  );
  function change(id: string, value: Answer) {
    const next = { ...answers, [id]: value };
    const activeIds = new Set(
      normaliseAnswers(
        data.questions,
        context,
        answersForSubmission(data.questions, next)
      ).activeQuestions.map((question) => question.id)
    );
    // Preserve incomplete typing in visible fields, but remove hidden dependent answers.
    props.onAnswers(Object.fromEntries(Object.entries(next).filter(([key]) => activeIds.has(key))));
  }

  return (
    <section className={panelClass} aria-labelledby="application-heading">
      <h2
        id="application-heading"
        className="mb-4 border-b border-hairline pb-3 text-xl font-semibold text-navy dark:border-stone-800 dark:text-stone-100"
      >
        {t('spine.application')}
      </h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          props.onSubmit();
        }}
        noValidate
      >
        <fieldset disabled={busy} className="grid gap-4 md:grid-cols-2">
          {flow.activeQuestions.map((question) => {
            const id = question.id;
            const answer = answers[id];
            const invalid =
              application?.invalidQuestionIds.includes(id) ||
              application?.missingQuestionIds.includes(id);
            const shared = {
              id,
              className: inputClass,
              'aria-describedby': id + '-why',
              'aria-invalid': invalid || undefined,
            };
            return (
              <div
                key={id}
                className="rounded-lg border border-hairline bg-mist/40 p-4 dark:border-stone-800 dark:bg-stone-800/40"
              >
                <Field id={id} label={question.text[locale]}>
                  {question.type === 'choice' ? (
                    <select
                      {...shared}
                      value={typeof answer === 'string' ? answer : ''}
                      disabled={id === 'q_customer_type'}
                      onChange={(event) => change(id, event.target.value)}
                    >
                      <option value="">{t('spine.select')}</option>
                      {question.options?.map((option) => (
                        <option key={option} value={option}>
                          {messageFor(locale, 'spine.option.' + option)}
                        </option>
                      ))}
                    </select>
                  ) : question.type === 'list' ? (
                    <textarea
                      {...shared}
                      rows={3}
                      value={Array.isArray(answer) ? answer.join('\n') : ''}
                      onChange={(event) => change(id, event.target.value.split('\n'))}
                    />
                  ) : (
                    <input
                      {...shared}
                      type={
                        question.type === 'date'
                          ? 'date'
                          : question.type === 'email'
                            ? 'email'
                            : 'text'
                      }
                      inputMode={question.type === 'money' ? 'decimal' : undefined}
                      value={
                        question.type === 'money'
                          ? moneyInputText(answer)
                          : typeof answer === 'string'
                            ? answer
                            : ''
                      }
                      onChange={(event) => change(id, event.target.value)}
                    />
                  )}
                </Field>
                {question.type === 'list' ? (
                  <p className="mt-1.5 text-xs text-ink-muted dark:text-stone-400">
                    {t('spine.listHelp')}
                  </p>
                ) : null}
                {question.type === 'money' ? (
                  <p className="mt-1.5 text-xs text-ink-muted dark:text-stone-400">
                    {t('spine.moneyUnit')}
                  </p>
                ) : null}
                <p id={id + '-why'} className="mt-2 text-xs text-ink-muted dark:text-stone-300">
                  {messageFor(locale, 'spine.why.' + id)}
                </p>
                {invalid ? (
                  <p className="mt-1.5 text-xs font-semibold text-red-700 dark:text-red-300">
                    {t('spine.required')}
                  </p>
                ) : null}
              </div>
            );
          })}
        </fieldset>
        <button className={buttonClass + ' mt-6'} disabled={busy}>
          {busy ? t('spine.pending') : t('spine.submitApplication')}
        </button>
      </form>
      {application ? (
        <div
          className={`mt-6 rounded-lg border p-4 text-sm ${
            application.decision === 'approved'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100'
              : application.decision === 'manual_review'
                ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100'
                : 'border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/60 dark:text-red-100'
          }`}
          role="status"
        >
          <h3 className="font-semibold">{messageFor(locale, 'spine.' + application.decision)}</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {application.reasons.map((reason) => (
              <li key={reason}>{messageFor(locale, 'spine.reason.' + reason)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {application?.decision === 'approved' ? (
        <div className="mt-6 space-y-4 border-t border-hairline pt-6 dark:border-stone-800">
          <h3 className="text-lg font-semibold">{t('spine.review')}</h3>
          <p>{t('spine.reviewHelp')}</p>
          <p>
            {data.asset.make} {data.asset.model} · {quote.startDate} ·{' '}
            {t('spine.months', { count: quote.terms.termMonths })}
          </p>
          <MoneyFacts terms={quote.terms} locale={locale} />
          <p>{t('spine.endHelp')}</p>
          <ConsentAction
            key={applicationConsentKey({ locale, data, quote, application, answers })}
            label={t('spine.consent')}
            actionLabel={busy ? t('spine.pending') : t('spine.sign')}
            busy={busy}
            onConfirm={props.onSign}
          />
        </div>
      ) : null}
    </section>
  );
}
