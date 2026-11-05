import type { AssetCondition } from '@/data/schemas';
import type { EndChoice } from '@/domain/lifecycle';
import type { ContractView } from '@/server/spine-views';
import { getT } from '@/i18n/get-t';
import type { Locale } from '@/i18n/locales';
import type { Bootstrap } from './price-panel';
import { ConsentAction } from './consent-action';
import { endConsentKey } from './consent-context';
import { endDraftSchema } from './end-draft';
import { wholeInput } from './form-values';
import { useDraft } from './use-draft';
import { buttonClass, Field, inputClass, messageFor, panelClass } from './ui';

export type EndForm = {
  choice: EndChoice;
  condition: AssetCondition;
  usageValue: number;
  nextCustomerId?: string;
};

export function EndPanel({
  contract,
  data,
  locale,
  busy,
  onDate,
  onEnd,
}: {
  contract: ContractView;
  data: Bootstrap;
  locale: Locale;
  busy: boolean;
  onDate: (date: string) => void;
  onEnd: (input: EndForm) => void;
}) {
  const t = getT(locale);
  const [draft, saveDraft, volatile] = useDraft(
    `lease-loop:end:${data.customer.id}:${contract.id}`,
    {
      choice: 'return' as EndChoice,
      condition: data.asset.condition,
      usageText: String(data.asset.usage.value),
      successorId: '',
    },
    endDraftSchema
  );
  const { choice, condition, usageText, successorId } = draft;
  const usageValue = wholeInput(usageText, data.asset.usage.value);
  const invalid = usageValue === null || (choice === 'pass_on' && !successorId);
  if (contract.status !== 'active') return <p className={panelClass}>{t('spine.closed')}</p>;
  return (
    <section className={panelClass} aria-labelledby="end-heading">
      <h2 id="end-heading" className="text-xl font-semibold">
        {t('spine.end')}
      </h2>
      <p className="mt-3">{t('spine.endHelp')}</p>
      {volatile ? (
        <p role="status" className="mt-3">
          {t('spine.storageWarning')}
        </p>
      ) : null}
      <button
        type="button"
        className={buttonClass + ' mt-4'}
        disabled={busy}
        onClick={() => onDate(contract.endDate)}
      >
        {t('spine.maturity')}
      </button>
      <fieldset disabled={busy} className="mt-5 space-y-4">
        <legend className="sr-only">{t('spine.end')}</legend>
        <div className="flex flex-wrap gap-4">
          {(['buy', 'return', 'pass_on'] as const).map((value) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="radio"
                name="end-choice"
                value={value}
                checked={choice === value}
                onChange={() => saveDraft({ ...draft, choice: value })}
              />
              {messageFor(locale, 'spine.' + value)}
            </label>
          ))}
        </div>
        <Field id="return-condition" label={t('spine.condition')}>
          <select
            id="return-condition"
            className={inputClass}
            value={condition}
            onChange={(event) =>
              saveDraft({ ...draft, condition: event.target.value as AssetCondition })
            }
          >
            {(['new', 'like_new', 'good', 'fair', 'poor'] as const).map((value) => (
              <option key={value} value={value}>
                {messageFor(locale, 'condition.' + value)}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="return-usage"
          label={
            t('spine.usage') +
            ' (' +
            messageFor(locale, 'spine.unit.' + data.asset.usage.unit) +
            ')'
          }
        >
          <input
            id="return-usage"
            className={inputClass}
            type="number"
            min={data.asset.usage.value}
            max={2_147_483_647}
            step={1}
            value={usageText}
            aria-invalid={usageValue === null || undefined}
            aria-describedby={usageValue === null ? 'return-usage-error' : undefined}
            onChange={(event) => saveDraft({ ...draft, usageText: event.target.value })}
          />
          {usageValue === null ? (
            <p id="return-usage-error" className="mt-2 text-sm">
              {t('spine.invalidUsage', { minimum: data.asset.usage.value })}
            </p>
          ) : null}
        </Field>
        {choice === 'pass_on' ? (
          <Field id="next-customer" label={t('spine.nextCustomer')}>
            <select
              id="next-customer"
              className={inputClass}
              value={successorId}
              onChange={(event) => saveDraft({ ...draft, successorId: event.target.value })}
            >
              <option value="">{t('spine.select')}</option>
              {data.customers
                .filter((customer) => customer.id !== data.customer.id)
                .map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
            </select>
          </Field>
        ) : null}
        <ConsentAction
          key={endConsentKey({
            locale,
            contract,
            data,
            choice,
            condition,
            usageText,
            successorId,
          })}
          label={t('spine.endConsent')}
          actionLabel={busy ? t('spine.pending') : t('spine.confirmEnd')}
          busy={busy}
          disabled={invalid}
          onConfirm={() => {
            if (usageValue === null || (choice === 'pass_on' && !successorId)) return;
            onEnd({
              choice,
              condition,
              usageValue,
              ...(choice === 'pass_on' ? { nextCustomerId: successorId } : {}),
            });
          }}
        />
      </fieldset>
    </section>
  );
}
