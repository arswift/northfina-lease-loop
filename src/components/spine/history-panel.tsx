import { auditPageSchema, passportSchema } from '@/data/spine-response-schemas';
import { useEffect, useState } from 'react';
import type { getPassport, getScopedAudit } from '@/server/spine-history';
import { getT } from '@/i18n/get-t';
import { formatNumber } from '@/i18n/format';
import { intlLocale, type Locale } from '@/i18n/locales';
import { requestJson, type DemoSelection } from './api';
import { buttonClass, messageFor, panelClass } from './ui';

type Passport = Awaited<ReturnType<typeof getPassport>>;
type AuditPage = Awaited<ReturnType<typeof getScopedAudit>>;

const AUDIT_PAGE_SIZE = 10;

export function HistoryPanel({
  assetId,
  selection,
  locale,
  revision,
}: {
  assetId: string;
  selection: DemoSelection;
  locale: Locale;
  revision: number;
}) {
  const t = getT(locale);
  const { customerId, businessDate } = selection;
  const key = assetId + '|' + customerId + '|' + businessDate;
  const [loaded, setLoaded] = useState<{
    key: string;
    passport: Passport;
    firstPage: AuditPage;
  } | null>(null);
  const [auditPages, setAuditPages] = useState<AuditPage['rows']>([]);
  const [auditCursor, setAuditCursor] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFailed, setAuditFailed] = useState(false);
  const [failedKey, setFailedKey] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      requestJson(
        'assets/' + encodeURIComponent(assetId) + '/passport',
        selection,
        passportSchema,
        undefined,
        false,
        controller.signal
      ),
      requestJson('audit', selection, auditPageSchema, undefined, false, controller.signal),
    ])
      .then(([passport, firstPage]) => {
        if (controller.signal.aborted) return;
        setLoaded({ key, passport, firstPage });
        setAuditPages(firstPage.rows);
        setAuditCursor(firstPage.cursor);
        setAuditFailed(false);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setFailedKey(assetId + '|' + customerId + '|' + businessDate);
      });
    return () => controller.abort();
    // The audit page fetch deliberately tracks selection fields, not the object identity.
  }, [assetId, customerId, businessDate, revision, key, selection]);

  async function loadMoreAudit() {
    if (!auditCursor || auditLoading) return;
    setAuditLoading(true);
    try {
      const nextPage = await requestJson(
        'audit?cursor=' + encodeURIComponent(auditCursor),
        selection,
        auditPageSchema
      );
      // Rows arrive newest first; append only ids that are not already rendered.
      const known = new Set(auditPages.map((row) => row.id));
      setAuditPages([...auditPages, ...nextPage.rows.filter((row) => !known.has(row.id))]);
      setAuditCursor(nextPage.cursor);
      setAuditFailed(false);
    } catch {
      setAuditFailed(true);
    } finally {
      setAuditLoading(false);
    }
  }
  const state = loaded?.key === key ? loaded : null;
  const auditTime = new Intl.DateTimeFormat(intlLocale[locale], {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Helsinki',
  });
  return (
    <section className={panelClass} aria-labelledby="history-heading">
      <h2
        id="history-heading"
        className="border-b border-hairline pb-3 text-xl font-semibold text-navy dark:border-stone-800 dark:text-stone-100"
      >
        {t('spine.passport')}
      </h2>
      <p className="mt-3 text-sm text-ink-muted dark:text-stone-300">{t('spine.historyHelp')}</p>
      {failedKey === key && !state ? <p role="alert">{t('spine.error')}</p> : null}
      {state ? (
        <>
          {state.passport.earlierLivesWithoutRecords > 0 ? (
            <p className="mt-3 rounded-lg border border-hairline bg-mist/60 px-3 py-2 text-sm text-ink-muted dark:border-stone-800 dark:bg-stone-800/50 dark:text-stone-300">
              {t('spine.previousUnknown', { count: state.passport.earlierLivesWithoutRecords })}
            </p>
          ) : null}
          <ol className="mt-4 space-y-2.5">
            {state.passport.lives.map((life) => (
              <li
                key={life.life_number}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-hairline border-l-4 border-l-ocean bg-mist/45 px-4 py-2.5 text-sm dark:border-stone-800 dark:border-l-cyan-500 dark:bg-stone-800/40"
              >
                <span className="font-semibold text-navy dark:text-stone-100">
                  {t('spine.life', { count: life.life_number })}
                </span>
                <span className="text-ink-muted tabular-nums dark:text-stone-300">
                  {life.start_date} → {life.closed_on ?? life.end_date}
                </span>
                <span className="rounded bg-ice px-2 py-0.5 text-xs font-semibold text-ocean dark:bg-cyan-950 dark:text-cyan-300">
                  {messageFor(locale, 'spine.' + life.status)}
                </span>
              </li>
            ))}
          </ol>
          {!state.passport.lives.length ? (
            <p className="mt-3 rounded-lg border border-hairline bg-mist/40 p-3 text-sm text-ink-muted dark:border-stone-800 dark:bg-stone-800/40 dark:text-stone-400">
              {t('spine.noHistory')}
            </p>
          ) : null}
          <h3 className="mt-8 border-t border-hairline pt-6 text-lg font-semibold text-navy dark:border-stone-800 dark:text-stone-100">
            {t('spine.audit')}
          </h3>
          <div className="mt-3 overflow-x-auto rounded-lg border border-hairline bg-card dark:border-stone-700 dark:bg-stone-900">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-hairline bg-mist/80 text-xs tracking-wide text-ink-muted uppercase dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300">
                  <th scope="col" className="p-3 font-semibold">
                    {t('spine.auditTime')}
                  </th>
                  <th scope="col" className="p-3 font-semibold">
                    {t('spine.auditAction')}
                  </th>
                  <th scope="col" className="p-3 font-semibold">
                    {t('spine.auditActor')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline dark:divide-stone-800">
                {auditPages.map((row) => (
                  <tr key={row.id}>
                    <td className="p-3 text-ink-muted tabular-nums dark:text-stone-300">
                      <time dateTime={row.at}>{auditTime.format(new Date(row.at))}</time>
                    </td>
                    <td className="p-3 font-medium text-navy dark:text-stone-100">
                      {messageFor(locale, 'spine.action.' + row.action, 'spine.audit')}
                    </td>
                    <td className="p-3 font-mono text-xs text-ink-muted break-all dark:text-stone-400">
                      {row.actor}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink-muted dark:text-stone-400" role="status">
              {t('spine.auditShown', {
                count: formatNumber(auditPages.length, locale),
                total: formatNumber(
                  AUDIT_PAGE_SIZE * Math.max(1, Math.ceil(auditPages.length / AUDIT_PAGE_SIZE)),
                  locale
                ),
              })}
            </p>
            {auditFailed ? (
              <p className="text-xs font-medium text-red-700 dark:text-red-300" role="alert">
                {t('spine.error')}
              </p>
            ) : null}
            {auditCursor ? (
              <button
                type="button"
                className={buttonClass + ' text-xs'}
                disabled={auditLoading}
                onClick={() => {
                  void loadMoreAudit();
                }}
              >
                {auditLoading ? t('spine.pending') : t('spine.auditMore')}
              </button>
            ) : null}
          </div>
        </>
      ) : failedKey === key ? null : (
        <p className="mt-3" role="status">
          {t('spine.loading')}
        </p>
      )}
    </section>
  );
}
