import { useState } from 'react';
import type { AssetCondition } from '@/data/schemas';
import { refurbishmentPlan } from '@/domain/lifecycle';
import { parseCents } from '@/domain/money-arithmetic';
import { formatEuro } from '@/domain/money';
import { getT } from '@/i18n/get-t';
import { intlLocale, type Locale } from '@/i18n/locales';
import type { Bootstrap } from './price-panel';
import { buttonClass, Field, inputClass, messageFor, panelClass } from './ui';

export type RelistForm = {
  netPriceCents: number;
  valuationReason: string;
  condition: AssetCondition;
  completedTaskIds: string[];
  lastServiceUsage?: number;
  releaseRevision: number;
};

export function RelistPanel({
  data,
  locale,
  busy,
  onRelist,
}: {
  data: Bootstrap;
  locale: Locale;
  busy: boolean;
  onRelist: (input: RelistForm) => void;
}) {
  const t = getT(locale);
  const [price, setPrice] = useState('');
  const [reason, setReason] = useState('');
  const [condition, setCondition] = useState<AssetCondition>('good');
  const [service, setService] = useState('');
  const [completed, setCompleted] = useState<string[]>([]);
  const lastServiceUsage = service === '' ? undefined : Number(service);
  const plan = refurbishmentPlan({
    asset: data.asset,
    targetCondition: condition,
    costs: data.refurbishmentCosts,
    lastServiceUsage,
    maintenance: data.maintenance,
  });
  const money = parseCents(price);
  return (
    <section className={panelClass} aria-labelledby="relist-heading">
      <h2 id="relist-heading" className="text-xl font-semibold">
        {t('spine.relist')}
      </h2>
      <p className="mt-3 font-medium">{t('spine.operator')}</p>
      <p className="mt-2 text-sm">{t('spine.operatorHelp')}</p>
      <fieldset disabled={busy} className="mt-5 space-y-4">
        <Field id="relist-price" label={t('spine.newPrice')}>
          <input
            id="relist-price"
            className={inputClass}
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </Field>
        <Field id="relist-reason" label={t('spine.valuationReason')}>
          <textarea
            id="relist-reason"
            className={inputClass}
            minLength={10}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <Field id="relist-condition" label={t('spine.targetCondition')}>
          <select
            id="relist-condition"
            className={inputClass}
            value={condition}
            onChange={(event) => {
              setCondition(event.target.value as AssetCondition);
              setCompleted([]);
            }}
          >
            {(['good', 'like_new'] as const).map((value) => (
              <option key={value} value={value}>
                {messageFor(locale, 'condition.' + value)}
              </option>
            ))}
          </select>
        </Field>
        {data.asset.category === 'farm_machine' ? (
          <Field id="service-reading" label={t('spine.lastService')}>
            <input
              id="service-reading"
              type="number"
              min={0}
              max={data.asset.usage.value}
              step={1}
              className={inputClass}
              value={service}
              onChange={(event) => {
                setService(event.target.value);
                setCompleted([]);
              }}
            />
          </Field>
        ) : null}
        {plan.ok ? (
          <div className="rounded-lg border border-hairline bg-mist/45 p-4 dark:border-stone-800 dark:bg-stone-800/40">
            <p className="text-sm font-semibold text-navy dark:text-stone-100">
              {t('spine.workDone')}
            </p>
            <div className="mt-2 space-y-2">
              {plan.tasks.map((task) => (
                <label
                  key={task.id}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-hairline bg-card px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
                >
                  <span className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      className="accent-ocean"
                      checked={completed.includes(task.id)}
                      onChange={(event) =>
                        setCompleted(
                          event.target.checked
                            ? [...completed, task.id]
                            : completed.filter((id) => id !== task.id)
                        )
                      }
                    />
                    <span>{messageFor(locale, 'spine.task.' + task.id)}</span>
                  </span>
                  <span className="font-semibold text-navy tabular-nums dark:text-stone-100">
                    {formatEuro(task.netCostCents, intlLocale[locale])}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <p role="status">{messageFor(locale, 'spine.reason.' + plan.reason)}</p>
        )}
        <button
          className={buttonClass}
          disabled={
            !money.ok ||
            reason.trim().length < 10 ||
            !plan.ok ||
            (plan.ok && plan.tasks.some((task) => !completed.includes(task.id)))
          }
          onClick={() => {
            if (money.ok)
              onRelist({
                netPriceCents: money.cents,
                valuationReason: reason,
                condition,
                completedTaskIds: completed,
                releaseRevision: data.releaseRevision,
                ...(lastServiceUsage === undefined ? {} : { lastServiceUsage }),
              });
          }}
        >
          {t('spine.publish')}
        </button>
      </fieldset>
    </section>
  );
}
